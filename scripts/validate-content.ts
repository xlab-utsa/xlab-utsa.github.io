#!/usr/bin/env tsx
// CLI entry for the content validator. Run with `npm run validate:content`.
//
// Set CONTENT_DIR to check a candidate tree instead of content/, e.g.
//   CONTENT_DIR=content-v2 npm run validate:content
//
// Exit code 1 on any error, so CI can gate merges on it. Warnings never fail the build.
import fs from "fs";
import { validateContent } from "../lib/content/validate";
import { ROSTER_PATH, rosterIssues } from "../lib/access/roster";

const { errors, warnings, counts } = validateContent();

// The roster is not content, but it is the one file whose corruption locks everyone out of
// Studio — so it is checked here, on the same gate every submission passes through.
// Checked only when present: a checkout without it (CONTENT_DIR runs, forks) is not an error.
if (fs.existsSync(ROSTER_PATH)) {
  try {
    const roster: unknown = JSON.parse(fs.readFileSync(ROSTER_PATH, "utf-8"));
    for (const issue of rosterIssues(roster)) {
      const where =
        issue.index === undefined ? "" : ` at members[${issue.index}]${issue.field ? `.${issue.field}` : ""}`;
      errors.push(`${ROSTER_PATH}${where}: ${issue.message}`);
    }
  } catch (err) {
    errors.push(`${ROSTER_PATH}: not valid JSON — ${err instanceof Error ? err.message : String(err)}`);
  }
}

const dir = process.env.CONTENT_DIR ?? "content";
console.log(`\nValidating ${dir}/\n`);

if (Object.keys(counts).length) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(14)} ${v}`);
  }
  console.log(`  ${"TOTAL".padEnd(14)} ${total}\n`);
}

if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log("");
}

if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  for (const e of errors) console.error(`  x ${e}`);
  console.error("\nFAILED\n");
  process.exit(1);
}

console.log("OK — no errors\n");
