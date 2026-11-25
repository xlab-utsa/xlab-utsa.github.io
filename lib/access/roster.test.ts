// The roster rules that keep people from being locked out of Studio. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rosterIssues, rosterWarnings, RosterSchema, suggestAccountId } from "./roster";

const H = (c: string) => `hmac-sha256:${c.repeat(43)}`;

const admin = { id: "ada-admin", name: "Ada Admin", role: "admin" as const, emailHashes: [H("A")], active: true };
const member = {
  id: "jane-doe",
  name: "Jane Doe",
  role: "member" as const,
  emailHashes: [H("J")],
  personId: "jane-doe",
  active: true,
};

const roster = (...members: object[]) => ({ _comment: ["doc"], members });

describe("roster schema", () => {
  it("accepts a sane roster", () => {
    assert.deepEqual(rosterIssues(roster(admin, member)), []);
    assert.ok(RosterSchema.safeParse(roster(admin, member)).success);
  });

  it("rejects a roster with no active admin — the lock-out case", () => {
    const issues = rosterIssues(roster({ ...admin, active: false }, member));
    assert.ok(issues.some((i) => i.index === undefined && /active admin/.test(i.message)));
  });

  it("rejects a member without a profile id", () => {
    const issues = rosterIssues(roster(admin, { ...member, personId: undefined }));
    assert.deepEqual(
      issues.map((i) => [i.index, i.field]),
      [[1, "personId"]]
    );
  });

  it("rejects a profile id that is not a slug (it becomes a filename)", () => {
    const issues = rosterIssues(roster(admin, { ...member, personId: "Jane Doe" }));
    assert.ok(issues.some((i) => i.index === 1 && i.field === "personId" && /kebab/.test(i.message)));
  });

  it("rejects duplicate account ids and the same address on two entries", () => {
    const dupId = rosterIssues(roster(admin, member, { ...member, emailHashes: [H("K")], personId: "jane-2" }));
    assert.ok(dupId.some((i) => i.index === 2 && i.field === "id"));
    const dupAddress = rosterIssues(roster(admin, member, { ...member, id: "jane-2", personId: "jane-2" }));
    assert.ok(dupAddress.some((i) => i.index === 2 && i.field === "emailHashes"));
  });

  it("rejects two ACTIVE entries owning one profile, but allows an inactive duplicate", () => {
    const other = { ...member, id: "jane-old", emailHashes: [H("O")] };
    const dupActive = rosterIssues(roster(admin, member, other));
    assert.ok(dupActive.some((i) => i.index === 2 && i.field === "personId"));
    assert.deepEqual(rosterIssues(roster(admin, member, { ...other, active: false })), []);
  });

  it("rejects an unknown key (a typo must fail, not vanish)", () => {
    const issues = rosterIssues({ members: [{ ...admin, githubLogin: "ada", rol: "admin" }] });
    assert.ok(issues.length > 0);
  });

  it("rejects an entry with no way to sign in, and anything that is not a real hash", () => {
    const none = rosterIssues(roster({ ...admin, emailHashes: [] }));
    assert.ok(none.some((i) => i.index === 0 && i.field === "emailHashes"));
    const fake = rosterIssues(roster({ ...admin, emailHashes: ["jane@utsa.edu"] }));
    assert.ok(fake.some((i) => i.index === 0 && i.field === "emailHashes"));
  });

  it("accepts a legacy plain-text address but warns that it is public", () => {
    const legacy = roster({ id: "ada-admin", name: "Ada Admin", role: "admin", email: "ada@utsa.edu", active: true });
    assert.deepEqual(rosterIssues(legacy), []);
    assert.equal(rosterWarnings(legacy).length, 1);
    assert.deepEqual(rosterWarnings(roster(admin, member)), []);
  });

  it("suggests an account id from the profile id, else the name", () => {
    assert.equal(suggestAccountId("Jane Doe", "jane-doe"), "jane-doe");
    assert.equal(suggestAccountId("Sri Bhargava Bhamidi"), "sri-bhargava-bhamidi");
    assert.equal(suggestAccountId("Yusuf Akemoğlu"), "yusuf-akemoglu");
  });
});
