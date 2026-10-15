// Suggestions must come from real lab data, never be invented. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initialsOf, profileRecommendations } from "./recommendations";
import { personCompleteness, profileTodos } from "./records";
import type { Person } from "@/lib/content/schema";

const person = (over: Partial<Person>): Person =>
  ({ id: "x", name: "X", personType: "phd-student", roleTitle: "PhD Student", status: "published", ...over }) as Person;

const content = {
  institutions: [{ id: "utsa", name: "The University of Texas at San Antonio", shortName: "UTSA" }, { id: "ub", name: "University at Buffalo", shortName: "UB" }],
  siteMeta: { primaryInstitutionId: "utsa" } as never,
  people: [
    person({ id: "a", name: "A One", affiliations: [{ institutionId: "ub", department: "Computer Science & Engineering", roleTitle: "PhD Student" }], links: { scholar: "https://s/a", email: "a@x" }, bio: "A One works on efficient inference for large models on edge devices, with a focus on compilers." }),
    person({ id: "b", name: "B Two", affiliations: [{ institutionId: "ub", department: "Computer Science & Engineering", roleTitle: "PhD Student" }], links: { scholar: "https://s/b" } }),
    person({ id: "c", name: "C Three", personType: "postdoc", roleTitle: "Postdoc", affiliations: [{ institutionId: "utsa", department: "College of AI", roleTitle: "Postdoc" }], links: { website: "https://c" } }),
  ],
};

describe("profileRecommendations", () => {
  it("suggests the department and institution most peers of the same position use", () => {
    const r = profileRecommendations({ id: "new", name: "New Person", personType: "phd-student" }, content);
    assert.equal(r.department, "Computer Science & Engineering");
    assert.equal(r.institutionId, "ub");
    assert.equal(r.institutionName, "UB");
    assert.equal(r.titleLine, "PhD Student, Computer Science & Engineering");
  });

  it("falls back to the whole lab, then the site's primary institution", () => {
    const r = profileRecommendations({ id: "new", name: "New", personType: "research-staff" }, content);
    assert.equal(r.department, "Computer Science & Engineering");
    const empty = profileRecommendations({ id: "new", name: "New" }, { ...content, people: [] });
    assert.equal(empty.institutionId, "utsa");
    assert.equal(empty.titleLine, undefined);
    assert.equal(empty.bioExample, undefined);
  });

  it("offers a real lab-mate's bio as the example and a starter with the member's first name", () => {
    const r = profileRecommendations({ id: "new", name: "Jane Q. Doe" }, content);
    assert.equal(r.bioExample?.name, "A One");
    assert.equal(r.bioStarter, "Jane works on ");
  });

  it("counts which links lab-mates list, excluding the member themself", () => {
    const r = profileRecommendations({ id: "a", name: "A One" }, content);
    assert.equal(r.memberCount, 2);
    assert.equal(r.linkCounts.scholar, 1);
    assert.equal(r.linkCounts.website, 1);
    assert.equal(r.linkCounts.email, 0);
    assert.ok(r.topLink === "scholar" || r.topLink === "website");
  });
});

describe("profileTodos / personCompleteness", () => {
  it("agree with each other", () => {
    const p = person({ photo: "/images/people/x.png", bio: "b", links: { email: "e@x", scholar: "s" } });
    const todos = profileTodos(p);
    assert.equal(todos.filter((t) => t.done).length, 5);
    assert.equal(personCompleteness(p), Math.round((5 / 7) * 100));
  });
});

describe("initialsOf", () => {
  it("uses first and last name, tolerates one name and nothing", () => {
    assert.equal(initialsOf("Jane Q. Doe"), "JD");
    assert.equal(initialsOf("Plato"), "P");
    assert.equal(initialsOf(""), "?");
  });
});
