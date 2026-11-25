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
//   open http://localhost:3000/studio/ and sign in with demo.member@localhost / demo-password,
//   or click "Admins: sign in with GitHub" → a picker of roster entries.
//
// Knobs (env): MOCK_PORT (8787), MOCK_CHECKS_DELAY_MS (4000 — how long "validating…" lasts).
// A submission whose title contains "[fail]" gets a failing check, to exercise that path.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

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
/** Outstanding set-password links: jti -> account id. */
const setpwLinks = new Map();
/** Password records: account id -> { salt, hash, version } (same derivation as the Worker). */
const passwords = new Map();
/** Credential versions bumped by "sign out everywhere": account id -> number. */
const credVersions = new Map();
/** Failed password attempts: account id -> count (lockout at LOGIN_ACCOUNT_MAX). */
const failures = new Map();
const LOGIN_ACCOUNT_MAX = 10;

/** Password of the two demo accounts. Anyone else needs a set-password link (as in production). */
const DEMO_PASSWORD = "demo-password";

/** Same derivation as the Worker: PBKDF2-SHA256, 100 000 rounds, random salt. */
function derivePassword(password, salt) {
  return pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("base64url");
}
function credentialVersion(account) {
  return Math.max(passwords.get(account)?.version ?? 0, credVersions.get(account) ?? 0);
}
function setPassword(account, password) {
  const salt = randomBytes(16);
  const version = credentialVersion(account) + 1;
  passwords.set(account, { salt, hash: derivePassword(password, salt), version });
  return version;
}
function checkPassword(account, password) {
  const record = passwords.get(account);
  if (!record) return false;
  const a = Buffer.from(derivePassword(password, record.salt));
  const b = Buffer.from(record.hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Two members that always exist here, so both member states are one click away without
// first walking add → approve → set password:
//   Demo Member   — profile ALREADY exists (MOCK_DEMO_MEMBER, default yifan-yang)
//   Demo Newcomer — profile does NOT exist yet (first sign-in / create path)
// Both sign in with demo.member@localhost / demo.newcomer@localhost and DEMO_PASSWORD.
// Set MOCK_DEMO_MEMBER=none to disable both. They are injected only until a roster change is
// approved in Studio; from then on the approved roster (which includes them) is used as-is.
const DEMO_PERSON = process.env.MOCK_DEMO_MEMBER ?? "yifan-yang";
const DEMO_MEMBERS =
  DEMO_PERSON !== "none"
    ? [
        { id: "demo-member", name: "Demo Member", email: "demo.member@localhost", role: "member", personId: DEMO_PERSON, active: true },
        { id: "demo-newcomer", name: "Demo Newcomer", email: "demo.newcomer@localhost", role: "member", personId: "demo-newcomer", active: true },
      ]
    : [];
for (const d of DEMO_MEMBERS) setPassword(d.id, DEMO_PASSWORD);

function loadRoster() {
  const text = overlay.get(ROSTER_PATH) ?? fs.readFileSync(path.join(ROOT, ROSTER_PATH), "utf8");
  const roster = JSON.parse(text);
  if (!overlay.has(ROSTER_PATH)) {
    roster.members = [...roster.members, ...DEMO_MEMBERS.filter((d) => !roster.members.some((m) => m.id === d.id))];
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
    (m) => m.active && typeof m.id === "string" && typeof m.email === "string" && m.email.trim().toLowerCase() === needle
  );
}

function findById(id) {
  return loadRoster().members.find((m) => m.active && m.id === id);
}

function toIdentity(entry, sub, email = "") {
  return { sub, account: entry.id, email, name: entry.name, role: entry.role, personId: entry.personId };
}

const canApprove = (id) => id.role === "admin" || id.role === "editor";

function canWritePath(id, p, isCreate, existing, incoming) {
  if (id.role === "admin") return true;
  if (id.role === "editor") return p.startsWith("content/") || p.startsWith("public/images/");
  if (!id.personId) return false;
  if (p === `content/people/${id.personId}.yaml`) return true;
  if (p === `public/images/people/${id.personId}.png`) return true;
  if (p === `public/images/people/${id.personId}.jpg`) return true;
  const contribution =
    p.startsWith("content/publications/") ||
    p.startsWith("content/recognitions/") ||
    p.startsWith("content/posts/") ||
    p.startsWith("content/projects/");
  if (!contribution) return false;
  if (isCreate) return true;
  if (existing === undefined) return false;
  if (ownsRecord(existing, id.personId)) return true;
  return p.startsWith("content/publications/") && incoming !== undefined && isSelfLinkOnly(existing, incoming, id.personId);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OWNER_LIST_KEYS = ["authorIds", "contributors"];

function ownsRecord(content, personId) {
  const id = escapeRe(personId);
  const text = content.replace(/\r\n/g, "\n");
  if (new RegExp(`^\\s*(?:-\\s+)?(?:personId|authorId):\\s*["']?${id}["']?\\s*(?:#.*)?$`, "m").test(text)) return true;
  const keys = OWNER_LIST_KEYS.join("|");
  if (new RegExp(`^\\s*(?:${keys}):\\s*\\[(?:[^\\]]*[\\s,])?["']?${id}["']?\\s*[,\\]]`, "m").test(text)) return true;
  const lines = text.split("\n");
  const item = new RegExp(`^(\\s*)-\\s+["']?${id}["']?\\s*(?:#.*)?$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(item);
    if (!m) continue;
    const indent = m[1].length;
    for (let k = i - 1; k >= 0; k--) {
      const line = lines[k];
      if (!line.trim()) continue;
      const lead = line.length - line.trimStart().length;
      if (lead === indent && line.trimStart().startsWith("-")) continue;
      const key = line.match(/^(\s*)([A-Za-z_][\w-]*):\s*(?:#.*)?$/);
      if (key && key[1].length <= indent && OWNER_LIST_KEYS.includes(key[2])) return true;
      break;
    }
  }
  return false;
}

function isSelfLinkOnly(existing, incoming, personId) {
  const norm = (t) => t.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const a = norm(existing).split("\n");
  const b = norm(incoming).split("\n");
  if (b.length !== a.length + 1) return false;
  const link = new RegExp(`^(\\s*)personId:\\s*["']?${escapeRe(personId)}["']?\\s*$`);
  let inserted = -1;
  for (let i = 0, j = 0; j < b.length; j++) {
    if (i < a.length && b[j] === a[i]) {
      i++;
      continue;
    }
    if (inserted !== -1) return false;
    inserted = j;
  }
  if (inserted < 1) return false;
  const m = b[inserted].match(link);
  const author = b[inserted - 1].match(/^(\s*)-\s+name:\s*\S/);
  if (!m || !author || m[1].length !== author[1].length + 2) return false;
  const next = b[inserted + 1] ?? "";
  const nextLead = next.length - next.trimStart().length;
  if (nextLead === m[1].length && /^\s*personId:/.test(next)) return false;
  return true;
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

/** Mirrors the Worker: the live roster wins over the token, and password sessions are version-checked. */
function sessionOf(req) {
  const header = req.headers.authorization ?? "";
  return decodeToken(header.startsWith("Bearer ") ? header.slice(7) : "");
}
function identityOf(session) {
  if (!session) return { error: "not signed in" };
  const entry = session.account ? findById(session.account) : findByEmail(session.email);
  if (!entry) return { error: "access_removed" };
  if (session.method === "password" && session.cv !== credentialVersion(entry.id)) return { error: "session_ended" };
  return { id: toIdentity(entry, session.sub, session.email ?? "") };
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
  const marker = `<!-- studio:${JSON.stringify({ account: id.account, name: id.name })} -->`;
  const pr = {
    number,
    title: body.title,
    body:
      `${body.summary ?? ""}\n\n---\n` +
      `Submitted by **${id.name}** (account \`${id.account}\`), role \`${id.role}\`.\n\n` +
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
  console.log(`  PR #${number} opened by ${id.account}: ${pr.title}`);
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
      checks: { github: "ok (mock)", roster: "ok" },
    });
  }

  // Sign-in picker: stands in for GitHub OAuth. Lists every active roster entry.
  if (p === "/auth/github/start") {
    const rows = loadRoster()
      .members.map(
        (m) =>
          `<li style="margin:6px 0"><a href="/auth/as?account=${encodeURIComponent(m.id)}">${m.name}</a>` +
          ` <code>${m.role}</code>${m.personId ? ` · profile <code>${m.personId}</code>` : ""}${m.active ? "" : " · <s>inactive</s>"}</li>`
      )
      .join("");
    return html(
      req,
      res,
      `<h2>Mock gate — sign in as… (stands in for GitHub)</h2><ul>${rows}</ul>` +
        `<p style="color:#666">Or use Studio's email + password form: <code>demo.member@localhost</code> / <code>demo.newcomer@localhost</code>, password <code>${DEMO_PASSWORD}</code>.</p>`
    );
  }
  if (p === "/auth/as") {
    const entry = findById(url.searchParams.get("account") ?? "");
    if (!entry) return redirect(req, res, `${STUDIO_URL}#error=not_authorized`);
    const token = encodeToken({ sub: `github:${entry.id}`, account: entry.id, email: "", method: "github" });
    return redirect(req, res, `${STUDIO_URL}#token=${encodeURIComponent(token)}`);
  }
  if (p === "/auth/login" && req.method === "POST") {
    const { email, password } = (await readJson(req)) ?? {};
    const entry = email ? findByEmail(email) : undefined;
    if (!entry || !password || !passwords.has(entry.id)) return fail(req, res, 401, "wrong_credentials");
    if ((failures.get(entry.id) ?? 0) >= LOGIN_ACCOUNT_MAX) return fail(req, res, 429, "too_many_attempts");
    if (!checkPassword(entry.id, password)) {
      failures.set(entry.id, (failures.get(entry.id) ?? 0) + 1);
      return fail(req, res, 401, "wrong_credentials");
    }
    failures.delete(entry.id);
    const token = encodeToken({
      sub: `account:${entry.id}`,
      account: entry.id,
      email: String(email).trim().toLowerCase(),
      method: "password",
      cv: credentialVersion(entry.id),
    });
    return json(req, res, { token });
  }
  // Same GET-shows-a-form / POST-sets split as the Worker, so link previews cannot burn a link.
  if (p === "/auth/set-password") {
    let token = url.searchParams.get("token") ?? "";
    let password = "";
    let confirm = "";
    if (req.method === "POST") {
      const form = new URLSearchParams(
        await new Promise((resolve) => {
          let d = "";
          req.on("data", (c) => (d += c));
          req.on("end", () => resolve(d));
        })
      );
      token = form.get("token") ?? "";
      password = form.get("password") ?? "";
      confirm = form.get("confirm") ?? "";
    }
    const account = setpwLinks.get(token);
    const entry = account ? findById(account) : undefined;
    if (!entry) {
      return html(req, res, `<h2>X-Lab Studio</h2><p>This link was already used or is not valid. Ask an admin for a new one.</p><a href="${STUDIO_URL}">Go to Studio</a>`);
    }
    const form = (error) =>
      html(
        req,
        res,
        `<h2>X-Lab Studio</h2><p>Choose a password for <strong>${entry.name}</strong>. At least 8 characters.</p>` +
          (error ? `<p style="color:#b4430e"><strong>${error}</strong></p>` : "") +
          `<form method="post"><input type="hidden" name="token" value="${token}">` +
          `<p><label>New password <input type="password" name="password" minlength="8" required></label></p>` +
          `<p><label>Type it again <input type="password" name="confirm" minlength="8" required></label></p>` +
          `<button type="submit">Set password and continue</button></form>`
      );
    if (req.method !== "POST") return form();
    if (password !== confirm) return form("The two passwords don't match.");
    if (password.length < 8) return form("Use at least 8 characters.");
    const cv = setPassword(entry.id, password);
    setpwLinks.delete(token);
    failures.delete(entry.id);
    console.log(`  password set for ${entry.id}`);
    const session = encodeToken({ sub: `account:${entry.id}`, account: entry.id, email: "", method: "password", cv });
    return redirect(req, res, `${STUDIO_URL}#token=${encodeURIComponent(session)}`);
  }
  if (p === "/auth/verify") {
    return html(req, res, `<h2>X-Lab Studio</h2><p>Studio now uses passwords instead of sign-in links. Ask an admin for a set-password link.</p><a href="${STUDIO_URL}">Go to Studio</a>`);
  }
  if (p.startsWith("/pr/")) {
    const pr = prs.find((x) => x.number === Number(p.split("/")[2]));
    return pr
      ? html(req, res, `<h2>#${pr.number} ${pr.title}</h2><pre>${pr.body}</pre><p>state: ${pr.state} · checks: ${pr.checks}</p>`)
      : fail(req, res, 404, "no such PR");
  }

  // --- authenticated ---
  const { id, error } = identityOf(sessionOf(req));
  if (!id) return fail(req, res, 401, error);

  if (p === "/me") return json(req, res, id);
  if (p === "/file" && req.method === "GET") {
    const filePath = url.searchParams.get("path") ?? "";
    if (!filePath.startsWith("content/") || filePath.includes("..") || filePath.includes("\\")) return fail(req, res, 400, "only content/ files can be read");
    const content = readRepoFile(filePath);
    if (content === undefined) return fail(req, res, 404, "no such file");
    return json(req, res, { path: filePath, content });
  }

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
      if (!canWritePath(id, f.path, !exists, existing, f.content)) return fail(req, res, 403, `you are not allowed to modify ${f.path}`);
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
    const { account } = (await readJson(req)) ?? {};
    if (!account) return fail(req, res, 400, "account is required");
    const entry = findById(account);
    if (!entry) return fail(req, res, 404, "no active roster entry with that id — has the roster change been approved?");
    const jti = randomBytes(9).toString("base64url");
    setpwLinks.set(jti, entry.id);
    return json(req, res, {
      link: `http://localhost:${PORT}/auth/set-password?token=${jti}`,
      expiresInDays: 14,
      name: entry.name,
    });
  }
  if (p === "/revoke-invites" && req.method === "POST") {
    if (id.role !== "admin") return fail(req, res, 403, "admins only");
    const { account } = (await readJson(req)) ?? {};
    if (!account) return fail(req, res, 400, "account is required");
    let revoked = 0;
    for (const [jti, a] of setpwLinks) if (a === account) (setpwLinks.delete(jti), revoked++);
    credVersions.set(account, credentialVersion(account) + 1);
    return json(req, res, { ok: true, revoked, signedOut: true });
  }

  const isMine = (body) => body.includes(`"account":"${id.account}"`) || (id.email !== "" && body.includes(`"email":"${id.email}"`));
  if (p === "/queue") {
    const open = prs.filter((x) => x.state === "open");
    const visible = canApprove(id) ? open : open.filter((x) => isMine(x.body));
    return json(req, res, { queue: visible.map(queueView) });
  }
  if (p === "/returned") {
    const closed = prs.filter((x) => x.state === "closed").reverse();
    const visible = canApprove(id) ? closed : closed.filter((x) => isMine(x.body));
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
