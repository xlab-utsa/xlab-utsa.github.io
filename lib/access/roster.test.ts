// The roster rules that keep people from being locked out of Studio. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rosterIssues, RosterSchema, suggestAccountId } from "./roster";

const admin = { id: "ada-admin", name: "Ada Admin", email: "admin@utsa.edu", role: "admin" as const, active: true };
const member = {
  id: "jane-doe",
  name: "Jane Doe",
  email: "jane@utsa.edu",
  role: "member" as const,
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

  it("rejects duplicate account ids, and duplicate emails case-insensitively", () => {
    const dupId = rosterIssues(roster(admin, member, { ...member, email: "other@utsa.edu", personId: "jane-2" }));
    assert.ok(dupId.some((i) => i.index === 2 && i.field === "id"));
    const dupEmail = rosterIssues(roster(admin, member, { ...member, id: "jane-2", email: "JANE@utsa.edu", personId: "jane-2" }));
    assert.ok(dupEmail.some((i) => i.index === 2 && i.field === "email"));
  });

  it("rejects two ACTIVE entries owning one profile, but allows an inactive duplicate", () => {
    const other = { ...member, id: "jane-old", email: "other@utsa.edu" };
    const dupActive = rosterIssues(roster(admin, member, other));
    assert.ok(dupActive.some((i) => i.index === 2 && i.field === "personId"));
    assert.deepEqual(rosterIssues(roster(admin, member, { ...other, active: false })), []);
  });

  it("rejects an unknown key (a typo must fail, not vanish)", () => {
    const issues = rosterIssues({ members: [{ ...admin, githubLogin: "ada", rol: "admin" }] });
    assert.ok(issues.length > 0);
  });

  it("rejects an entry whose email or account id is missing", () => {
    const issues = rosterIssues({ members: [{ name: "Nobody", role: "admin", active: true }] });
    assert.ok(issues.some((i) => i.index === 0 && i.field === "email"));
    assert.ok(issues.some((i) => i.index === 0 && i.field === "id"));
  });

  it("suggests an account id from the profile id, else the name", () => {
    assert.equal(suggestAccountId("Jane Doe", "jane-doe"), "jane-doe");
    assert.equal(suggestAccountId("Sri Bhargava Bhamidi"), "sri-bhargava-bhamidi");
    assert.equal(suggestAccountId("Yusuf Akemoğlu"), "yusuf-akemoglu");
  });
});
