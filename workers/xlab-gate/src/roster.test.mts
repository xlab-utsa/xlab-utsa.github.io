// Path-level authorization: who may write which file. Run from the repo root with `npm test`.
//
// These rules are the whole security model of member self-service — a member must be able
// to create and edit exactly their own profile and photo, create (never edit) contributions,
// and touch nothing else. A regression here is a privilege escalation, so every cell of the
// matrix is pinned.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canApprove, canWritePath, ownsRecord, toIdentity } from "./roster.js";
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

  it("members may CREATE publications, awards and posts", () => {
    for (const dir of ["content/publications", "content/recognitions", "content/posts"]) {
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
    // Ownership never extends to other collections, even when the file names them.
    assert.equal(canWritePath(member, "content/projects/p.yaml", false, "contributors:\n  - jane-doe\n"), false);
    assert.equal(canWritePath(member, "content/people/john-roe.yaml", false, "personId: jane-doe\n"), false);
  });

  it("members may not create anything else", () => {
    for (const p of ["content/projects/x.yaml", "content/themes/x.yaml", "content/site.yaml", "access/roster.json"]) {
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
