"use client";

// What a reviewer needs to know about a submission, computed in the browser from the
// submission's own files plus the live snapshot.
//
// The problem this solves: the review queue showed a raw YAML patch, in which
// `publicationId: conference-2006-robust-extraction` is an opaque string. A reviewer could
// not actually verify a relation — only that a plausible-looking id was present. Approval
// was therefore a rubber stamp on exactly the field most likely to be wrong.
//
// Two rules govern everything here:
//
//   1. NOTHING HERE BLOCKS. CI decides what is valid; this only decides what a person is
//      shown. A missing lab-author link is surfaced, never rejected — a paper with no lab
//      author is a real paper, and refusing it would just teach people to invent links.
//   2. NOTHING HERE IS A SEPARATE RULEBOOK. The relations come from lib/content/relations.ts,
//      the same table CI validates against, so the two cannot drift.

import { parse } from "yaml";
import { REPO_NAME, REPO_OWNER } from "./config";
import type { DiffFile, Snapshot } from "./api";
import {
  CONTENT_DIR,
  COLLECTION_KEY,
  RELATIONS,
  labelOf,
  referencesTo,
  resolveRefs,
} from "@/lib/content/relations";
import { matchAuthorToPeople, titleKey } from "@/lib/content/matching";
import { ENTITY_KINDS, type EntityKind } from "@/lib/content/schema";

type Rec = Record<string, unknown>;

export interface ChangedRecord {
  kind: EntityKind;
  id: string;
  path: string;
  deleted: boolean;
  /** The proposed record, read from the submission branch. Undefined if it could not be read. */
  record?: Rec;
  /** True when the file content could not be fetched, so link checks were skipped. */
  unreadable?: boolean;
}

export type FindingLevel = "error" | "warn" | "info" | "ok";

export interface Finding {
  level: FindingLevel;
  /** Which changed file this is about, for grouping. */
  path: string;
  message: string;
  /** Optional supporting lines — matched names, duplicate ids, referencing records. */
  detail?: string[];
}

export interface SubmissionReview {
  records: ChangedRecord[];
  findings: Finding[];
  /** Worst level present, for the collapsed row's chip. */
  level: FindingLevel;
}

const SEVERITY: Record<FindingLevel, number> = { ok: 0, info: 1, warn: 2, error: 3 };

/** Map `content/publications/foo.yaml` back to the entity it belongs to. */
function kindOfPath(path: string): EntityKind | undefined {
  return ENTITY_KINDS.find((kind) => path.startsWith(`${CONTENT_DIR[kind]}/`));
}

function idOfPath(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.(ya?ml|mdx)$/, "");
}

/** Posts are MDX: the record is the frontmatter block, the rest is the body. */
function parseRecordFile(path: string, text: string): Rec | undefined {
  try {
    if (path.endsWith(".mdx")) {
      const match = /^---\n([\s\S]*?)\n---/.exec(text);
      return match ? (parse(match[1]) as Rec) : undefined;
    }
    return parse(text) as Rec;
  } catch {
    return undefined;
  }
}

/**
 * How many records a submission may touch before the per-record reading is skipped.
 *
 * Bulk actions — theme tagging, author linking — routinely change a hundred files or more in
 * one PR. Reading each one would mean a hundred requests to render a single queue row, and a
 * hundred findings nobody is going to read. Past this point the reviewer is checking one
 * mechanical operation, not a hundred individual records, and CI still checks all of them.
 */
const MAX_RECORDS_REVIEWED = 25;

/**
 * Read a submission's proposed files from its branch.
 *
 * The gate returns a patch, which shows what changed but not what the file ends up saying —
 * a one-line edit gives a three-line hunk, not the record. raw.githubusercontent.com serves
 * the whole file from the submission branch with no credential (the repo is public) and no
 * Worker change.
 */
export async function loadChangedRecords(
  files: DiffFile[],
  branch: string
): Promise<{ records: ChangedRecord[]; skipped: number }> {
  const relevant = files.filter((f) => kindOfPath(f.filename));
  const skipped = Math.max(0, relevant.length - MAX_RECORDS_REVIEWED);

  const records = await Promise.all(
    relevant.slice(0, MAX_RECORDS_REVIEWED).map(async (file): Promise<ChangedRecord> => {
      const kind = kindOfPath(file.filename)!;
      const base = { kind, id: idOfPath(file.filename), path: file.filename };
      if (file.status === "removed") return { ...base, deleted: true };

      try {
        const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${encodeURI(branch)}/${encodeURI(file.filename)}`;
        const res = await fetch(url);
        if (!res.ok) return { ...base, deleted: false, unreadable: true };
        const record = parseRecordFile(file.filename, await res.text());
        return record
          ? { ...base, deleted: false, record }
          : { ...base, deleted: false, unreadable: true };
      } catch {
        return { ...base, deleted: false, unreadable: true };
      }
    })
  );

  return { records, skipped };
}

/**
 * Turn the proposed records into the handful of statements a reviewer can actually act on.
 *
 * References are resolved against the live snapshot PLUS the records created in this same
 * submission, so a publication and the person it credits can arrive together without the
 * link looking broken.
 */
export function reviewSubmission(
  records: ChangedRecord[],
  snapshot: Snapshot,
  skipped = 0
): SubmissionReview {
  const content = snapshot.content as unknown as Record<string, unknown>;
  const people = snapshot.content.people.map((p) => ({ id: p.id, name: p.name }));

  // Known ids per kind: what is already live, plus what this submission adds, minus what it
  // deletes.
  const known: Record<string, Set<string>> = {};
  for (const kind of ENTITY_KINDS) {
    const list = (content[COLLECTION_KEY[kind]] as { id: string }[]) ?? [];
    known[kind] = new Set(list.map((r) => r.id));
  }
  for (const changed of records) {
    if (changed.deleted) known[changed.kind].delete(changed.id);
    else known[changed.kind].add(changed.id);
  }

  const recordByKindId = (kind: EntityKind, id: string): Rec | undefined => {
    const incoming = records.find((r) => r.kind === kind && r.id === id && !r.deleted);
    if (incoming?.record) return incoming.record;
    const list = (content[COLLECTION_KEY[kind]] as Rec[]) ?? [];
    return list.find((r) => r.id === id);
  };

  const findings: Finding[] = [];

  // Never let a cap look like a clean bill of health.
  if (skipped > 0) {
    findings.push({
      level: "info",
      path: "this submission",
      message: `Bulk change — ${skipped} further record${skipped === 1 ? " was" : "s were"} not read here. The diff below is complete, and CI checks every one of them.`,
    });
  }

  for (const changed of records) {
    if (changed.unreadable) {
      findings.push({
        level: "info",
        path: changed.path,
        message: "Could not read the proposed file, so its links were not checked. The diff below is still accurate, and CI checks them regardless.",
      });
      continue;
    }

    // --- deletions: what still points at this record ---------------------------
    if (changed.deleted) {
      const inbound = referencesTo(content, changed.kind, changed.id).filter(
        // A reference from a record this same submission also deletes is not a problem.
        (ref) => !records.some((r) => r.deleted && r.kind === ref.from && r.id === ref.fromId)
      );
      if (inbound.length > 0) {
        findings.push({
          level: "error",
          path: changed.path,
          message: `Deleting this leaves ${inbound.length} reference${inbound.length === 1 ? "" : "s"} pointing at nothing — CI will reject it.`,
          detail: [
            ...inbound.slice(0, 12).map((ref) => `${ref.from}/${ref.fromId} · ${ref.where}`),
            ...(inbound.length > 12 ? [`… +${inbound.length - 12} more`] : []),
          ],
        });
      } else {
        findings.push({ level: "ok", path: changed.path, message: "Nothing else references this record — safe to delete." });
      }
      continue;
    }

    const record = changed.record;
    if (!record) continue;

    // --- every declared relation on this record --------------------------------
    for (const relation of RELATIONS) {
      if (relation.from !== changed.kind) continue;
      for (const { value, where } of resolveRefs(record, relation.path)) {
        if (!known[relation.to].has(value)) {
          findings.push({
            level: "error",
            path: changed.path,
            message: `${where} points at "${value}", which is not a ${relation.to} record. CI will reject this.`,
          });
          continue;
        }
        // The whole point: show the reviewer the NAME, not the id.
        const target = recordByKindId(relation.to, value);
        findings.push({
          level: "ok",
          path: changed.path,
          message: `${where} → ${labelOf(relation.to, target) ?? value}`,
        });
      }
    }

    // --- publication-specific review -------------------------------------------
    if (changed.kind === "publications") {
      reviewPublication(record, changed.path, people, snapshot, records, findings, (id) =>
        known.people.has(id)
      );
    }
  }

  const level = findings.reduce<FindingLevel>(
    (worst, f) => (SEVERITY[f.level] > SEVERITY[worst] ? f.level : worst),
    "ok"
  );
  return { records, findings, level };
}

/**
 * The judgement calls a publication carries that no validator can make.
 *
 * Author linking is the big one. `authors[].personId` is optional, so an unlinked lab member
 * is perfectly valid data — and 81% of author entries are unlinked precisely because nothing
 * ever asked. Rather than making the system decide, this puts the question in front of the
 * one person already looking at the submission: "this author string looks like a lab member,
 * and it is not linked."
 */
function reviewPublication(
  record: Rec,
  path: string,
  people: { id: string; name: string }[],
  snapshot: Snapshot,
  records: ChangedRecord[],
  findings: Finding[],
  personExists: (id: string) => boolean
): void {
  const authors = Array.isArray(record.authors) ? (record.authors as Rec[]) : [];
  // A personId that does not resolve is already reported as a broken link above; counting it
  // as "linked" here would tell the reviewer the opposite of the truth.
  const linked = authors.filter((a) => typeof a.personId === "string" && personExists(a.personId));

  const suggestions: string[] = [];
  authors.forEach((author, i) => {
    if (author.personId) return;
    const name = typeof author.name === "string" ? author.name : "";
    if (!name) return;
    const { match, candidates } = matchAuthorToPeople(name, people);
    if (match) {
      suggestions.push(`authors[${i}] "${name}" looks like ${match.personName}${match.confidence === "initial" ? " (initials only — confirm it is the same person)" : ""}`);
    } else if (candidates.length > 1) {
      suggestions.push(`authors[${i}] "${name}" could be ${candidates.map((c) => c.personName).join(" or ")} — ambiguous, needs a human`);
    }
  });

  if (linked.length === 0) {
    findings.push({
      level: authors.length > 0 && suggestions.length > 0 ? "warn" : "info",
      path,
      message: "No author on this paper is linked to a lab member.",
      detail: suggestions.length
        ? suggestions
        : ["If a lab member is among the authors, link them so the paper shows on their profile. If not, this is fine as-is."],
    });
  } else {
    findings.push({
      level: "ok",
      path,
      message: `${linked.length} of ${authors.length} author${authors.length === 1 ? "" : "s"} linked to the lab.`,
      detail: suggestions.length ? suggestions : undefined,
    });
    if (suggestions.length) {
      findings.push({
        level: "warn",
        path,
        message: `${suggestions.length} more author${suggestions.length === 1 ? "" : "s"} may be lab members and are not linked.`,
        detail: suggestions,
      });
    }
  }

  // --- duplicate detection ----------------------------------------------------
  // Two people submitting the same co-authored paper is the most likely real corruption once
  // several members add their own work, and it is invisible to every reference check: both
  // records are individually valid.
  const id = String(record.id ?? "");
  const others = [
    ...snapshot.content.publications.filter((p) => p.id !== id),
    ...records
      .filter((r) => r.kind === "publications" && r.id !== id && r.record)
      .map((r) => r.record as Rec),
  ];

  if (typeof record.doi === "string" && record.doi) {
    const doi = record.doi.toLowerCase();
    const clash = others.filter((p) => typeof p.doi === "string" && p.doi.toLowerCase() === doi);
    if (clash.length) {
      findings.push({
        level: "error",
        path,
        message: `DOI ${record.doi} is already used by ${clash.map((p) => p.id).join(", ")} — a DOI identifies exactly one paper.`,
      });
    }
  }

  if (typeof record.title === "string") {
    const key = `${titleKey(record.title)}|${record.category}|${record.year ?? ""}`;
    const clash = others.filter(
      (p) => `${titleKey(String(p.title ?? ""))}|${p.category}|${p.year ?? ""}` === key
    );
    if (clash.length) {
      findings.push({
        level: "warn",
        path,
        message: `Same title, category and year as ${clash.map((p) => p.id).join(", ")} — check this is not the same paper twice.`,
      });
    }
  }

  if (!Array.isArray(record.themeIds) || record.themeIds.length === 0) {
    findings.push({
      level: "info",
      path,
      message: "No research theme — this paper will not appear in the research browser.",
    });
  }
}
