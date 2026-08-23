// GitHub App access. This module holds the ONLY path to repo writes in the entire system.
//
// Every mutation goes through createSubmissionPR: a branch, a commit, a pull request. There
// is deliberately no "write straight to main" function, not even for admins — so every
// change is reviewable, diffable, and revertable by construction rather than by policy.
import { appJwt } from "./crypto";
import type { Env } from "./env";

const API = "https://api.github.com";
const UA = "xlab-studio-gate";

/** Installation tokens last an hour; reuse within an isolate instead of re-minting. */
let tokenCache: { token: string; expiresAt: number } | undefined;

async function gh<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": UA,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub ${init.method ?? "GET"} ${path} -> ${res.status}: ${detail.slice(0, 400)}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function installationToken(env: Env): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const jwt = await appJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const install = await gh<{ id: number }>(
    `/repos/${env.REPO_OWNER}/${env.REPO_NAME}/installation`,
    jwt
  );
  const created = await gh<{ token: string; expires_at: string }>(
    `/app/installations/${install.id}/access_tokens`,
    jwt,
    { method: "POST" }
  );
  tokenCache = { token: created.token, expiresAt: Date.parse(created.expires_at) };
  return created.token;
}

function repoPath(env: Env, suffix: string): string {
  return `/repos/${env.REPO_OWNER}/${env.REPO_NAME}${suffix}`;
}

// --- reads ---------------------------------------------------------------------

/** Raw file contents at a ref, or undefined if it does not exist. */
export async function readFile(
  env: Env,
  path: string,
  ref?: string
): Promise<{ content: string; sha: string } | undefined> {
  const token = await installationToken(env);
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  try {
    const res = await gh<{ content: string; encoding: string; sha: string }>(
      repoPath(env, `/contents/${path}${q}`),
      token
    );
    const bin = atob(res.content.replace(/\n/g, ""));
    // Decode as UTF-8 rather than latin-1 so non-ASCII names survive the round trip.
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { content: new TextDecoder().decode(bytes), sha: res.sha };
  } catch (err) {
    if (String(err).includes("-> 404")) return undefined;
    throw err;
  }
}

// --- writes --------------------------------------------------------------------

export interface FileChange {
  path: string;
  /** UTF-8 text content. Omit together with `contentBase64` to delete the file. */
  content?: string;
  /** Base64 payload for binary files (images). */
  contentBase64?: string;
  delete?: boolean;
}

interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string | null;
}

/**
 * Create a branch, commit the given file changes, and open a pull request.
 *
 * Uses the Git Data API (blobs -> tree -> commit -> ref) rather than the Contents API so
 * that a multi-file change — a record plus its uploaded image, say — lands as ONE atomic
 * commit instead of several partial ones that could half-fail.
 */
export async function createSubmissionPR(
  env: Env,
  opts: {
    branch: string;
    message: string;
    title: string;
    body: string;
    files: FileChange[];
    labels?: string[];
  }
): Promise<{ number: number; url: string; branch: string }> {
  const token = await installationToken(env);
  const base = env.REPO_BRANCH;

  const baseRef = await gh<{ object: { sha: string } }>(
    repoPath(env, `/git/ref/heads/${base}`),
    token
  );
  const baseSha = baseRef.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(
    repoPath(env, `/git/commits/${baseSha}`),
    token
  );

  const tree: TreeEntry[] = [];
  for (const f of opts.files) {
    if (f.delete) {
      // A null sha in a tree entry is how the Git Data API expresses deletion.
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await gh<{ sha: string }>(repoPath(env, "/git/blobs"), token, {
      method: "POST",
      body: JSON.stringify(
        f.contentBase64 !== undefined
          ? { content: f.contentBase64, encoding: "base64" }
          : { content: f.content ?? "", encoding: "utf-8" }
      ),
    });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await gh<{ sha: string }>(repoPath(env, "/git/trees"), token, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });

  const commit = await gh<{ sha: string }>(repoPath(env, "/git/commits"), token, {
    method: "POST",
    body: JSON.stringify({
      message: opts.message,
      tree: newTree.sha,
      parents: [baseSha],
    }),
  });

  await gh(repoPath(env, "/git/refs"), token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${opts.branch}`, sha: commit.sha }),
  });

  const pr = await gh<{ number: number; html_url: string }>(repoPath(env, "/pulls"), token, {
    method: "POST",
    body: JSON.stringify({ title: opts.title, body: opts.body, head: opts.branch, base }),
  });

  if (opts.labels?.length) {
    await gh(repoPath(env, `/issues/${pr.number}/labels`), token, {
      method: "POST",
      body: JSON.stringify({ labels: opts.labels }),
    });
  }

  return { number: pr.number, url: pr.html_url, branch: opts.branch };
}

// --- review queue --------------------------------------------------------------

export interface QueueItem {
  number: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  url: string;
  branch: string;
  labels: string[];
  /** "success" | "failure" | "pending" | "unknown" — the CI gate's verdict. */
  checks: string;
  mergeable: boolean | null;
}

export async function listQueue(env: Env): Promise<QueueItem[]> {
  const token = await installationToken(env);
  const prs = await gh<
    {
      number: number;
      title: string;
      body: string | null;
      created_at: string;
      html_url: string;
      head: { ref: string; sha: string };
      labels: { name: string }[];
      user: { login: string };
    }[]
  >(repoPath(env, "/pulls?state=open&per_page=100"), token);

  return Promise.all(
    prs.map(async (pr) => {
      // GitHub Actions reports results as CHECK RUNS, not as legacy commit statuses. The
      // /status endpoint therefore returns "pending" forever for an Actions-only repo,
      // which would silently defeat the "never merge a failing submission" guard in
      // index.ts. Read check-runs instead and fail closed on anything unresolved.
      let checks = "unknown";
      try {
        const res = await gh<{
          total_count: number;
          check_runs: { status: string; conclusion: string | null }[];
        }>(repoPath(env, `/commits/${pr.head.sha}/check-runs`), token);

        if (res.total_count === 0) {
          checks = "pending";
        } else if (res.check_runs.some((c) => c.status !== "completed")) {
          checks = "pending";
        } else if (
          res.check_runs.some(
            (c) => c.conclusion !== "success" && c.conclusion !== "neutral" && c.conclusion !== "skipped"
          )
        ) {
          checks = "failure";
        } else {
          checks = "success";
        }
      } catch {
        /* best-effort; a missing checks API must not break the queue listing */
      }
      return {
        number: pr.number,
        title: pr.title,
        body: pr.body ?? "",
        author: pr.user.login,
        createdAt: pr.created_at,
        url: pr.html_url,
        branch: pr.head.ref,
        labels: pr.labels.map((l) => l.name),
        checks,
        mergeable: null,
      };
    })
  );
}

/** The diff for one submission, as unified patch text per file. */
export async function prFiles(env: Env, number: number) {
  const token = await installationToken(env);
  return gh<{ filename: string; status: string; additions: number; deletions: number; patch?: string }[]>(
    repoPath(env, `/pulls/${number}/files?per_page=100`),
    token
  );
}

/**
 * Delete a submission branch once its PR is resolved.
 *
 * Without this the repo accumulates one dead branch per edit forever — this system is meant
 * to run unattended for years. Best-effort: the branch is cosmetic once the PR is closed,
 * so a failure here must never make an approval look like it failed.
 */
async function deleteBranch(env: Env, token: string, branch: string): Promise<void> {
  try {
    await gh(repoPath(env, `/git/refs/heads/${branch}`), token, { method: "DELETE" });
  } catch (err) {
    console.error(`could not delete branch ${branch}:`, err);
  }
}

export async function approvePR(env: Env, number: number, branch?: string): Promise<void> {
  const token = await installationToken(env);

  // Squash first: it keeps main's history one-commit-per-approved-change, which is what
  // makes the activity log and one-click revert legible. But a repository can have squash
  // merging disabled in its settings, and GitHub then rejects the request outright — so
  // fall back rather than leaving the owner unable to approve anything with no way to tell
  // why. The fallbacks produce messier history, which is strictly better than a dead button.
  const methods = ["squash", "merge", "rebase"] as const;
  let lastError: unknown;

  for (const merge_method of methods) {
    try {
      await gh(repoPath(env, `/pulls/${number}/merge`), token, {
        method: "PUT",
        body: JSON.stringify({ merge_method }),
      });
      if (branch) await deleteBranch(env, token, branch);
      return;
    } catch (err) {
      lastError = err;
      // 405/409 mean "this merge method is not allowed / not currently possible"; anything
      // else (auth, missing PR, conflict) will fail identically for the other methods, so
      // stop rather than retrying twice more for nothing.
      const status = String(err).match(/-> (\d{3}):/)?.[1];
      if (status !== "405" && status !== "422") throw err;
    }
  }
  throw lastError;
}

export async function rejectPR(
  env: Env,
  number: number,
  reason: string,
  branch?: string
): Promise<void> {
  const token = await installationToken(env);
  if (reason.trim()) {
    await gh(repoPath(env, `/issues/${number}/comments`), token, {
      method: "POST",
      body: JSON.stringify({ body: `Rejected via Studio: ${reason}` }),
    });
  }
  await gh(repoPath(env, `/pulls/${number}`), token, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
  if (branch) await deleteBranch(env, token, branch);
}

/** Latest deploy run, so Studio can show whether an approved change is live yet. */
export async function deployStatus(env: Env) {
  const token = await installationToken(env);
  const runs = await gh<{
    workflow_runs: { status: string; conclusion: string | null; created_at: string; html_url: string }[];
  }>(repoPath(env, "/actions/runs?per_page=1"), token);
  const run = runs.workflow_runs[0];
  return run
    ? {
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        url: run.html_url,
      }
    : undefined;
}
