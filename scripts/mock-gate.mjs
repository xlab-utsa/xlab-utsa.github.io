#!/usr/bin/env node
// Mock of the xlab-gate Worker, for exercising Studio locally without any credentials.
//
// Why this exists: Studio's GATE_URL points at production and the real Worker only allows
// the production origin, so until this script there was no way to click through an
// authenticated Studio screen before deploying. Every member-facing flow (invite → sign in →
// create profile → submit → approve) can now be walked on localhost in seconds.
//
// What it mirrors from workers/xlab-gate/src — same JSON shapes, same status codes, and the
// SAME authorization rules (canWritePath is copied verbatim so a 403 here is a 403 in
// production). What it fakes: tokens are unsigned, "GitHub" is an in-memory PR list, CI is a
// timer, and approved files land in an in-memory overlay (printed to the console) instead of
// a repo. The content snapshot Studio reads is still public/content-snapshot.json, so an
// approved change does not appear in the lists — sign in as someone whose personId matches
// an existing person to exercise the "profile exists" states.
//
// Usage:
//   npm run dev:mock            # this server on :8787 (builds the snapshot first if missing)
//   npm run dev                 # Next on :3000, with NEXT_PUBLIC_GATE_URL=http://localhost:8787 in .env.local
//   open http://localhost:3000/studio/ and click "Sign in with GitHub" → a picker of roster entries.
//
// Knobs (env): MOCK_PORT (8787), MOCK_CHECKS_DELAY_MS (4000 — how long "validating…" lasts).
// A submission whose title contains "[fail]" gets a failing check, to exercise that path.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const PORT = Number(process.env.MOCK_PORT ?? 8787);
const CHECKS_DELAY_MS = Number(process.env.MOCK_CHECKS_DELAY_MS ?? 4000);
const STUDIO_URL = process.env.MOCK_STUDIO_URL ?? "http://localhost:3000/studio/";
const ROSTER_PATH = "access/roster.json";
const ALLOWED_PREFIXES = ["content/", "public/images/", "access/"];
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

// --- state ----------------------------------------------------------------------

/** Files "committed" by approvals, keyed by repo path. `null` = deleted. */
const overlay = new Map();
/** Pull requests, open and closed. */
const prs = [];
let nextPr = 101;
/** Outstanding invite nonces: jti -> email. */
const invites = new Map();

// Two members that always exist here, so both member states are one click away without
// first walking add → approve → invite:
//   Demo Member   — profile ALREADY exists (MOCK_DEMO_MEMBER, default yifan-yang)
//   Demo Newcomer — profile does NOT exist yet (first sign-in / create path)
// Set MOCK_DEMO_MEMBER=none to disable both. They are injected only until a roster change is
// approved in Studio; from then on the approved roster (which includes them) is used as-is.
const DEMO_PERSON = process.env.MOCK_DEMO_MEMBER ?? "yifan-yang";
const DEMO_MEMBERS =
  DEMO_PERSON !== "none"
    ? [
        { email: "demo.member@localhost", name: "Demo Member", role: "member", personId: DEMO_PERSON, active: true },
        { email: "demo.newcomer@localhost", name: "Demo Newcomer", role: "member", personId: "demo-newcomer", active: true },
      ]
    : [];

function loadRoster() {
  const text = overlay.get(ROSTER_PATH) ?? fs.readFileSync(path.join(ROOT, ROSTER_PATH), "utf8");
  const roster = JSON.parse(text);
  if (!overlay.has(ROSTER_PATH)) {
    roster.members = [...roster.members, ...DEMO_MEMBERS.filter((d) => !roster.members.some((m) => m.email === d.email))];
  }
  return roster;
}

function fileExists(repoPath) {
  if (overlay.has(repoPath)) return overlay.get(repoPath) !== null;
  return fs.existsSync(path.join(ROOT, repoPath));
}

function readRepoFile(repoPath) {
  if (overlay.has(repoPath)) return overlay.get(repoPath) ?? undefined;
  const abs = path.join(ROOT, repoPath);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : undefined;
}

// --- roster rules (mirrors workers/xlab-gate/src/roster.ts) -----------------------

function findByEmail(email) {
  const needle = String(email ?? "").trim().toLowerCase();
  return loadRoster().members.find(
    (m) => m.active && typeof m.email === "string" && m.email.trim().toLowerCase() === needle
  );
}

function toIdentity(entry, sub) {
  return {
    sub: sub ?? entry.email.toLowerCase(),
    email: entry.email,
    name: entry.name,
    role: entry.role,
    personId: entry.personId,
  };
}

const canApprove = (id) => id.role === "admin" || id.role === "editor";

function canWritePath(id, p, isCreate, existing) {
  if (id.role === "admin") return true;
  if (id.role === "editor") return p.startsWith("content/") || p.startsWith("public/images/");
  if (!id.personId) return false;
  if (p === `content/people/${id.personId}.yaml`) return true;
  if (p === `public/images/people/${id.personId}.png`) return true;
  if (p === `public/images/people/${id.personId}.jpg`) return true;
  const contribution =
    p.startsWith("content/publications/") || p.startsWith("content/recognitions/") || p.startsWith("content/posts/");
  if (!contribution) return false;
  if (isCreate) return true;
  return existing !== undefined && ownsRecord(existing, id.personId);
}

function ownsRecord(content, personId) {
  const id = personId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*(?:-\\s+)?(?:personId|authorId):\\s*["']?${id}["']?\\s*(?:#.*)?$`, "m").test(content);
}

// --- tokens (unsigned — this is a mock) ------------------------------------------

const encodeToken = (payload) => "mock." + Buffer.from(JSON.stringify(payload)).toString("base64url");
function decodeToken(token) {
  if (!token?.startsWith("mock.")) return undefined;
  try {
    return JSON.parse(Buffer.from(token.slice(5), "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

function identityOf(req) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = decodeToken(token);
  if (!payload?.email) return undefined;
  // Mirrors the Worker's planned behaviour: the live roster wins over whatever the token says.
  const entry = findByEmail(payload.email);
  return entry ? toIdentity(entry, payload.sub) : undefined;
}

// --- HTTP helpers ------------------------------------------------------------------

function cors(req) {
  const origin = req.headers.origin ?? "";
  return {
    "Access-Control-Allow-Origin": /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ? origin
      : "http://localhost:3000",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin",
  };
}

const send = (req, res, status, body, headers = {}) => {
  res.writeHead(status, { ...cors(req), ...headers });
  res.end(body);
};
const json = (req, res, data, status = 200) =>
  send(req, res, status, JSON.stringify(data), { "Content-Type": "application/json" });
const fail = (req, res, status, error) => json(req, res, { error }, status);
const redirect = (req, res, location) => send(req, res, 302, null, { Location: location });
const html = (req, res, body) =>
  send(req, res, 200, `<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;padding:24px;max-width:560px">${body}`, {
    "Content-Type": "text/html; charset=utf-8",
  });

function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

// --- "GitHub" -----------------------------------------------------------------------

function pseudoPatch(file) {
  const before = file.delete ? readRepoFile(file.path) ?? "" : readRepoFile(file.path) ?? "";
  const after = file.delete ? "" : file.contentBase64 !== undefined ? "" : file.content ?? "";
  const lines = [
    ...before.split("\n").filter(Boolean).map((l) => `-${l}`),
    ...after.split("\n").filter(Boolean).map((l) => `+${l}`),
  ];
  return {
    filename: file.path,
    status: file.delete ? "removed" : before ? "modified" : "added",
    additions: after ? after.split("\n").length : 0,
    deletions: before ? before.split("\n").length : 0,
    patch: file.contentBase64 !== undefined ? undefined : `@@ mock @@\n${lines.join("\n")}`,
  };
}

function openPr(id, body) {
  const number = nextPr++;
  const branch = `submission/${Date.now()}-${number}`;
  const marker = `<!-- studio:${JSON.stringify({ email: id.email, name: id.name })} -->`;
  const pr = {
    number,
    title: body.title,
    body:
      `${body.summary ?? ""}\n\n---\n` +
      `Submitted by **${id.name}** (${id.email}), role \`${id.role}\`.\n\n` +
      `Files changed:\n${body.files.map((f) => `- \`${f.path}\`${f.delete ? " (delete)" : ""}`).join("\n")}\n\n` +
      marker,
    author: "xlab-studio-gate[bot]",
    createdAt: new Date().toISOString(),
    url: `http://localhost:${PORT}/pr/${number}`,
    branch,
    labels: ["studio-submission"],
    checks: "pending",
    mergeable: null,
    state: "open",
    files: body.files,
    reason: "",
  };
  prs.push(pr);
  setTimeout(() => {
    if (pr.state === "open") pr.checks = /\[fail\]/i.test(pr.title) ? "failure" : "success";
  }, CHECKS_DELAY_MS);
  console.log(`  PR #${number} opened by ${id.email}: ${pr.title}`);
  for (const f of body.files) console.log(`      ${f.delete ? "delete" : "write "} ${f.path}`);
  return pr;
}

function applyPr(pr) {
  for (const f of pr.files) {
    overlay.set(f.path, f.delete ? null : f.contentBase64 !== undefined ? "<binary>" : f.content ?? "");
  }
  console.log(`  PR #${pr.number} approved — ${pr.files.length} file(s) applied to the in-memory overlay`);
}

const queueView = (pr) => ({
  number: pr.number,
  title: pr.title,
  body: pr.body,
  author: pr.author,
  createdAt: pr.createdAt,
  url: pr.url,
  branch: pr.branch,
  labels: pr.labels,
  checks: pr.checks,
  mergeable: pr.mergeable,
});

// --- router -------------------------------------------------------------------------

async function route(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") return send(req, res, 204, null);
  if (p === "/") return json(req, res, { service: "xlab-gate (mock)", ok: true });
  if (p === "/health") {
    return json(req, res, {
      service: "xlab-gate (mock)",
      checks: { github: "ok (mock)", roster: "ok", email: "not configured — mock" },
    });
  }

  // Sign-in picker: stands in for GitHub OAuth. Lists every active roster entry.
  if (p === "/auth/github/start") {
    const rows = loadRoster()
      .members.map(
        (m) =>
          `<li style="margin:6px 0"><a href="/auth/as?email=${encodeURIComponent(m.email)}">${m.name}</a>` +
          ` <code>${m.role}</code>${m.personId ? ` · profile <code>${m.personId}</code>` : ""}${m.active ? "" : " · <s>inactive</s>"}</li>`
      )
      .join("");
    return html(req, res, `<h2>Mock gate — sign in as…</h2><ul>${rows}</ul><p style="color:#666">Edit <code>access/roster.json</code> or approve a roster change in Studio to add people.</p>`);
  }
  if (p === "/auth/as") {
    const entry = findByEmail(url.searchParams.get("email"));
    if (!entry) return redirect(req, res, `${STUDIO_URL}#error=not_authorized`);
    return redirect(req, res, `${STUDIO_URL}#token=${encodeURIComponent(encodeToken(toIdentity(entry)))}`);
  }
  // Same GET-shows-a-page / POST-redeems split as the Worker, so link previews cannot burn a link.
  if (p === "/auth/verify" && req.method === "GET") {
    const jti = url.searchParams.get("token") ?? "";
    const email = invites.get(jti);
    if (!email) return html(req, res, `<h2>X-Lab Studio</h2><p>This sign-in link was already used or is not valid. Ask an admin for a new one.</p><a href="${STUDIO_URL}">Go to Studio</a>`);
    const entry = findByEmail(email);
    return html(
      req,
      res,
      `<h2>X-Lab Studio</h2><p>Sign in as <strong>${entry?.name ?? email}</strong>. This link works once; nothing happens until you continue.</p>` +
        `<form method="post"><input type="hidden" name="token" value="${jti}"><button type="submit">Continue to Studio</button></form>`
    );
  }
  if (p === "/auth/verify" && req.method === "POST") {
    const raw = await new Promise((resolve) => {
      let d = "";
      req.on("data", (c) => (d += c));
      req.on("end", () => resolve(d));
    });
    const jti = new URLSearchParams(raw).get("token") ?? "";
    const email = invites.get(jti);
    if (!email) return redirect(req, res, `${STUDIO_URL}#error=already_used`);
    const entry = findByEmail(email);
    if (!entry) return redirect(req, res, `${STUDIO_URL}#error=not_authorized`);
    if (entry.role !== "admin") invites.delete(jti);
    return redirect(req, res, `${STUDIO_URL}#token=${encodeURIComponent(encodeToken(toIdentity(entry)))}`);
  }
  if (p.startsWith("/pr/")) {
    const pr = prs.find((x) => x.number === Number(p.split("/")[2]));
    return pr
      ? html(req, res, `<h2>#${pr.number} ${pr.title}</h2><pre>${pr.body}</pre><p>state: ${pr.state} · checks: ${pr.checks}</p>`)
      : fail(req, res, 404, "no such PR");
  }

  // --- authenticated ---
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return fail(req, res, 401, "not signed in");
  const id = identityOf(req);
  // Same as the Worker: a valid token for someone no longer on the roster is "access_removed".
  if (!id) return fail(req, res, 401, decodeToken(header.slice(7))?.email ? "access_removed" : "not signed in");

  if (p === "/me") return json(req, res, id);

  if (p === "/submit" && req.method === "POST") {
    const body = await readJson(req);
    if (!body?.files?.length || !body.title) return fail(req, res, 400, "title and files are required");
    const size = body.files.reduce((n, f) => n + (f.content?.length ?? 0) + (f.contentBase64?.length ?? 0), 0);
    if (size > MAX_PAYLOAD_BYTES) return fail(req, res, 413, `payload too large (${size} > ${MAX_PAYLOAD_BYTES} bytes)`);
    for (const f of body.files) {
      if (!f.path || f.path.includes("..") || f.path.startsWith("/") || f.path.includes("\\")) {
        return fail(req, res, 400, `illegal path: ${f.path}`);
      }
      if (!ALLOWED_PREFIXES.some((pre) => f.path.startsWith(pre))) return fail(req, res, 403, `path not writable: ${f.path}`);
      const existing = id.role === "admin" ? undefined : readRepoFile(f.path);
      const exists = id.role === "admin" ? true : existing !== undefined;
      if (f.delete && id.role === "member") return fail(req, res, 403, `members cannot delete records — ask an admin to remove ${f.path}`);
      if (!canWritePath(id, f.path, !exists, existing)) return fail(req, res, 403, `you are not allowed to modify ${f.path}`);
    }
    const pr = openPr(id, body);
    return json(req, res, { ok: true, pr: { number: pr.number, url: pr.url, branch: pr.branch } });
  }

  if (p === "/roster") {
    if (id.role !== "admin") return fail(req, res, 403, "admins only");
    return json(req, res, loadRoster());
  }
  if (p === "/invite" && req.method === "POST") {
    if (id.role !== "admin") return fail(req, res, 403, "admins only");
    const { email } = (await readJson(req)) ?? {};
    if (!email) return fail(req, res, 400, "email is required");
    const entry = findByEmail(email);
    if (!entry) return fail(req, res, 404, "that address is not on the roster yet");
    const jti = Math.random().toString(36).slice(2, 12);
    invites.set(jti, entry.email.toLowerCase());
    return json(req, res, {
      link: `http://localhost:${PORT}/auth/verify?token=${jti}`,
      expiresInDays: 14,
      name: entry.name,
      reusable: entry.role === "admin",
    });
  }
  if (p === "/revoke-invites" && req.method === "POST") {
    if (id.role !== "admin") return fail(req, res, 403, "admins only");
    const { email } = (await readJson(req)) ?? {};
    if (!email) return fail(req, res, 400, "email is required");
    const target = String(email).trim().toLowerCase();
    let revoked = 0;
    for (const [jti, e] of invites) if (e === target) (invites.delete(jti), revoked++);
    return json(req, res, { ok: true, revoked });
  }

  if (p === "/queue") {
    const open = prs.filter((x) => x.state === "open");
    const visible = canApprove(id) ? open : open.filter((x) => x.body.includes(`"email":"${id.email}"`));
    return json(req, res, { queue: visible.map(queueView) });
  }
  if (p === "/returned") {
    const closed = prs.filter((x) => x.state === "closed").reverse();
    const visible = canApprove(id) ? closed : closed.filter((x) => x.body.includes(`"email":"${id.email}"`));
    return json(req, res, {
      returned: visible.map((x) => ({ number: x.number, title: x.title, body: x.body, closedAt: x.closedAt, url: x.url, reason: x.reason })),
    });
  }
  if (p.startsWith("/queue/") && p.endsWith("/files")) {
    if (!canApprove(id)) return fail(req, res, 403, "not allowed");
    const pr = prs.find((x) => x.number === Number(p.split("/")[2]));
    if (!pr) return fail(req, res, 404, "submission not found");
    return json(req, res, { files: pr.files.map(pseudoPatch) });
  }
  if ((p === "/approve" || p === "/reject") && req.method === "POST") {
    if (!canApprove(id)) return fail(req, res, 403, "only an admin or editor can review submissions");
    const { number, reason } = (await readJson(req)) ?? {};
    if (!number) return fail(req, res, 400, "number is required");
    const pr = prs.find((x) => x.number === number && x.state === "open");
    if (!pr) return fail(req, res, 404, "submission not found or already closed");
    if (p === "/approve") {
      if (pr.checks === "failure") return fail(req, res, 409, "validation is failing on this submission — fix the errors before approving");
      if (pr.checks === "pending") return fail(req, res, 409, "validation is still running — try again in a minute");
      applyPr(pr);
      pr.state = "merged";
    } else {
      pr.state = "closed";
      pr.reason = reason ?? "";
      pr.closedAt = new Date().toISOString();
      console.log(`  PR #${pr.number} returned: ${pr.reason}`);
    }
    return json(req, res, { ok: true });
  }
  if (p === "/status") {
    return json(req, res, {
      deploy: { status: "completed", conclusion: "success", createdAt: new Date().toISOString(), url: `http://localhost:${PORT}/` },
    });
  }
  return fail(req, res, 404, "no such endpoint");
}

// --- boot -------------------------------------------------------------------------

const snapshot = path.join(ROOT, "public", "content-snapshot.json");
if (!fs.existsSync(snapshot)) {
  console.log("public/content-snapshot.json missing — building it (npm run snapshot)…");
  execSync("npm run snapshot", { stdio: "inherit" });
}

http
  .createServer((req, res) => {
    route(req, res).catch((err) => {
      console.error("mock gate error:", err);
      fail(req, res, 500, `internal error — ${String(err)}`);
    });
  })
  .listen(PORT, () => {
    console.log(`\nmock xlab-gate listening on http://localhost:${PORT}`);
    console.log(`Studio should point at it: NEXT_PUBLIC_GATE_URL=http://localhost:${PORT} in .env.local`);
    console.log(`Sign-in picker: http://localhost:${PORT}/auth/github/start\n`);
  });
