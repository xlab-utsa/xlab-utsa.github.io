// The roster rules that keep people from being locked out of Studio. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rosterIssues, RosterSchema, type RosterEntry } from "./roster";

const admin: RosterEntry = { email: "admin@utsa.edu", name: "Ada Admin", role: "admin", active: true };
const member: RosterEntry = {
  email: "jane@utsa.edu",
  name: "Jane Doe",
  role: "member",
  personId: "jane-doe",
  active: true,
};

const roster = (...members: RosterEntry[]) => ({ _comment: ["doc"], members });

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

  it("rejects duplicate emails, case-insensitively", () => {
    const issues = rosterIssues(roster(admin, member, { ...member, email: "JANE@utsa.edu", personId: "jane-2" }));
    assert.ok(issues.some((i) => i.index === 2 && i.field === "email"));
  });

  it("rejects two ACTIVE entries owning one profile, but allows an inactive duplicate", () => {
    const dupActive = rosterIssues(roster(admin, member, { ...member, email: "other@utsa.edu" }));
    assert.ok(dupActive.some((i) => i.index === 2 && i.field === "personId"));

    const dupInactive = rosterIssues(roster(admin, member, { ...member, email: "other@utsa.edu", active: false }));
    assert.deepEqual(dupInactive, []);
  });

  it("rejects an unknown key (a typo must fail, not vanish)", () => {
    const issues = rosterIssues({ members: [{ ...admin, githubLogin: "ada", rol: "admin" }] });
    assert.ok(issues.length > 0);
  });

  it("rejects an entry whose email is missing — the shape that used to throw inside the Worker", () => {
    const issues = rosterIssues({ members: [{ name: "Nobody", role: "admin", active: true }] });
    assert.ok(issues.some((i) => i.index === 0 && i.field === "email"));
  });
});
