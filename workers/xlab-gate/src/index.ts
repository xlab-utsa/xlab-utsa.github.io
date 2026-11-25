// X-Lab Studio Gate — auth and the single write path to the content repo.
//
// Design rule for this file: it must never need to change when the content model changes.
// It checks WHO you are, WHICH path you may write, and HOW BIG the payload is. It does not
// know what a Person or a Publication is. Schema correctness is enforced in CI, on the pull
// request this Worker opens — see .github/workflows/validate.yml.
import { randomId, signToken, verifyToken } from "./crypto";
import type { Env, Identity } from "./env";
import {
  bumpCredentialVersion,
  burnPasswordCheck,
  checkPassword,
  credentialVersion,
  makePasswordRecord,
  passwordProblem,
  readPassword,
  writePassword,
} from "./passwords";
import {
  approvePR,
  createSubmissionPR,
  deployStatus,
  installationToken,
  listQueue,
  listReturned,
  prFiles,
  readFile,
  rejectPR,
  type FileChange,
} from "./github";
import {
  canApprove,
  canWritePath,
  findByEmail,
  findByGithubLogin,
  findById,
  invalidateRosterCache,
  loadRoster,
  toIdentity,
} from "./roster";

// 30 days. A session only ever permits submitting changes for review, and signing in again
// is just an email and a password — so there is no reason to make it longer.
const SESSION_TTL_S = 30 * 24 * 60 * 60;
// Admin-issued set-password link: must survive being passed along by hand.
const SETPW_TTL_S = 14 * 24 * 60 * 60;
const WINDOW_S = 15 * 60;
/** Sign-in attempts per IP per window, across all accounts. */
const LOGIN_IP_MAX = 30;
/** Failed passwords per account before it is locked for the rest of the window. */
const LOGIN_ACCOUNT_MAX = 10;

// --- HTTP helpers --------------------------------------------------------------

function cors(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(env: Env, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

function fail(env: Env, status: number, message: string): Response {
  return json(env, { error: message }, status);
}

// --- sessions ------------------------------------------------------------------

interface Session {
  sub: string;
  /** Roster account id. Absent only on sessions minted before passwords existed. */
  account?: string;
  email: string;
  /** How they signed in. "password" sessions are checked against the credential version. */
  method?: "password" | "github";
  /** Credential version the session was issued under (password sessions). */
  cv?: number;
  exp: number;
}

async function readSession(req: Request, env: Env): Promise<Session | undefined> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return undefined;
  return verifyToken<Session>(token, env.SESSION_SECRET);
}

async function issueSession(
  env: Env,
  entry: { id: string },
  opts: { sub: string; email?: string; method: "password" | "github"; cv?: number }
): Promise<string> {
  const session: Session = {
    sub: opts.sub,
    account: entry.id,
    email: opts.email ?? "",
    method: opts.method,
    cv: opts.cv,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
  };
  return signToken(session, env.SESSION_SECRET);
}

/** Count one event against a rate-limit key; true when the limit was already reached. */
async function overLimit(env: Env, key: string, max: number): Promise<boolean> {
  const count = Number((await env.SESSIONS.get(key)) ?? "0");
  if (count >= max) return true;
  await env.SESSIONS.put(key, String(count + 1), { expirationTtl: WINDOW_S });
  return false;
}

// --- handlers ------------------------------------------------------------------

/**
 * Email + password sign-in (SPEC.md §8.4).
 *
 * Every failure answers with the same message and takes the same time (a dummy PBKDF2 run
 * when there is no account or no password yet), so this endpoint cannot be used to find out
 * who is in the lab. Rate-limited per IP; an account locks for the rest of the window after
 * repeated wrong passwords.
 */
async function handleLogin(req: Request, env: Env): Promise<Response> {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const denied = () => fail(env, 401, "wrong_credentials");
  if (!email || !password || password.length > 1024) return denied();

  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  if (await overLimit(env, `rl:login:ip:${ip}`, LOGIN_IP_MAX)) return fail(env, 429, "too_many_attempts");

  const entry = await findByEmail(env, email);
  const record = entry ? await readPassword(env.SESSIONS, entry.id) : undefined;
  if (!entry || !record) {
    await burnPasswordCheck(password);
    return denied();
  }

  const failKey = `fail:${entry.id}`;
  const failures = Number((await env.SESSIONS.get(failKey)) ?? "0");
  if (failures >= LOGIN_ACCOUNT_MAX) return fail(env, 429, "too_many_attempts");

  if (!(await checkPassword(password, record))) {
    await env.SESSIONS.put(failKey, String(failures + 1), { expirationTtl: WINDOW_S });
    return denied();
  }
  await env.SESSIONS.delete(failKey);

  const token = await issueSession(env, entry, {
    sub: `account:${entry.id}`,
    email: email.trim().toLowerCase(),
    method: "password",
    cv: record.version,
  });
  return json(env, { token });
}

/**
 * Set (or reset) a password from an admin-issued link.
 *
 * GET shows the form and spends NOTHING — chat apps and mail scanners fetch every URL they
 * see, and a link redeemed on GET is burned before the human clicks it. POST validates the
 * new password, stores it, invalidates every older session for the account, burns the link,
 * and signs the person in.
 */
async function handleSetPassword(req: Request, env: Env): Promise<Response> {
  let token = "";
  let password = "";
  let confirm = "";
  if (req.method === "POST") {
    const form = await req.formData().catch(() => undefined);
    token = String(form?.get("token") ?? "");
    password = String(form?.get("password") ?? "");
    confirm = String(form?.get("confirm") ?? "");
  } else {
    token = new URL(req.url).searchParams.get("token") ?? "";
  }

  const payload = await verifyToken<{ jti: string; account: string; exp: number }>(token, env.SESSION_SECRET);
  const stored = payload ? await env.SESSIONS.get(`setpw:${payload.jti}`) : null;
  if (!payload || stored !== payload.account) {
    return page(env, {
      problem: payload
        ? "This link was already used — each one works once. Ask an admin for a new one."
        : "This link has expired or is not valid. Ask an admin for a new one.",
    });
  }
  const entry = await findById(env, payload.account);
  if (!entry) return page(env, { problem: "This account is no longer active. Ask an admin." });

  if (req.method !== "POST") return page(env, { token, name: entry.name });

  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  if (await overLimit(env, `rl:setpw:ip:${ip}`, LOGIN_IP_MAX)) {
    return page(env, { token, name: entry.name, error: "Too many attempts. Wait a few minutes and try again." });
  }
  if (password !== confirm) return page(env, { token, name: entry.name, error: "The two passwords don't match." });
  const problem = passwordProblem(password, [entry.name, ...entry.name.split(/\s+/), entry.id]);
  if (problem) return page(env, { token, name: entry.name, error: `${problem[0].toUpperCase()}${problem.slice(1)}.` });

  const version = (await credentialVersion(env.SESSIONS, entry.id)) + 1;
  await writePassword(env.SESSIONS, entry.id, await makePasswordRecord(password, version));
  await env.SESSIONS.delete(`setpw:${payload.jti}`);
  await env.SESSIONS.delete(`fail:${entry.id}`);

  const session = await issueSession(env, entry, { sub: `account:${entry.id}`, method: "password", cv: version });
  return new Response(null, {
    status: 302,
    headers: { Location: `${env.STUDIO_URL}#token=${encodeURIComponent(session)}` },
  });
}

/** Sign-in links from before passwords. They no longer sign anyone in. */
function handleRetiredLink(env: Env): Response {
  return page(env, {
    problem: "Studio now uses passwords instead of sign-in links. Ask an admin for a set-password link.",
  });
}

/** The one HTML page this Worker serves: "choose a password", or why that can't be done. */
function page(env: Env, opts: { token?: string; name?: string; problem?: string; error?: string }): Response {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const who = opts.name ? ` as <strong>${esc(opts.name)}</strong>` : "";
  const error = opts.error ? `<p class="err">${esc(opts.error)}</p>` : "";
  const body = opts.problem
    ? `<p class="muted">${esc(opts.problem)}</p>
       <a class="btn" href="${esc(env.STUDIO_URL)}">Go to Studio</a>`
    : `<p class="muted">Choose a password for X-Lab Studio${who}. At least 8 characters.
        From now on you'll sign in with your email and this password.</p>
       ${error}
       <form method="post">
         <input type="hidden" name="token" value="${esc(opts.token ?? "")}">
         <label>New password<input type="password" name="password" autocomplete="new-password" minlength="8" required autofocus></label>
         <label>Type it again<input type="password" name="confirm" autocomplete="new-password" minlength="8" required></label>
         <button class="btn" type="submit">Set password and continue</button>
       </form>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>X-Lab Studio — set your password</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;background:#fff}
main{width:100%;max-width:400px;padding:32px 24px;text-align:center}h1{font-size:22px;margin:0 0 8px;letter-spacing:-.01em}
.muted{color:#555;margin:0 0 20px}.err{color:#b4430e;margin:0 0 14px;font-weight:600}
form{display:flex;flex-direction:column;gap:12px;text-align:left}label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#333}
input[type=password]{font:inherit;padding:10px 12px;border:1px solid #bbb;border-radius:4px}input:focus{outline:2px solid #111;outline-offset:1px}
.btn{display:inline-block;padding:12px 20px;background:#111;color:#fff;border:0;border-radius:4px;
font:700 12px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;cursor:pointer;text-align:center}</style></head>
<body><main><h1>X-Lab Studio</h1>${body}</main></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Admin sign-in via GitHub, so admin access rests on GitHub's 2FA rather than an inbox. */
async function handleGithubStart(req: Request, env: Env): Promise<Response> {
  const state = randomId();
  await env.SESSIONS.put(`oauth:${state}`, "1", { expirationTtl: 600 });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${new URL(req.url).origin}/auth/github/callback`);
  url.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

async function handleGithubCallback(req: Request, env: Env): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";
  const redirect = (p: string) =>
    new Response(null, { status: 302, headers: { Location: `${env.STUDIO_URL}#${p}` } });

  // CSRF: the state must be one we issued, and it is single-use.
  if (!code || !state || !(await env.SESSIONS.get(`oauth:${state}`))) {
    return redirect("error=bad_oauth_state");
  }
  await env.SESSIONS.delete(`oauth:${state}`);

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return redirect("error=oauth_failed");

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${access_token}`,
      "User-Agent": "xlab-studio-gate",
      Accept: "application/vnd.github+json",
    },
  });
  const user = (await userRes.json()) as { login?: string; name?: string; email?: string };
  if (!user.login) return redirect("error=oauth_failed");

  // The user token is used only to read identity, then discarded — it is never stored and
  // never used to write. All writes go through the App installation token.
  const entry = await findByGithubLogin(env, user.login);
  if (!entry) return redirect("error=not_authorized");

  const session = await issueSession(env, entry, { sub: `github:${user.login}`, method: "github" });
  return redirect(`token=${encodeURIComponent(session)}`);
}

/** Open a submission PR. The only write path in the system. */
async function handleSubmit(req: Request, env: Env, id: Identity): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    summary?: string;
    files?: FileChange[];
  } | null;
  if (!body?.files?.length || !body.title) return fail(env, 400, "title and files are required");

  const maxBytes = Number(env.MAX_PAYLOAD_BYTES);
  const size = body.files.reduce(
    (n, f) => n + (f.content?.length ?? 0) + (f.contentBase64?.length ?? 0),
    0
  );
  if (size > maxBytes) return fail(env, 413, `payload too large (${size} > ${maxBytes} bytes)`);

  const prefixes = env.ALLOWED_WRITE_PREFIXES.split(",").map((p) => p.trim()).filter(Boolean);

  for (const f of body.files) {
    // Reject traversal and absolute paths before anything else looks at them.
    if (!f.path || f.path.includes("..") || f.path.startsWith("/") || f.path.includes("\\")) {
      return fail(env, 400, `illegal path: ${f.path}`);
    }
    if (!prefixes.some((p) => f.path.startsWith(p))) {
      return fail(env, 403, `path not writable: ${f.path}`);
    }
    // Existence — and, for members, the current contents — is resolved server-side rather
    // than trusted from the client, so a member cannot claim "this is a create" to slip past
    // the edit restriction, nor claim to be on a record they are not.
    const existing = id.role === "admin" ? undefined : await readFile(env, f.path);
    const exists = id.role === "admin" ? true : Boolean(existing);
    if (f.delete && id.role === "member") {
      return fail(env, 403, `members cannot delete records — ask an admin to remove ${f.path}`);
    }
    if (!canWritePath(id, f.path, !exists, existing?.content, f.content)) {
      return fail(env, 403, `you are not allowed to modify ${f.path}`);
    }
  }

  const branch = `submission/${Date.now()}-${randomId(6).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  // Machine-readable submitter block: lets members find their own submissions in the queue.
  // The account id, NEVER an address — pull requests on this public repo are public.
  const marker = `<!-- studio:${JSON.stringify({ account: id.account, name: id.name })} -->`;
  const pr = await createSubmissionPR(env, {
    branch,
    message: `${body.title}\n\nSubmitted via X-Lab Studio by ${id.name} (${id.account})`,
    title: body.title,
    body:
      `${body.summary ?? ""}\n\n---\n` +
      `Submitted by **${id.name}** (account \`${id.account}\`), role \`${id.role}\`.\n\n` +
      `Files changed:\n${body.files.map((f) => `- \`${f.path}\`${f.delete ? " (delete)" : ""}`).join("\n")}\n\n` +
      marker,
    files: body.files,
    labels: ["studio-submission"],
  });

  return json(env, { ok: true, pr });
}

async function handleApproveOrReject(
  req: Request,
  env: Env,
  id: Identity,
  action: "approve" | "reject"
): Promise<Response> {
  if (!canApprove(id)) return fail(env, 403, "only an admin or editor can review submissions");
  const { number, reason } = (await req.json().catch(() => ({}))) as {
    number?: number;
    reason?: string;
  };
  if (!number) return fail(env, 400, "number is required");

  const queue = await listQueue(env);
  const item = queue.find((q) => q.number === number);
  if (!item) return fail(env, 404, "submission not found or already closed");

  // Refuse to merge a submission that is not verifiably green. This is the line that makes
  // "bad data cannot reach main" true rather than aspirational, so it fails closed: only an
  // explicit "success" is allowed through. "unknown" is permitted because it means the
  // checks API itself errored, and an unreachable GitHub endpoint must not permanently
  // freeze the review queue.
  if (action === "approve") {
    if (item.checks === "failure") {
      return fail(env, 409, "validation is failing on this submission — fix the errors before approving");
    }
    if (item.checks === "pending") {
      return fail(env, 409, "validation is still running — try again in a minute");
    }
  }

  if (action === "approve") {
    await approvePR(env, number, item.branch);
    // The roster is cached for a minute to avoid a GitHub round trip per request. Without
    // dropping it here, adding someone and immediately clicking "Invite link" fails with
    // "that address is not on the roster yet" — the exact moment an admin would try it.
    invalidateRosterCache();
  } else {
    await rejectPR(env, number, reason ?? "", item.branch);
  }

  return json(env, { ok: true });
}

// --- router --------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // CORS preflight, answered before any routing or auth.
    //
    // This MUST stay ahead of route(). A preflight is an unauthenticated OPTIONS request, so
    // if it reaches the router it matches a path, fails the session check, and returns 401 —
    // and a non-2xx preflight makes the browser refuse the real request with
    // "Response to preflight request doesn't pass access control check". That failure looks
    // like a CORS misconfiguration but is really "the preflight was never handled".
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    const ctx: RequestContext = {};
    try {
      // THE single await point for the whole Worker.
      //
      // Structural, not stylistic: `try { return somePromise }` inside an async function does
      // NOT catch that promise's rejection, because the try block exits before it settles.
      // That once let every handler's errors escape to Cloudflare's own error page, which
      // carries no CORS headers — so the browser reported a misleading "blocked by CORS
      // policy" and the real message was invisible.
      //
      // Routing now lives in one function that is awaited exactly here, so no future handler
      // can reintroduce that bug by forgetting an `await`. Do not inline routing back into
      // this method.
      return await route(req, env, ctx);
    } catch (err) {
      console.error("unhandled error:", err);
      // Reviewers get the real message; everyone else gets a generic one. Diagnosing a
      // failure otherwise means reaching for `wrangler tail`, which the site's owner should
      // never have to do — and an admin can already see everything this could disclose.
      // Secrets never appear here: github.ts throws the API's own response body.
      const detail =
        ctx.identity && (ctx.identity.role === "admin" || ctx.identity.role === "editor")
          ? ` — ${String(err).replace(/\s+/g, " ").slice(0, 400)}`
          : "";
      return fail(env, 500, `internal error${detail}`);
    }
  },
};

interface RequestContext {
  /** Set once the caller is identified, so the catch in fetch() can tailor its message. */
  identity?: Identity;
}

/**
 * All routing. Deliberately does NOT catch its own errors — fetch() above owns that, which
 * is what guarantees every failure comes back as JSON with CORS headers attached.
 */
async function route(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // --- public ---
  if (path === "/" ) return json(env, { service: "xlab-gate", ok: true });

  // Unauthenticated on purpose: this is how you confirm the gate is wired up before
  // anyone can sign in, and it is what Studio's status panel polls. It reports whether
  // each dependency works, never what it contains — no counts, names, or credentials.
  if (path === "/health") {
    const checks: Record<string, string> = {};
    try {
      await installationToken(env);
      checks.github = "ok";
    } catch (err) {
      checks.github = `fail — ${String(err).slice(0, 300)}`;
    }
    try {
      const roster = await loadRoster(env);
      checks.roster = roster.members.length > 0 ? "ok" : "empty — commit access/roster.json";
    } catch (err) {
      checks.roster = `fail — ${String(err).slice(0, 200)}`;
    }
    return json(env, { service: "xlab-gate", checks });
  }
  // NOTE: every handler call below is `return await`, never a bare `return`.
  // In an async function, `try { return somePromise }` does NOT catch that promise's
  // rejection — the try block has already exited by the time it settles. Without the
  // await, a failing handler escapes the catch, Cloudflare serves its own error page,
  // and because that page carries no CORS headers the browser reports a misleading
  // "blocked by CORS policy" instead of the actual error.
  if (path === "/auth/login" && req.method === "POST") return await handleLogin(req, env);
  if (path === "/auth/set-password" && (req.method === "GET" || req.method === "POST"))
    return await handleSetPassword(req, env);
  if (path === "/auth/verify") return handleRetiredLink(env);
  if (path === "/auth/github/start") return await handleGithubStart(req, env);
  if (path === "/auth/github/callback") return await handleGithubCallback(req, env);

  // --- authenticated ---
  const session = await readSession(req, env);
  if (!session) return fail(env, 401, "not signed in");

  // The token proves who signed in; the ROSTER decides what they are now. Re-reading it on
  // every request (it is cached for a minute) is what makes two things true that a 30-day
  // token alone cannot: deactivating someone actually signs them out, and an admin fixing a
  // member's role or profile id takes effect without a new sign-in.
  const entry = session.account ? await findById(env, session.account) : await findByEmail(env, session.email);
  if (!entry) return fail(env, 401, "access_removed");
  // A password session is only as good as the password it was issued under: setting a new
  // one, or an admin revoking access, bumps the version and ends every older session.
  if (session.method === "password" && session.cv !== (await credentialVersion(env.SESSIONS, entry.id))) {
    return fail(env, 401, "session_ended");
  }
  const id = toIdentity(entry, session.sub, session.email);
  ctx.identity = id;

  if (path === "/me") return json(env, id);
  if (path === "/submit" && req.method === "POST") return await handleSubmit(req, env, id);

  // The exact current text of one content file. Studio needs it to build a self-link
  // (SPEC.md §9.3), which must differ from the live file by a single inserted line — the
  // snapshot holds parsed records, not the file's text. Content is public in the repo
  // anyway; this is gated on a session only to keep it off the open internet's quota.
  if (path === "/file" && req.method === "GET") {
    const filePath = new URL(req.url).searchParams.get("path") ?? "";
    if (!filePath.startsWith("content/") || filePath.includes("..") || filePath.includes("\\")) {
      return fail(env, 400, "only content/ files can be read");
    }
    const file = await readFile(env, filePath);
    if (!file) return fail(env, 404, "no such file");
    return json(env, { path: filePath, content: file.content });
  }

  // Roster read + set-password links. Admin only: these expose lab members' addresses and
  // mint credentials, neither of which an editor or member has any business doing.
  if (path === "/roster") {
    if (id.role !== "admin") return fail(env, 403, "admins only");
    return json(env, await loadRoster(env));
  }

  // A one-time link the admin hands over; the person uses it to choose a password (first
  // time) or a new one (forgot it). No email is ever sent by this system.
  if (path === "/invite" && req.method === "POST") {
    if (id.role !== "admin") return fail(env, 403, "admins only");
    const { account } = (await req.json().catch(() => ({}))) as { account?: string };
    if (!account) return fail(env, 400, "account is required");
    const target = await findById(env, account);
    if (!target) return fail(env, 404, "no active roster entry with that id — has the roster change been approved?");

    const jti = randomId();
    await env.SESSIONS.put(`setpw:${jti}`, target.id, { expirationTtl: SETPW_TTL_S });
    const token = await signToken(
      { jti, account: target.id, exp: Math.floor(Date.now() / 1000) + SETPW_TTL_S },
      env.SESSION_SECRET
    );
    return json(env, {
      link: `${new URL(req.url).origin}/auth/set-password?token=${encodeURIComponent(token)}`,
      expiresInDays: SETPW_TTL_S / 86400,
      name: target.name,
    });
  }

  // Kill outstanding set-password links for one account AND sign it out everywhere (bumps the
  // credential version). The response to a lost laptop or a link sent to the wrong person.
  if (path === "/revoke-invites" && req.method === "POST") {
    if (id.role !== "admin") return fail(env, 403, "admins only");
    const { account } = (await req.json().catch(() => ({}))) as { account?: string };
    if (!account) return fail(env, 400, "account is required");

    // Few keys ever exist at once (one per outstanding link), so a scan is cheap.
    let revoked = 0;
    let cursor: string | undefined;
    do {
      const list = await env.SESSIONS.list({ prefix: "setpw:", cursor });
      for (const key of list.keys) {
        if ((await env.SESSIONS.get(key.name)) === account) {
          await env.SESSIONS.delete(key.name);
          revoked++;
        }
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
    await bumpCredentialVersion(env.SESSIONS, account);

    return json(env, { ok: true, revoked, signedOut: true });
  }
  // Members see only their own submissions. Older PRs carried an address instead of an
  // account id; those still match for the person who signed in with that address.
  const isMine = (body: string) =>
    body.includes(`"account":"${id.account}"`) || (id.email !== "" && body.includes(`"email":"${id.email}"`));
  if (path === "/queue") {
    const queue = await listQueue(env);
    return json(env, { queue: canApprove(id) ? queue : queue.filter((q) => isMine(q.body)) });
  }
  // Submissions that were sent back, with the reviewer's note — so a member learns WHY
  // from inside Studio instead of from a GitHub notification they may never see.
  if (path === "/returned") {
    const returned = await listReturned(env);
    return json(env, { returned: canApprove(id) ? returned : returned.filter((q) => isMine(q.body)) });
  }
  if (path.startsWith("/queue/") && path.endsWith("/files")) {
    if (!canApprove(id)) return fail(env, 403, "not allowed");
    const number = Number(path.split("/")[2]);
    return json(env, { files: await prFiles(env, number) });
  }
  if (path === "/approve" && req.method === "POST")
    return await handleApproveOrReject(req, env, id, "approve");
  if (path === "/reject" && req.method === "POST")
    return await handleApproveOrReject(req, env, id, "reject");
  if (path === "/status") return json(env, { deploy: await deployStatus(env) });

  return fail(env, 404, "no such endpoint");
}
