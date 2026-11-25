#!/usr/bin/env node
// One-shot migration: content/ schema v2 -> schema v3 (SPEC.md §4.2).
//
// What it changes, in place:
//   * people:   `personType` + `labTenure` -> `labRoles: [{ role, current, start?, end? }]`.
//               A person with `labTenure.leftYear` becomes a past role ending that year;
//               everyone else gets one current role. `grad-collaborator` (removed in v3) is
//               refused rather than guessed at.
//   * projects: `links.publicationId` -> `publicationIds: [..]`.
//   * posts:    `authorId` -> `authorIds: [..]`; `relatedPublicationId` ->
//               `mentions.publicationIds: [..]`.
//
// Edits go through yaml's Document API, so a record's untouched lines — block scalars,
// quoting, key order — come out byte-identical and the diff shows only what changed.
//
// Idempotent: a record already in v3 shape is skipped. Run from the repo root:
//   npm run migrate:content:v3            # write
//   npm run migrate:content:v3 -- --check # report what would change, write nothing
import fs from "node:fs";
import path from "node:path";
import { isMap, parseDocument, Pair, Scalar } from "yaml";

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, "content");
const CHECK = process.argv.includes("--check");

const changed = [];
const problems = [];

/** Insert `key: value` into a map right after `afterKey` (or at the end). */
function insertAfter(doc, map, afterKey, key, value) {
  const node = doc.createNode(value);
  const pair = new Pair(new Scalar(key), node);
  const idx = map.items.findIndex((p) => String(p.key?.value ?? p.key) === afterKey);
  if (idx === -1) map.items.push(pair);
  else map.items.splice(idx + 1, 0, pair);
}

function plain(node) {
  return node && typeof node.toJSON === "function" ? node.toJSON() : node;
}

// --- people --------------------------------------------------------------------

function migratePerson(doc, file) {
  const map = doc.contents;
  if (map.has("labRoles")) return false;
  const role = map.get("personType");
  if (!role) {
    problems.push(`${file}: no personType — cannot derive labRoles`);
    return false;
  }
  if (role === "grad-collaborator") {
    problems.push(`${file}: personType grad-collaborator was removed in v3 — choose a lab role by hand`);
    return false;
  }
  const tenure = plain(map.get("labTenure")) ?? {};
  const entry = { role, current: tenure.leftYear === undefined || tenure.leftYear === null };
  if (tenure.joinedYear !== undefined) entry.start = String(tenure.joinedYear);
  if (!entry.current) entry.end = String(tenure.leftYear);

  insertAfter(doc, map, "name", "labRoles", [entry]);
  map.delete("personType");
  map.delete("labTenure");
  return true;
}

// --- projects ------------------------------------------------------------------

function migrateProject(doc) {
  const map = doc.contents;
  const links = map.get("links");
  const pubId = isMap(links) ? links.get("publicationId") : undefined;
  if (!pubId) return false;
  const existing = plain(map.get("publicationIds")) ?? [];
  const ids = existing.includes(pubId) ? existing : [...existing, pubId];
  links.delete("publicationId");
  if (links.items.length === 0) map.delete("links");
  if (map.has("publicationIds")) map.set("publicationIds", doc.createNode(ids));
  else insertAfter(doc, map, "thumbnail", "publicationIds", ids);
  return true;
}

// --- posts (.mdx frontmatter) ----------------------------------------------------

function migratePostFrontmatter(doc) {
  const map = doc.contents;
  let touched = false;
  const authorId = map.get("authorId");
  if (authorId) {
    insertAfter(doc, map, "authorId", "authorIds", [authorId]);
    map.delete("authorId");
    touched = true;
  }
  const related = map.get("relatedPublicationId");
  if (related) {
    insertAfter(doc, map, "relatedPublicationId", "mentions", { publicationIds: [related] });
    map.delete("relatedPublicationId");
    touched = true;
  }
  return touched;
}

// --- driver --------------------------------------------------------------------

function eachFile(dir, ext) {
  const full = path.join(CONTENT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => path.join(full, f));
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function processYaml(dir, migrate) {
  for (const file of eachFile(dir, ".yaml")) {
    const text = fs.readFileSync(file, "utf-8");
    const doc = parseDocument(text);
    if (!isMap(doc.contents)) continue;
    if (migrate(doc, rel(file))) {
      changed.push(rel(file));
      if (!CHECK) fs.writeFileSync(file, doc.toString({ lineWidth: 0 }), "utf-8");
    }
  }
}

function processMdx(dir, migrate) {
  for (const file of eachFile(dir, ".mdx")) {
    const text = fs.readFileSync(file, "utf-8");
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)$/);
    if (!m) {
      problems.push(`${rel(file)}: no frontmatter block`);
      continue;
    }
    const doc = parseDocument(m[1]);
    if (!isMap(doc.contents)) continue;
    if (migrate(doc, rel(file))) {
      changed.push(rel(file));
      const fm = doc.toString({ lineWidth: 0 }).trimEnd();
      if (!CHECK) fs.writeFileSync(file, `---\n${fm}\n---${m[2]}`, "utf-8");
    }
  }
}

processYaml("people", migratePerson);
processYaml("projects", migrateProject);
processMdx("posts", migratePostFrontmatter);

console.log(`${CHECK ? "Would change" : "Changed"} ${changed.length} file(s):`);
for (const f of changed) console.log(`  ${f}`);
if (problems.length) {
  console.log(`\n${problems.length} record(s) need a human:`);
  for (const p of problems) console.log(`  ${p}`);
  process.exitCode = 1;
}
