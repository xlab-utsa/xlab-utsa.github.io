// Password and address hashing (SPEC.md §8.4). Run from the repo root with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkPassword,
  hashEmail,
  makePasswordRecord,
  passwordProblem,
  PBKDF2_ITERATIONS,
} from "./passwords.js";
import { EMAIL_HASH_RE } from "../../../lib/access/roster.ts";

const SECRET = "test-email-hash-secret-0123456789";
const PEPPER = "test-pepper-0123456789abcdef";

describe("hashEmail", () => {
  it("is stable, ignores case and surrounding space, and matches the roster's format", async () => {
    const a = await hashEmail("Jane.Doe@UTSA.edu ", SECRET);
    assert.equal(a, await hashEmail("jane.doe@utsa.edu", SECRET));
    assert.match(a, EMAIL_HASH_RE);
  });

  it("depends on the secret and on the address", async () => {
    assert.notEqual(await hashEmail("jane@x.edu", SECRET), await hashEmail("jane@x.edu", SECRET + "x"));
    assert.notEqual(await hashEmail("jane@x.edu", SECRET), await hashEmail("john@x.edu", SECRET));
  });

  it("refuses to run without a secret", async () => {
    await assert.rejects(() => hashEmail("jane@x.edu", ""));
  });
});

describe("password records", () => {
  it("accept the right password and reject a wrong one", async () => {
    const record = await makePasswordRecord("correct horse battery", PEPPER, 3);
    assert.equal(record.iterations, PBKDF2_ITERATIONS);
    assert.equal(record.version, 3);
    assert.equal(await checkPassword("correct horse battery", record, PEPPER), true);
    assert.equal(await checkPassword("correct horse batterY", record, PEPPER), false);
  });

  it("never store the password, and salt every record differently", async () => {
    const a = await makePasswordRecord("correct horse battery", PEPPER, 1);
    const b = await makePasswordRecord("correct horse battery", PEPPER, 1);
    assert.equal(JSON.stringify(a).includes("correct horse"), false);
    assert.notEqual(a.salt, b.salt);
    assert.notEqual(a.hash, b.hash);
  });

  it("are useless without the pepper", async () => {
    const record = await makePasswordRecord("correct horse battery", PEPPER, 1);
    assert.equal(await checkPassword("correct horse battery", record, "a-different-pepper"), false);
  });
});

describe("passwordProblem", () => {
  it("requires 8 characters", () => {
    assert.match(passwordProblem("short1") ?? "", /8 characters/);
    assert.equal(passwordProblem("eight888x"), undefined);
  });

  it("rejects the most common passwords, repeated characters, and the person's own name", () => {
    assert.ok(passwordProblem("Password123"));
    assert.ok(passwordProblem("aaaaaaaaaa"));
    assert.ok(passwordProblem("Jinjun Xiong".toLowerCase(), ["Jinjun Xiong"]));
    assert.equal(passwordProblem("tide-pool-lantern", ["Jinjun Xiong"]), undefined);
  });
});
