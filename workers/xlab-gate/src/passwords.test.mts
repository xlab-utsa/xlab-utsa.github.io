// Password hashing and policy (SPEC.md §8.4). Run from the repo root with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkPassword, makePasswordRecord, passwordProblem, PBKDF2_ITERATIONS } from "./passwords.js";

describe("password records", () => {
  it("accept the right password and reject a wrong one", async () => {
    const record = await makePasswordRecord("correct horse battery", 3);
    assert.equal(record.iterations, PBKDF2_ITERATIONS);
    assert.equal(record.version, 3);
    assert.equal(await checkPassword("correct horse battery", record), true);
    assert.equal(await checkPassword("correct horse batterY", record), false);
  });

  it("never store the password, and salt every record differently", async () => {
    const a = await makePasswordRecord("correct horse battery", 1);
    const b = await makePasswordRecord("correct horse battery", 1);
    assert.equal(JSON.stringify(a).includes("correct horse"), false);
    assert.notEqual(a.salt, b.salt);
    assert.notEqual(a.hash, b.hash);
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
    assert.ok(passwordProblem("jinjun xiong", ["Jinjun Xiong"]));
    assert.equal(passwordProblem("tide-pool-lantern", ["Jinjun Xiong"]), undefined);
  });
});
