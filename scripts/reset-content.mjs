#!/usr/bin/env node
// Archive the current content set and reseed a minimal, valid site.
//
//   node scripts/reset-content.mjs           # DRY RUN — prints what it would do
//   node scripts/reset-content.mjs --apply   # actually does it
//
// This exists because "wipe it and let everyone re-enter their own data" is a reasonable
// thing to want once Studio is in place, and it should be a documented, repeatable operation
// rather than an improvised `rm -rf` at the wrong moment. See docs/CONTENT-RESET.md.
//
// ────────────────────────────────────────────────────────────────────────────────
//  IT NEVER TOUCHES access/roster.json.
//
//  That file holds who can sign in, including the owner's own admin account. It lives
//  outside content/, so it is out of scope by construction — but that is stated here, in
//  the doc, and asserted at runtime, because deleting it would lock the owner out of their
//  own site with no way back in except editing the repo by hand.
// ────────────────────────────────────────────────────────────────────────────────
//
// Nothing is ever destroyed: content/ is MOVED to content-archive/, which stays in git.
// Studio can restore individual records from there, and `git revert` undoes the whole thing.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, "content");
const ARCHIVE = path.join(ROOT, "content-archive");
const ROSTER = path.join(ROOT, "access", "roster.json");

const apply = process.argv.includes("--apply");

// What survives the reset. The site must still BUILD afterwards, which means keeping the
// records that everything else hangs off:
//   site.yaml     — nav, title, contact. The site cannot render without it.
//   institutions/ — referenced by people's affiliations and by site.primaryInstitutionId.
//   themes/       — the six research thrusts; structural, not per-person data.
//   people/<pi>   — so the site is not a blank page while members are re-entering theirs.
const KEEP_FILES = ["site.yaml"];
const KEEP_DIRS = ["institutions", "themes"];
const keepPeopleArg = process.argv.find((a) => a.startsWith("--keep-people="));
const KEEP_PEOPLE = (keepPeopleArg ? keepPeopleArg.split("=")[1] : "jinjun-xiong")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

function isKept(relPath) {
  const parts = relPath.split(path.sep);
  if (parts.length === 1 && KEEP_FILES.includes(parts[0])) return true;
  if (KEEP_DIRS.includes(parts[0])) return true;
  if (parts[0] === "people") {
    const id = path.basename(parts[1] ?? "", path.extname(parts[1] ?? ""));
    return KEEP_PEOPLE.includes(id);
  }
  return false;
}

// --- safety assertions ---------------------------------------------------------

if (!fs.existsSync(CONTENT)) {
  console.error("content/ does not exist — nothing to reset.");
  process.exit(1);
}

const rosterExistedBefore = fs.existsSync(ROSTER);
if (!rosterExistedBefore) {
  console.warn(
    "WARNING: access/roster.json is missing. That file controls who can sign in.\n" +
      "         Restore it before resetting, or nobody will be able to administer the site."
  );
}

// --- plan ----------------------------------------------------------------------

const files = walk(CONTENT).map((f) => path.relative(CONTENT, f));
const archived = files.filter((f) => !isKept(f));
const kept = files.filter(isKept);

console.log(`\n${apply ? "RESETTING" : "DRY RUN — nothing will change"}\n`);
console.log(`  content/ has ${files.length} files`);
console.log(`  keep    ${kept.length}`);
console.log(`  archive ${archived.length}  ->  content-archive/\n`);

const byKind = {};
for (const f of archived) {
  const kind = f.split(path.sep)[0].replace(/\.ya?ml$/, "");
  byKind[kind] = (byKind[kind] ?? 0) + 1;
}
for (const [kind, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${kind.padEnd(16)} ${n}`);
}

console.log(`\n  kept so the site still builds:`);
for (const f of kept.slice(0, 12)) console.log(`    ${f}`);
if (kept.length > 12) console.log(`    … +${kept.length - 12} more`);

console.log(`\n  access/roster.json: NOT TOUCHED (admin access preserved)`);
console.log(`  public/images/**:   NOT TOUCHED (so archived records can be restored intact)`);

if (!apply) {
  console.log(`\nRe-run with --apply to perform the reset.\n`);
  process.exit(0);
}

// --- execute -------------------------------------------------------------------

for (const rel of archived) {
  const from = path.join(CONTENT, rel);
  const to = path.join(ARCHIVE, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

// Remove directories left empty by the move, but never content/ itself.
for (const dir of fs.readdirSync(CONTENT, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const full = path.join(CONTENT, dir.name);
  if (walk(full).length === 0) fs.rmSync(full, { recursive: true, force: true });
}

// Re-assert the one invariant that matters after the fact, not just before it.
if (rosterExistedBefore && !fs.existsSync(ROSTER)) {
  console.error("\nFATAL: access/roster.json disappeared during the reset. Restore it with:");
  console.error("  git checkout HEAD -- access/roster.json\n");
  process.exit(1);
}

console.log(`\nDone. ${archived.length} files moved to content-archive/.\n`);
console.log(`Next:`);
console.log(`  npm run validate:content     # confirm what remains is coherent`);
console.log(`  npm run build                # confirm the site still builds`);
console.log(`  git add -A && git commit     # the archive stays in git; nothing is lost`);
console.log(`\nTo undo entirely: git checkout HEAD -- content content-archive\n`);
