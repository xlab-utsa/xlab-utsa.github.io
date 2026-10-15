// The security-critical primitives. Run from the repo root with `npm test`
// (or here: `npx --yes tsx --test src/crypto.test.mts`).
//
// Covers the two things that silently break in production if wrong: token forgery/expiry,
// and importing the PKCS#1 key GitHub actually hands out.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { appJwt, signToken, verifyToken, b64urlDecode } from "./crypto.js";

const SECRET = "test-secret-not-used-anywhere-real";
const decode = (part: string) => JSON.parse(new TextDecoder().decode(b64urlDecode(part)));

describe("session tokens", () => {
  it("round-trip with the right secret", async () => {
    const token = await signToken({ sub: "a@b.c", role: "admin", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
    assert.equal((await verifyToken<{ sub: string }>(token, SECRET))?.sub, "a@b.c");
  });

  it("reject the wrong secret, a tampered payload, a tampered signature and garbage", async () => {
    const token = await signToken({ sub: "a@b.c", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
    const [body, sig] = token.split(".");
    assert.equal(await verifyToken(token, "other-secret"), undefined);
    assert.equal(await verifyToken(`${body}x.${sig}`, SECRET), undefined);
    assert.equal(await verifyToken(`${body}.${sig.slice(0, -2)}aa`, SECRET), undefined);
    assert.equal(await verifyToken("garbage", SECRET), undefined);
    assert.equal(await verifyToken("", SECRET), undefined);
  });

  it("reject an expired token", async () => {
    const expired = await signToken({ sub: "x", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
    assert.equal(await verifyToken(expired, SECRET), undefined);
  });

  it("still verify the signature of a token with no exp", async () => {
    // Magic-link payloads always set one; this pins that a forged token cannot slip past by
    // simply omitting the field — the signature check runs regardless.
    const noExp = await signToken({ sub: "x" }, SECRET);
    assert.notEqual(await verifyToken(noExp, SECRET), undefined);
    assert.equal(await verifyToken(noExp, "other"), undefined);
  });
});

describe("GitHub App key handling", () => {
  // GitHub issues PKCS#1 ("BEGIN RSA PRIVATE KEY"); Web Crypto only imports PKCS#8.
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pkcs1Pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  const pkcs8Pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("signs an RS256 JWT with the PKCS#1 key GitHub hands out", async () => {
    assert.ok(pkcs1Pem.includes("BEGIN RSA PRIVATE KEY"));
    const parts = (await appJwt("123456", pkcs1Pem)).split(".");
    assert.equal(parts.length, 3);
    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    assert.equal(header.alg, "RS256");
    assert.equal(header.typ, "JWT");
    assert.equal(payload.iss, "123456");
    assert.ok(payload.exp - payload.iat <= 600, "JWT expiry is under GitHub's 10-minute limit");
  });

  it("also accepts a PKCS#8 key", async () => {
    assert.equal((await appJwt("123456", pkcs8Pem)).split(".").length, 3);
  });
});
