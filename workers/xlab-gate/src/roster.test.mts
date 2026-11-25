// Path-level authorization: who may write which file. Run from the repo root with `npm test`.
//
// These rules are the whole security model of member self-service — a member must be able
// to create and edit exactly their own profile and photo, create (never edit) contributions,
// and touch nothing else. A regression here is a privilege escalation, so every cell of the
// matrix is pinned.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canApprove, canWritePath, isSelfLinkOnly, ownsRecord, toIdentity } from "./roster.js";
import type { Identity } from "./env.js";

const admin: Identity = { sub: "a", email: "a@x.edu", name: "A", role: "admin" };
const editor: Identity = { sub: "e", email: "e@x.edu", name: "E", role: "editor" };
const member: Identity = { sub: "m", email: "m@x.edu", name: "M", role: "member", personId: "jane-doe" };
const unlinked: Identity = { sub: "u", email: "u@x.edu", name: "U", role: "member" };

describe("canWritePath", () => {
  it("admins may write anything the Worker's prefix allowlist admits", () => {
    for (const p of ["content/people/x.yaml", "access/roster.json", "public/images/people/x.png"]) {
      assert.equal(canWritePath(admin, p, false), true, p);
    }
  });

  it("editors may write content and images but never the roster", () => {
    assert.equal(canWritePath(editor, "content/people/x.yaml", false), true);
    assert.equal(canWritePath(editor, "public/images/people/x.png", true), true);
    assert.equal(canWritePath(editor, "access/roster.json", false), false);
  });

  it("members may create AND edit exactly their own profile and photo", () => {
    for (const isCreate of [true, false]) {
      assert.equal(canWritePath(member, "content/people/jane-doe.yaml", isCreate), true);
      assert.equal(canWritePath(member, "public/images/people/jane-doe.png", isCreate), true);
      assert.equal(canWritePath(member, "public/images/people/jane-doe.jpg", isCreate), true);
    }
  });

  it("members may never touch another person's profile, by any spelling", () => {
    for (const p of [
      "content/people/john-roe.yaml",
      "content/people/jane-doe-2.yaml",
      "content/people/jane-doe.yaml.bak",
      "public/images/people/john-roe.png",
      "public/images/people/jane-doe.webp",
    ]) {
      assert.equal(canWritePath(member, p, true), false, p);
      assert.equal(canWritePath(member, p, false), false, p);
    }
  });

  it("members may CREATE publications, awards, posts and projects", () => {
    for (const dir of ["content/publications", "content/recognitions", "content/posts", "content/projects"]) {
      assert.equal(canWritePath(member, `${dir}/new-thing.yaml`, true), true, dir);
    }
  });

  it("members may EDIT an existing contribution only when its current content names them", () => {
    const mine = "id: x\nauthors:\n  - name: Jane Doe\n    personId: jane-doe\n  - name: Someone\n";
    const notMine = "id: x\nauthors:\n  - name: Someone\n    personId: john-roe\n";
    for (const dir of ["content/publications", "content/recognitions", "content/posts"]) {
      assert.equal(canWritePath(member, `${dir}/old-thing.yaml`, false, mine), true, dir);
      assert.equal(canWritePath(member, `${dir}/old-thing.yaml`, false, notMine), false, dir);
      // No content available (file missing but not flagged as create) → no.
      assert.equal(canWritePath(member, `${dir}/old-thing.yaml`, false), false, dir);
    }
    // v3: a project is editable by its contributors, and only by them.
    assert.equal(canWritePath(member, "content/projects/p.yaml", false, "contributors:\n  - jane-doe\n"), true);
    assert.equal(canWritePath(member, "content/projects/p.yaml", false, "contributors:\n  - john-roe\n"), false);
    // Ownership never extends to another person's profile, even when the file names them.
    assert.equal(canWritePath(member, "content/people/john-roe.yaml", false, "personId: jane-doe\n"), false);
  });

  it("members may not create anything else", () => {
    for (const p of ["content/themes/x.yaml", "content/venues/x.yaml", "content/gallery/x.yaml", "content/site.yaml", "access/roster.json"]) {
      assert.equal(canWritePath(member, p, true), false, p);
    }
  });

  it("a member with no linked profile may write nothing at all", () => {
    assert.equal(canWritePath(unlinked, "content/people/undefined.yaml", true), false);
    assert.equal(canWritePath(unlinked, "content/publications/new.yaml", true), false);
  });
});

describe("ownsRecord", () => {
  it("matches personId/authorId lines in every YAML spelling the serializer or a human produces", () => {
    for (const content of [
      "personId: jane-doe\n",
      "authorId: jane-doe\n",
      "  - personId: jane-doe\n",
      "authors:\n  - name: J\n    personId: jane-doe\n",
      'personId: "jane-doe"\n',
      "personId: 'jane-doe'  # the member\n",
      "---\nauthorId: jane-doe\n---\n\nbody",
    ]) {
      assert.equal(ownsRecord(content, "jane-doe"), true, JSON.stringify(content));
    }
  });

  it("never matches a longer id, a different key, or the id in prose", () => {
    for (const content of [
      "personId: jane-doe-2\n",
      "personId: not-jane-doe\n",
      "relatedPersonId: jane-doe\n",
      "note: thanks to jane-doe\n",
      "title: personId: jane-doe\n",
      "personId: jane-doe extra\n",
    ]) {
      assert.equal(ownsRecord(content, "jane-doe"), false, JSON.stringify(content));
    }
  });
});

describe("ownsRecord — v3 owner lists", () => {
  it("an id listed under authorIds or contributors owns the record, in block or flow style", () => {
    for (const content of [
      "authorIds:\n  - jane-doe\n",
      "authorIds:\n  - john-roe\n  - jane-doe\n",
      "authorIds:\n- jane-doe\n",
      'contributors:\n  - john-roe\n  - "jane-doe"\n',
      "authorIds: [jane-doe]\n",
      "authorIds: [john-roe, jane-doe]\n",
      "---\nkind: blog\nauthorIds:\n  - jane-doe\ntags:\n  - AI\n---\n\nbody",
    ]) {
      assert.equal(ownsRecord(content, "jane-doe"), true, JSON.stringify(content));
    }
  });

  it("being mentioned, or listed under any other key, does not", () => {
    for (const content of [
      "mentions:\n  personIds:\n    - jane-doe\n",
      "tags:\n  - jane-doe\n",
      "personIds: [jane-doe]\n",
      "authorIds:\n  - jane-doe-2\n",
      "authorIds: [jane-doe-2]\n",
    ]) {
      assert.equal(ownsRecord(content, "jane-doe"), false, JSON.stringify(content));
    }
  });
});

describe("self-linking (SPEC.md §9.3)", () => {
  const paper = "id: p\ntitle: T\nauthors:\n  - name: J. Doe\n  - name: J. Xiong\n    personId: jinjun-xiong\nyear: 2024\n";
  const claimed = "id: p\ntitle: T\nauthors:\n  - name: J. Doe\n    personId: jane-doe\n  - name: J. Xiong\n    personId: jinjun-xiong\nyear: 2024\n";

  it("lets a member add their own id under an unlinked author, and nothing else", () => {
    assert.equal(isSelfLinkOnly(paper, claimed, "jane-doe"), true);
    assert.equal(isSelfLinkOnly(paper.replace(/\n/g, "\r\n"), claimed, "jane-doe"), true);
    assert.equal(canWritePath(member, "content/publications/p.yaml", false, paper, claimed), true);
  });

  it("refuses any other change riding along", () => {
    assert.equal(isSelfLinkOnly(paper, claimed.replace("title: T", "title: Mine now"), "jane-doe"), false);
    assert.equal(isSelfLinkOnly(paper, claimed + "featured: true\n", "jane-doe"), false);
    assert.equal(isSelfLinkOnly(paper, paper, "jane-doe"), false);
  });

  it("refuses linking someone else, or taking over a slot that is already linked", () => {
    assert.equal(isSelfLinkOnly(paper, claimed.replace("personId: jane-doe", "personId: john-roe"), "jane-doe"), false);
    const takeover = paper.replace("  - name: J. Xiong\n", "  - name: J. Xiong\n    personId: jane-doe\n");
    assert.equal(isSelfLinkOnly(paper, takeover, "jane-doe"), false);
  });

  it("refuses a personId line that is not directly under an author name", () => {
    assert.equal(isSelfLinkOnly(paper, paper.replace("year: 2024", "personId: jane-doe\nyear: 2024"), "jane-doe"), false);
  });

  it("applies to publications only", () => {
    const award = "id: a\naward: Best Paper\n";
    assert.equal(canWritePath(member, "content/recognitions/a.yaml", false, award, award + "personId: jane-doe\n"), false);
  });
});

describe("canApprove / toIdentity", () => {
  it("only admins and editors review", () => {
    assert.equal(canApprove(admin), true);
    assert.equal(canApprove(editor), true);
    assert.equal(canApprove(member), false);
  });

  it("identity is rebuilt from the roster entry, keeping the sign-in subject", () => {
    const id = toIdentity(
      { email: "Jane@X.edu", name: "Jane", role: "member", personId: "jane-doe", active: true },
      "github:jane"
    );
    assert.deepEqual(id, { sub: "github:jane", email: "Jane@X.edu", name: "Jane", role: "member", personId: "jane-doe" });
    assert.equal(toIdentity({ email: "Jane@X.edu", name: "Jane", role: "admin", active: true }).sub, "jane@x.edu");
  });
});
