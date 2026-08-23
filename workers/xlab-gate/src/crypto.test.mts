// Smoke test for the security-critical primitives. Run from workers/xlab-gate:
//   npx --yes tsx src/crypto.test.mts
//
// Not a full test suite — it covers the two things that silently break in production if
// wrong: token forgery/expiry, and importing the PKCS#1 key GitHub actually hands out.
import { generateKeyPairSync } from "node:crypto";
import { appJwt, signToken, verifyToken, b64urlDecode } from "./crypto.js";

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}

const SECRET = "test-secret-not-used-anywhere-real";

// --- session tokens ---
const token = await signToken({ sub: "a@b.c", role: "admin", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
check("valid token round-trips", (await verifyToken<{ sub: string }>(token, SECRET))?.sub === "a@b.c");
check("wrong secret is rejected", (await verifyToken(token, "other-secret")) === undefined);

const [body, sig] = token.split(".");
check("tampered payload is rejected", (await verifyToken(`${body}x.${sig}`, SECRET)) === undefined);
check("tampered signature is rejected", (await verifyToken(`${body}.${sig.slice(0, -2)}aa`, SECRET)) === undefined);
check("malformed token is rejected", (await verifyToken("garbage", SECRET)) === undefined);

const expired = await signToken({ sub: "x", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
check("expired token is rejected", (await verifyToken(expired, SECRET)) === undefined);

// A token with no exp must still verify — magic-link payloads always set one, but session
// verification must not silently accept a forged token that simply omits the field.
const noExp = await signToken({ sub: "x" }, SECRET);
check("token without exp still verifies signature", (await verifyToken(noExp, SECRET)) !== undefined);

// --- GitHub App key handling ---
// GitHub issues PKCS#1 ("BEGIN RSA PRIVATE KEY"); Web Crypto only imports PKCS#8.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs1Pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const pkcs8Pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

check("PEM is really PKCS#1", pkcs1Pem.includes("BEGIN RSA PRIVATE KEY"));

try {
  const jwt = await appJwt("123456", pkcs1Pem);
  const parts = jwt.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  check("PKCS#1 key signs a JWT", parts.length === 3);
  check("JWT header is RS256", header.alg === "RS256" && header.typ === "JWT");
  check("JWT issuer is the app id", payload.iss === "123456");
  check("JWT expiry is under GitHub's 10-minute limit", payload.exp - payload.iat <= 600);
} catch (err) {
  check(`PKCS#1 key signs a JWT (${err})`, false);
}

try {
  await appJwt("123456", pkcs8Pem);
  check("PKCS#8 key also works", true);
} catch (err) {
  check(`PKCS#8 key also works (${err})`, false);
}

console.log(failures === 0 ? "\nAll checks passed\n" : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
