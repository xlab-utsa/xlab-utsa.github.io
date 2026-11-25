// The lab-role rules every page and Studio screen relies on. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  editableRoleIndex,
  isAlumni,
  isCurrentMember,
  isLabLead,
  joinedYear,
  nowAt,
  peopleGroup,
  primaryRole,
} from "./people";
import { AffiliationSchema, LabRoleSchema, PersonSchema, type LabRole } from "./schema";
import { fieldsOf } from "../studio/schema-fields";

const who = (labRoles: LabRole[]) => ({ labRoles });

describe("current vs alumni", () => {
  it("a person with a current role is a member, not alumni", () => {
    const p = who([{ role: "phd-student", current: true }]);
    assert.equal(isCurrentMember(p), true);
    assert.equal(isAlumni(p), false);
    assert.equal(peopleGroup(p), "phd");
  });

  it("a person whose roles have all ended is alumni — even with no end date recorded", () => {
    const p = who([{ role: "postdoc", current: false }]);
    assert.equal(isCurrentMember(p), false);
    assert.equal(isAlumni(p), true);
    assert.equal(peopleGroup(p), "alumni");
  });

  it("someone who stayed on (PhD → postdoc) is a current postdoc", () => {
    const p = who([
      { role: "phd-student", current: false, start: "2019", end: "2024" },
      { role: "postdoc", current: true, start: "2024" },
    ]);
    assert.equal(primaryRole(p)?.role, "postdoc");
    assert.equal(peopleGroup(p), "faculty-postdocs");
    assert.equal(joinedYear(p), 2019);
  });
});

describe("primaryRole", () => {
  it("picks the most senior current role", () => {
    const p = who([
      { role: "research-staff", current: true },
      { role: "lab-lead", current: true },
    ]);
    assert.equal(primaryRole(p)?.role, "lab-lead");
    assert.equal(isLabLead(p), true);
    assert.equal(peopleGroup(p), "lead");
  });

  it("for alumni, picks the role that ended last", () => {
    const p = who([
      { role: "masters-student", current: false, end: "2018" },
      { role: "phd-student", current: false, end: "2023" },
    ]);
    assert.equal(primaryRole(p)?.role, "phd-student");
  });

  it("groups master's and undergraduate students together, and visiting faculty with postdocs", () => {
    assert.equal(peopleGroup(who([{ role: "masters-student", current: true }])), "students");
    assert.equal(peopleGroup(who([{ role: "undergrad-student", current: true }])), "students");
    assert.equal(peopleGroup(who([{ role: "visiting-faculty", current: true }])), "faculty-postdocs");
  });

  it("editableRoleIndex points at the role a one-role form should edit", () => {
    const roles: LabRole[] = [
      { role: "phd-student", current: false, end: "2024" },
      { role: "postdoc", current: true },
    ];
    assert.equal(editableRoleIndex(roles), 1);
    assert.equal(editableRoleIndex([]), -1);
  });
});

describe("nowAt", () => {
  it("is the first affiliation that has not ended", () => {
    const a = nowAt({
      affiliations: [
        { institutionId: "ub", roleTitle: "Postdoc", endDate: "2025" },
        { organization: "Penn State", roleTitle: "Assistant Professor" },
      ],
    });
    assert.equal(a?.organization, "Penn State");
  });
});

describe("v3 schema rules", () => {
  it("rejects a role that is current but has an end date", () => {
    assert.equal(LabRoleSchema.safeParse({ role: "postdoc", current: true, end: "2025" }).success, false);
    assert.equal(LabRoleSchema.safeParse({ role: "postdoc", current: false, end: "2025" }).success, true);
  });

  it("an affiliation names its place exactly once: institution record or free-text organization", () => {
    assert.equal(AffiliationSchema.safeParse({ roleTitle: "PhD Student" }).success, false);
    assert.equal(AffiliationSchema.safeParse({ organization: "UMD", roleTitle: "PhD Student" }).success, true);
    assert.equal(AffiliationSchema.safeParse({ institutionId: "ub", roleTitle: "PhD Student" }).success, true);
    assert.equal(
      AffiliationSchema.safeParse({ institutionId: "ub", organization: "UB", roleTitle: "PhD Student" }).success,
      false
    );
  });

  it("a person needs at least one lab role, and the removed personType is rejected", () => {
    const base = { id: "jane-doe", name: "Jane Doe", roleTitle: "PhD Student" };
    assert.equal(PersonSchema.safeParse({ ...base, labRoles: [] }).success, false);
    assert.equal(PersonSchema.safeParse({ ...base, personType: "phd-student", labRoles: [{ role: "phd-student", current: true }] }).success, false);
    assert.equal(PersonSchema.safeParse({ ...base, labRoles: [{ role: "phd-student", current: true }] }).success, true);
  });

  it("Studio's generated forms still see inside the refined objects", () => {
    const fields = fieldsOf(PersonSchema);
    const labRoles = fields.find((f) => f.key === "labRoles");
    const affiliations = fields.find((f) => f.key === "affiliations");
    assert.ok(labRoles?.element?.fields?.some((f) => f.key === "current"), "labRoles item fields");
    assert.ok(affiliations?.element?.fields?.some((f) => f.key === "organization"), "affiliation item fields");
  });
});
