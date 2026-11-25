// Link suggestions must be conservative: offer, never decide. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authorFitsPerson,
  candidatesForAuthor,
  preselect,
  suggestContributorsForProject,
  suggestPeopleForAuthors,
  suggestProjectsForPerson,
  suggestPublicationsForPerson,
} from "./suggestions";

const people = [
  { id: "dancheng-liu", name: "Dancheng Liu" },
  { id: "dan-liu", name: "Daniel Liu" },
  { id: "chenhui-xu", name: "Chenhui Xu" },
  { id: "yusuf-akemoglu", name: "Yusuf Akemoğlu", aliases: ["Y. Akemoglu"] },
];

describe("candidatesForAuthor", () => {
  it("a full name is an exact match", () => {
    const c = candidatesForAuthor("Chenhui Xu", people);
    assert.deepEqual(c.map((x) => [x.personId, x.confidence]), [["chenhui-xu", "exact"]]);
  });

  it("an initial shared by two members yields both, and neither is pre-selected", () => {
    const c = candidatesForAuthor("D. Liu", people);
    assert.deepEqual(c.map((x) => x.personId).sort(), ["dan-liu", "dancheng-liu"]);
    assert.equal(preselect(c), undefined);
  });

  it("an author string equal to a confirmed alias is an alias match, accents ignored", () => {
    const c = candidatesForAuthor("Y. Akemoglu", people);
    assert.equal(c[0].personId, "yusuf-akemoglu");
    assert.equal(c[0].confidence, "alias");
    assert.equal(preselect(c)?.personId, "yusuf-akemoglu");
  });

  it("a lone initials match is offered but a single candidate is still pre-selectable", () => {
    const c = candidatesForAuthor("C. Xu", people);
    assert.equal(c[0].confidence, "initial");
    assert.equal(preselect(c)?.personId, "chenhui-xu");
  });

  it("authorFitsPerson rejects a different person's name", () => {
    assert.equal(authorFitsPerson("J. Xiong", people[0]), false);
    assert.equal(authorFitsPerson("Dancheng Liu", people[0]), true);
  });
});

describe("suggestPublicationsForPerson", () => {
  const pubs = [
    { id: "p1", title: "One", year: 2024, authors: [{ name: "Dancheng Liu" }, { name: "J. Xiong", personId: "jinjun-xiong" }] },
    { id: "p2", title: "Two", year: 2023, authors: [{ name: "D. Liu" }] },
    { id: "p3", title: "Three", authors: [{ name: "Dancheng Liu", personId: "dancheng-liu" }] },
    { id: "p4", title: "Four", authors: [{ name: "Daniel Liu" }] },
  ];

  it("finds unlinked slots, strongest first, flags ambiguity, skips papers already linked to them", () => {
    const s = suggestPublicationsForPerson(people[0], pubs, people);
    assert.deepEqual(s.map((x) => x.publicationId), ["p1", "p2"]);
    assert.equal(s[0].confidence, "exact");
    assert.deepEqual(s[1].alsoCouldBe, ["Daniel Liu"]);
  });

  it("does not offer a slot that another member matches more strongly", () => {
    const s = suggestPublicationsForPerson(people[0], pubs, people);
    assert.equal(s.some((x) => x.publicationId === "p4"), false);
  });

  it("works for a person who is not in the people list yet (a newcomer)", () => {
    const newcomer = { id: "jane-doe", name: "Jane Doe" };
    const s = suggestPublicationsForPerson(newcomer, [{ id: "x", title: "X", authors: [{ name: "J. Doe" }] }], people);
    assert.equal(s.length, 1);
  });
});

describe("work → people", () => {
  it("suggests a member for each unlinked author, leaving linked and unknown authors out", () => {
    const s = suggestPeopleForAuthors(
      [{ name: "Chenhui Xu" }, { name: "J. Xiong", personId: "jinjun-xiong" }, { name: "A. Stranger" }],
      people
    );
    assert.deepEqual(s.map((x) => [x.authorIndex, x.suggested?.personId]), [[0, "chenhui-xu"]]);
  });

  it("suggests project contributors from the authors of its linked papers", () => {
    const s = suggestContributorsForProject(
      { id: "proj", title: "P", publicationIds: ["p1", "p2"], contributors: ["chenhui-xu"] },
      [
        { id: "p1", title: "", authors: [{ name: "C. Xu", personId: "chenhui-xu" }, { name: "D. Liu", personId: "dancheng-liu" }] },
        { id: "p2", title: "", authors: [{ name: "D. Liu", personId: "dancheng-liu" }] },
      ],
      people
    );
    assert.deepEqual(s, [{ personId: "dancheng-liu", personName: "Dancheng Liu", viaPublicationIds: ["p1", "p2"] }]);
  });

  it("suggests projects to a person through their linked papers", () => {
    const s = suggestProjectsForPerson(
      "dancheng-liu",
      [{ id: "proj", title: "P", publicationIds: ["p1"] }],
      [{ id: "p1", title: "", authors: [{ name: "D. Liu", personId: "dancheng-liu" }] }]
    );
    assert.deepEqual(s, [{ projectId: "proj", title: "P", viaPublicationIds: ["p1"] }]);
  });
});
