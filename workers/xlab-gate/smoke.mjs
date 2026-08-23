#!/usr/bin/env node
// Post-deploy smoke test. Runs automatically as part of `npm run deploy`.
//
// Every check here exists because the corresponding bug actually shipped and broke Studio
// for the site's owner. They are cheap, they run in seconds, and they catch the class of
// failure that is hardest to diagnose from the browser — where a CORS message is shown for
// problems that have nothing to do with CORS.
//
//   1. PREFLIGHT — an unauthenticated OPTIONS must return 2xx. If it reaches the router it
//      matches a path, fails the session check, returns 401, and the browser then refuses
//      the real request with "Response to preflight request doesn't pass access control
//      check". Shipped once, by dropping the OPTIONS branch during a refactor.
//
//   2. ERROR RESPONSES CARRY CORS — an error that escapes the Worker's catch is served by
//      Cloudflare's own error page, which has no CORS headers, so the browser reports a
//      CORS failure and the real message is invisible. Shipped once, via
//      `try { return handler() }` without an await.
//
//   3. HEALTH — the GitHub App credential and the roster still resolve.
import process from "node:process";

const GATE = process.env.GATE_URL ?? "https://xlab-gate.xlab-studio.workers.dev";
const ORIGIN = process.env.SITE_ORIGIN ?? "https://xlab-utsa.github.io";
const ENDPOINTS = [
  "/queue",
  "/approve",
  "/submit",
  "/roster",
  "/invite",
  "/revoke-invites",
  "/me",
  "/status",
  "/health",
];

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log(`\nSmoke-testing ${GATE}\n`);

// 1. Preflight must succeed without credentials.
for (const path of ENDPOINTS) {
  const res = await fetch(`${GATE}${path}`, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  const allowed = res.headers.get("access-control-allow-origin");
  check(
    `preflight ${path}`,
    res.status >= 200 && res.status < 300 && allowed === ORIGIN,
    `status ${res.status}, allow-origin ${allowed ?? "(none)"}`
  );
}

// 2. Failures must still be readable by the browser.
for (const [method, path] of [
  ["GET", "/me"],
  ["POST", "/approve"],
  ["GET", "/no-such-endpoint"],
]) {
  const res = await fetch(`${GATE}${path}`, {
    method,
    headers: { Origin: ORIGIN, Authorization: "Bearer definitely-not-valid" },
  });
  check(
    `error response ${method} ${path} carries CORS`,
    res.headers.get("access-control-allow-origin") === ORIGIN,
    `status ${res.status}`
  );
}

// 3. Dependencies still wired up.
const health = await fetch(`${GATE}/health`).then((r) => r.json());
check("github app credential", health.checks?.github === "ok", health.checks?.github);
check("roster readable", health.checks?.roster === "ok", health.checks?.roster);

console.log(failures === 0 ? "\nAll checks passed\n" : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
