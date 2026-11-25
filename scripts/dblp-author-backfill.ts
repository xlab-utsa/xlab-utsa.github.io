// One-time backfill of person ↔ paper links from a DBLP export (SPEC.md §9.5).
//
// Site author strings are mostly initials ("D. Liu"), which the matcher can only ever
// SUGGEST. DBLP lists the same papers with full names ("Dancheng Liu"), which is the
// independent evidence that turns a suggestion into a confident proposal. A link is proposed
// only when ALL of these hold:
//   * the DBLP entry is the same paper: same normalized title AND a year within one, and not
//     an arXiv (journals/corr) record when a published one exists;
//   * the DBLP full name is an exact (or alias) match for exactly one lab member;
//   * the site's own author string at the aligned position fits that member too;
//   * the slot is unlinked and the member is not already linked elsewhere on the paper.
//
// Edits are made by inserting one `personId:` line (lib/studio/self-link.ts), so the diff is
// the review: every changed file differs by exactly one line per proposal.
//
//   npx tsx scripts/dblp-author-backfill.ts [path/to/export.bib]           # report only
//   npx tsx scripts/dblp-author-backfill.ts [path/to/export.bib] --apply   # write the links
import fs from "fs";
import path from "path";

import { loadAllRecords } from "../lib/content/index";
import { parseAuthorName, titleKey } from "../lib/content/matching";
import { authorFitsPerson, candidatesForAuthor } from "../lib/content/suggestions";
import { insertSelfLink } from "../lib/studio/self-link";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const bibPath = args.find((a) => !a.startsWith("--")) ?? "jinjun-xiong.bib";

interface BibEntry {
  key: string;
  title: string;
  year?: number;
  authors: string[];
}

/** Just enough BibTeX for DBLP's own, very regular export. */
function parseBib(text: string): BibEntry[] {
  const out: BibEntry[] = [];
  for (const chunk of text.split(/^@/m).slice(1)) {
    const head = chunk.match(/^\w+\{([^,]+),/);
    if (!head) continue;
    const fields: Record<string, string> = {};
    const re = /\s*(\w+)\s*=\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk))) {
      let depth = 1;
      let i = re.lastIndex;
      while (depth && i < chunk.length) {
        if (chunk[i] === "{") depth++;
        else if (chunk[i] === "}") depth--;
        i++;
      }
      fields[m[1]] = chunk.slice(re.lastIndex, i - 1).replace(/\s+/g, " ").replace(/[{}]/g, "").trim();
      re.lastIndex = i;
    }
    if (!fields.title) continue;
    out.push({
      key: head[1].replace(/^DBLP:/, ""),
      title: fields.title,
      year: fields.year ? Number(fields.year) : undefined,
      // DBLP disambiguates homonyms with a numeric suffix ("Jinjun Xiong 0001").
      authors: (fields.author ?? "").split(/\s+and\s+/).map((a) => a.replace(/\s+\d{4}$/, "").trim()).filter(Boolean),
    });
  }
  return out;
}

const surname = (name: string) => parseAuthorName(name).surname.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

const content = loadAllRecords();
const people = content.people.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases }));
const entries = parseBib(fs.readFileSync(path.resolve(bibPath), "utf8"));
const byTitle = new Map<string, BibEntry[]>();
for (const e of entries) byTitle.set(titleKey(e.title), [...(byTitle.get(titleKey(e.title)) ?? []), e]);

interface Proposal {
  publicationId: string;
  authorIndex: number;
  siteName: string;
  dblpName: string;
  personId: string;
  personName: string;
  dblpKey: string;
}

const proposals: Proposal[] = [];
let matchedPapers = 0;

for (const pub of content.publications) {
  const candidates = (byTitle.get(titleKey(pub.title)) ?? []).filter(
    (e) => pub.year === undefined || e.year === undefined || Math.abs(e.year - pub.year) <= 1
  );
  const entry = candidates.find((e) => !e.key.startsWith("journals/corr/")) ?? candidates[0];
  if (!entry) continue;
  matchedPapers++;

  const sameLength = entry.authors.length === pub.authors.length;
  pub.authors.forEach((author, i) => {
    if (author.personId) return;
    // Align by position when both lists are the same length; otherwise by unique surname.
    let dblpName = sameLength ? entry.authors[i] : undefined;
    if (!dblpName) {
      const hits = entry.authors.filter((a) => surname(a) === surname(author.name));
      if (hits.length === 1) dblpName = hits[0];
    }
    if (!dblpName || surname(dblpName) !== surname(author.name)) return;

    const strong = candidatesForAuthor(dblpName, people).filter((c) => c.confidence !== "initial");
    if (strong.length !== 1) return;
    const person = people.find((p) => p.id === strong[0].personId)!;
    if (!authorFitsPerson(author.name, person)) return;
    if (pub.authors.some((a) => a.personId === person.id)) return;
    if (proposals.some((p) => p.publicationId === pub.id && p.personId === person.id)) return;

    proposals.push({
      publicationId: pub.id,
      authorIndex: i,
      siteName: author.name,
      dblpName,
      personId: person.id,
      personName: person.name,
      dblpKey: entry.key,
    });
  });
}

const perPerson = new Map<string, number>();
for (const p of proposals) perPerson.set(p.personName, (perPerson.get(p.personName) ?? 0) + 1);

console.log(`DBLP entries: ${entries.length} · site papers matched: ${matchedPapers}/${content.publications.length}`);
console.log(`Proposed links: ${proposals.length}`);
for (const [name, n] of [...perPerson].sort((a, b) => b[1] - a[1])) console.log(`  ${name.padEnd(24)} +${n}`);
console.log("");
for (const p of proposals) {
  console.log(`  ${p.publicationId}  authors[${p.authorIndex}] "${p.siteName}" = DBLP "${p.dblpName}" → ${p.personId}`);
}

if (APPLY) {
  // Several proposals can touch one file; insert from the last author slot up, so earlier
  // insertions never shift the index of a later one.
  const byFile = new Map<string, Proposal[]>();
  for (const p of proposals) byFile.set(p.publicationId, [...(byFile.get(p.publicationId) ?? []), p]);
  for (const [id, list] of byFile) {
    const file = path.join(process.cwd(), "content", "publications", `${id}.yaml`);
    let text = fs.readFileSync(file, "utf8");
    for (const p of [...list].sort((a, b) => b.authorIndex - a.authorIndex)) {
      text = insertSelfLink(text, p.authorIndex, p.personId);
    }
    fs.writeFileSync(file, text, "utf8");
  }
  console.log(`\nWrote ${proposals.length} link(s) into ${byFile.size} file(s). Review with git diff, then npm run validate:content.`);
} else {
  console.log("\nReport only. Re-run with --apply to write these links.");
}
