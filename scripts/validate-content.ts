#!/usr/bin/env tsx
// CLI entry for the content validator. Run with `npm run validate:content`.
//
// Set CONTENT_DIR to check a candidate tree instead of content/, e.g.
//   CONTENT_DIR=content-v2 npm run validate:content
//
// Exit code 1 on any error, so CI can gate merges on it. Warnings never fail the build.
import { validateContent } from "../lib/content/validate";

const { errors, warnings, counts } = validateContent();

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
