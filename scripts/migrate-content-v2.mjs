#!/usr/bin/env node
// One-shot migration: content/ v1 layout -> v2 layout.
//
// What it changes:
//   * Array-per-category files become one file per record. This is the change that makes
//     concurrent edits safe: two people editing different publications now touch different
//     files, so git merges them with no conflict. It also makes duplicate ids impossible,
//     because the filename IS the id.
//   * `themeId` (single) -> `themeIds` (array) on projects and publications.
//   * `Project.status` -> `Project.projectStatus`, freeing `status` for the draft/published
//     envelope that every entity now carries.
//   * YAML COMMENTS ARE RESCUED INTO DATA. v1 kept the entire provenance and decision record
//     in comments, which any programmatic writer destroys. Each record's file-header comment
//     and its own leading comment are folded into a structured `_meta { source, note }`.
//     After this runs, nothing depends on comment preservation ever again.
//   * Heals two known data bugs: people who have a photo on disk but no `photo:` field, and
//     asset paths pointing at files that do not exist (dropped, and noted in _meta).
//
// Reads content/, writes content-v2/. Does not delete anything. Run, inspect, then swap.
import fs from "node:fs";
import path from "node:path";
import { parseDocument, stringify } from "yaml";
import matter from "gray-matter";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "content");
const OUT = path.join(ROOT, "content-v2");
const PUBLIC = path.join(ROOT, "public");

const notes = [];
const warn = (m) => notes.push(m);

// --- helpers -------------------------------------------------------------------

function readDoc(rel) {
  const full = path.join(SRC, rel);
  if (!fs.existsSync(full)) return undefined;
  return parseDocument(fs.readFileSync(full, "utf-8"));
}

/** The `# ...` block at the top of a file, split into a Source: line and the rest. */
function headerProvenance(doc) {
  const raw = (doc?.commentBefore ?? "").trim();
  if (!raw) return {};
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^\s*#?\s?/, "").trim())
    .filter(Boolean);
  const sourceLine = lines.find((l) => /^source:/i.test(l));
  const rest = lines.filter((l) => l !== sourceLine).join(" ");
  return {
    source: sourceLine ? sourceLine.replace(/^source:\s*/i, "").trim() : undefined,
    note: rest || undefined,
  };
}

/** A single record's own leading comment inside an array file. */
function itemComment(node) {
  const c = (node?.commentBefore ?? "").trim();
  if (!c) return undefined;
  return c
    .split("\n")
    .map((l) => l.replace(/^\s*#?\s?/, "").trim())
    .filter(Boolean)
    .join(" ");
}

function mergeMeta(fileMeta, recordComment, extra) {
  const noteParts = [fileMeta.note, recordComment, extra].filter(Boolean);
  const meta = {};
  if (fileMeta.source) meta.source = fileMeta.source;
  if (noteParts.length) meta.note = noteParts.join(" — ");
  return Object.keys(meta).length ? meta : undefined;
}

function assetExists(p) {
  if (typeof p !== "string" || !p.startsWith("/")) return false;
  return fs.existsSync(path.join(PUBLIC, p.replace(/^\//, "")));
}

/** Drop asset fields whose target file is missing, recording why. */
function pruneMissingAssets(rec, fields, label) {
  const dropped = [];
  for (const f of fields) {
    if (rec[f] && !assetExists(rec[f])) {
      dropped.push(`${f}=${rec[f]}`);
      delete rec[f];
    }
  }
  if (dropped.length) {
    warn(`${label}: dropped missing asset ref(s) ${dropped.join(", ")}`);
    return `asset(s) removed during v2 migration because the file did not exist: ${dropped.join(", ")}`;
  }
  return undefined;
}

/** themeId -> themeIds, preserving order and dropping nulls. */
function toThemeIds(rec) {
  if (!("themeId" in rec)) return;
  const v = rec.themeId;
  delete rec.themeId;
  if (v) rec.themeIds = [v];
}

function writeRecord(kind, id, data) {
  const dir = path.join(OUT, kind);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.yaml`);
  if (fs.existsSync(file)) {
    warn(`DUPLICATE id "${id}" in ${kind} — second occurrence skipped`);
    return false;
  }
  fs.writeFileSync(file, stringify(data, { lineWidth: 0 }), "utf-8");
  return true;
}

/** Split an array-of-records file into one file per record. */
function splitArrayFile(rel, kind, transform) {
  const doc = readDoc(rel);
  if (!doc) {
    warn(`missing source file ${rel}`);
    return 0;
  }
  const fileMeta = headerProvenance(doc);
  const items = doc.toJS() ?? [];
  const nodes = doc.contents?.items ?? [];
  let n = 0;
  items.forEach((rec, i) => {
    const comment = itemComment(nodes[i]);
    const out = transform(structuredClone(rec), { fileMeta, comment, index: i, rel });
    if (out && writeRecord(kind, out.id, out)) n++;
  });
  return n;
}

/** Copy a directory of one-record-per-file YAML through a transform. */
function mapRecordDir(relDir, kind, transform) {
  const full = path.join(SRC, relDir);
  if (!fs.existsSync(full)) {
    warn(`missing source dir ${relDir}`);
    return 0;
  }
  let n = 0;
  for (const f of fs.readdirSync(full).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const doc = parseDocument(fs.readFileSync(path.join(full, f), "utf-8"));
    const fileMeta = headerProvenance(doc);
    const out = transform(doc.toJS(), { fileMeta, file: `${relDir}/${f}` });
    if (out && writeRecord(kind, out.id, out)) n++;
  }
  return n;
}

// --- migration -----------------------------------------------------------------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const counts = {};

// site-meta.yaml -> site.yaml (singleton, stays one file)
{
  const doc = readDoc("site-meta.yaml");
  const meta = headerProvenance(doc);
  const site = doc.toJS();
  const extra = pruneMissingAssets(site.logo ?? {}, ["light", "dark"], "site.logo");
  // v1 used explicit `null`s with comments to mean "deliberately empty, here's why".
  // Strip the nulls (absence means the same thing to the schema) but keep the reasoning.
  const nulled = [];
  for (const [k, v] of Object.entries(site.socialLinks ?? {})) {
    if (v === null) {
      nulled.push(k);
      delete site.socialLinks[k];
    }
  }
  if (site.contact?.phone === null) {
    nulled.push("contact.phone");
    delete site.contact.phone;
  }
  const note = [meta.note, extra, nulled.length ? `deliberately unset in v1: ${nulled.join(", ")}` : undefined]
    .filter(Boolean)
    .join(" — ");
  if (meta.source || note) site._meta = { ...(meta.source ? { source: meta.source } : {}), ...(note ? { note } : {}) };
  fs.writeFileSync(path.join(OUT, "site.yaml"), stringify(site, { lineWidth: 0 }), "utf-8");
  counts.site = 1;
}

// institutions.yaml (array) -> institutions/<id>.yaml
counts.institutions = splitArrayFile("institutions.yaml", "institutions", (rec, ctx) => {
  const extra = pruneMissingAssets(rec, ["logo"], `institution ${rec.id}`);
  const _meta = mergeMeta(ctx.fileMeta, ctx.comment, extra);
  return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
});

// people/ -> people/  (already one file per record)
counts.people = mapRecordDir("people", "people", (rec, ctx) => {
  // Heal: photo file exists on disk under the person's id but the field was never set.
  if (!rec.photo) {
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      const candidate = `/images/people/${rec.id}.${ext}`;
      if (assetExists(candidate)) {
        rec.photo = candidate;
        warn(`people/${rec.id}: photo field was missing; set to ${candidate} (file existed on disk)`);
        break;
      }
    }
  }
  const extra = pruneMissingAssets(rec, ["photo"], `people/${rec.id}`);
  const _meta = mergeMeta(ctx.fileMeta, undefined, extra);
  return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
});

// research/themes.yaml (array) -> themes/<id>.yaml
counts.themes = splitArrayFile("research/themes.yaml", "themes", (rec, ctx) => {
  const _meta = mergeMeta(ctx.fileMeta, ctx.comment);
  return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
});

// projects/ -> projects/  (themeId -> themeIds, status -> projectStatus)
counts.projects = mapRecordDir("projects", "projects", (rec, ctx) => {
  toThemeIds(rec);
  if ("status" in rec) {
    rec.projectStatus = rec.status;
    delete rec.status;
  }
  const extra = pruneMissingAssets(rec, ["thumbnail"], `projects/${rec.id}`);
  const _meta = mergeMeta(ctx.fileMeta, undefined, extra);
  return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
});

// publications/<category>.yaml (6 array files) -> publications/<id>.yaml
counts.publications = ["patents", "journals", "conferences", "workshops", "invited-papers", "book-chapters"]
  .map((f) =>
    splitArrayFile(`publications/${f}.yaml`, "publications", (rec, ctx) => {
      toThemeIds(rec);
      const extra = pruneMissingAssets(rec, ["thumbnail"], `publication ${rec.id}`);
      const _meta = mergeMeta(ctx.fileMeta, ctx.comment, extra);
      return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
    })
  )
  .reduce((a, b) => a + b, 0);

// posts/*.mdx -> posts/<id>.mdx  (frontmatter rewritten, body preserved verbatim)
{
  const dir = path.join(SRC, "posts");
  const outDir = path.join(OUT, "posts");
  fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((f) => /\.mdx?$/.test(f)).sort()) {
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf-8"));
    const extra = pruneMissingAssets(data, ["image"], `posts/${data.id}`);
    if (extra) data._meta = { ...(data._meta ?? {}), note: extra };
    const fm = stringify(_strip(data), { lineWidth: 0 }).trimEnd();
    fs.writeFileSync(
      path.join(outDir, `${data.id}.mdx`),
      `---\n${fm}\n---\n\n${content.trim()}\n`,
      "utf-8"
    );
    n++;
  }
  counts.posts = n;
}

// recognitions/<category>.yaml (5 array files) -> recognitions/<id>.yaml
counts.recognitions = [
  "best-paper-awards",
  "best-paper-nominations",
  "best-poster-awards",
  "international-competition-awards",
  "professional-honor-awards",
]
  .map((f) =>
    splitArrayFile(`recognitions/${f}.yaml`, "recognitions", (rec, ctx) => {
      const _meta = mergeMeta(ctx.fileMeta, ctx.comment);
      return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
    })
  )
  .reduce((a, b) => a + b, 0);

// service.yaml -> service/<id>.yaml
counts.service = splitArrayFile("service.yaml", "service", (rec, ctx) => {
  const _meta = mergeMeta(ctx.fileMeta, ctx.comment);
  return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
});

// teaching.yaml -> courses/<id>.yaml
counts.courses = splitArrayFile("teaching.yaml", "courses", (rec, ctx) => {
  const _meta = mergeMeta(ctx.fileMeta, ctx.comment);
  return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
});

// sponsors.yaml -> sponsors/<id>.yaml
counts.sponsors = splitArrayFile("sponsors.yaml", "sponsors", (rec, ctx) => {
  const extra = pruneMissingAssets(rec, ["logo"], `sponsor ${rec.id}`);
  const _meta = mergeMeta(ctx.fileMeta, ctx.comment, extra);
  return { ..._strip(rec), ...(_meta ? { _meta } : {}) };
});

/** Remove keys the v2 schema no longer accepts, and any undefined leftovers. */
function _strip(rec) {
  const out = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

// --- report --------------------------------------------------------------------

console.log("\nMigrated content/ -> content-v2/\n");
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(14)} ${v}`);
console.log(`\n  TOTAL          ${Object.values(counts).reduce((a, b) => a + b, 0)} records\n`);

if (notes.length) {
  console.log(`Notes (${notes.length}):`);
  for (const n of notes) console.log(`  - ${n}`);
  console.log("");
}
