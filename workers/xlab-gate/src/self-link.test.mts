// What Studio sends for a self-link (lib/studio/self-link.ts) must be exactly what this Worker
// accepts (isSelfLinkOnly). Lives here, not in lib/, so the site build never type-checks
// Worker code. Run from the repo root with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { insertSelfLink } from "../../../lib/studio/self-link.ts";
import { isSelfLinkOnly } from "./roster.js";

const paper = [
  "id: conference-2024-x",
  "category: conference",
  'title: "A: Paper"',
  "authors:",
  "  - name: J. Doe",
  "  - name: D. Liu",
  "  - name: J. Xiong",
  "    personId: jinjun-xiong",
  "year: 2024",
  "",
].join("\n");

describe("insertSelfLink", () => {
  it("adds one personId line under the chosen author, and the Worker accepts it", () => {
    const out = insertSelfLink(paper, 1, "dancheng-liu");
    assert.match(out, /  - name: D\. Liu\n    personId: dancheng-liu\n  - name: J\. Xiong/);
    assert.equal(isSelfLinkOnly(paper, out, "dancheng-liu"), true);
  });

  it("keeps CRLF files CRLF", () => {
    const crlf = paper.replace(/\n/g, "\r\n");
    const out = insertSelfLink(crlf, 0, "jane-doe");
    assert.ok(out.includes("  - name: J. Doe\r\n    personId: jane-doe\r\n"));
    assert.equal(isSelfLinkOnly(crlf, out, "jane-doe"), true);
  });

  it("refuses an author who is already linked, or one that does not exist", () => {
    assert.throws(() => insertSelfLink(paper, 2, "jane-doe"), /already linked/);
    assert.throws(() => insertSelfLink(paper, 5, "jane-doe"), /not found/);
  });
});
