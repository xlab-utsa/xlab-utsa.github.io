// Cross-record integrity checks — the constraints a relational database would have given
// us for free, and which content/ had none of before v2.
//
// Per-record shape validation lives in schema.ts and runs during load. This file covers the
// rules a single record cannot express:
//
//   * REFERENTIAL INTEGRITY — every foreign key resolves. Previously a dangling personId or
//     themeId passed validation and silently rendered nothing, which is the worst kind of
//     bug: invisible in CI, invisible on the page, discovered by a visitor. The relations
//     themselves are declared once in relations.ts and driven from there.
//   * ASSET INTEGRITY — every referenced image actually exists on disk.
//   * KEY UNIQUENESS — enforced structurally by filename===id (see loader.ts), re-asserted
//     here as a defence in depth.
//   * DUPLICATE RECORDS — the same paper entered twice. Invisible to every check above,
//     because both copies are individually valid, and the single most likely form of real
//     corruption once several people submit their own co-authored papers independently.
//   * STATUS CONSISTENCY — a published record pointing at a draft one. CI green, page blank.
//
// It also reports COVERAGE: how many records have made an optional link at all. Coverage is
// never an error. A paper with no lab author is a real paper; blocking it would only teach
// people to invent links. It is measured in aggregate so it can be worked through
// deliberately, rather than nagged about once per record.
//
// Warnings are reported but never fail the build; errors fail it.
import fs from "fs";
import path from "path";
import { loadAllRecords, type AllContent } from "./index";
import { ContentValidationError } from "./loader";
import { titleKey } from "./matching";
import {
  COLLECTION_KEY,
  RELATIONS,
  resolveRefs,
  type RelationOwner,
} from "./relations";
import { ENTITY_KINDS, type EntityKind } from "./schema";
import type { CoverageStat, Issue, ValidationReport } from "./report";

// The report's shape lives in report.ts so the Studio can render it without importing this
// file, which reads the filesystem.
export type { CoverageStat, Issue, IssueLevel, ValidationReport } from "./report";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

function assetExists(assetPath: string): boolean {
  return fs.existsSync(path.join(PUBLIC_ROOT, assetPath.replace(/^\//, "")));
}

/** Collect every image path referenced anywhere in the content tree. */
function referencedAssets(c: AllContent): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  const add = (p: string | undefined, where: string) => {
    if (!p) return;
    refs.set(p, [...(refs.get(p) ?? []), where]);
  };
  add(c.siteMeta.logo?.light, "site.yaml logo.light");
  add(c.siteMeta.logo?.dark, "site.yaml logo.dark");
  for (const x of c.people) add(x.photo, `people/${x.id}.yaml photo`);
  for (const x of c.projects) add(x.thumbnail, `projects/${x.id}.yaml thumbnail`);
  for (const x of c.publications) add(x.thumbnail, `publications/${x.id}.yaml thumbnail`);
  for (const x of c.posts) add(x.image, `posts/${x.id}.mdx image`);
  for (const x of c.institutions) add(x.logo, `institutions/${x.id}.yaml logo`);
  for (const x of c.sponsors) add(x.logo, `sponsors/${x.id}.yaml logo`);
  return refs;
}

/** The on-disk file a record lives in, used verbatim in error messages. */
function fileOf(owner: RelationOwner, id: string): string {
  if (owner === "site") return "site.yaml";
  return `${owner}/${id}.${owner === "posts" ? "mdx" : "yaml"}`;
}

export function validateContent(preloaded?: AllContent): ValidationReport {
  const issues: Issue[] = [];
  const add = (issue: Issue) => issues.push(issue);

  let content: AllContent;
  try {
    content = preloaded ?? loadAllRecords();
  } catch (err) {
    if (err instanceof ContentValidationError) {
      // Schema errors block the integrity pass — there is no reliable data to check FKs
      // against until shapes are correct. Report them and stop.
      const errors = err.message.split("\n").slice(1).map((l) => l.replace(/^\s*-\s*/, ""));
      return {
        errors,
        warnings: ["integrity checks skipped — fix the schema errors above first"],
        issues: [
          ...errors.map((message) => ({ level: "error" as const, code: "schema", entity: "content", message })),
          {
            level: "warning" as const,
            code: "integrity-skipped",
            entity: "content",
            message: "integrity checks skipped — fix the schema errors above first",
          },
        ],
        coverage: [],
        counts: {},
      };
    }
    throw err;
  }

  const recordsOf = (kind: EntityKind): { id: string; status?: string }[] =>
    (content as unknown as Record<string, unknown>)[COLLECTION_KEY[kind]] as { id: string }[];

  // --- id uniqueness (defence in depth; filename===id already enforces this) ----
  const idSets: Record<string, Set<string>> = {};
  for (const kind of ENTITY_KINDS) {
    const seen = new Set<string>();
    for (const r of recordsOf(kind)) {
      if (seen.has(r.id)) {
        add({ level: "error", code: "duplicate-id", entity: kind, id: r.id, message: `${kind}: duplicate id "${r.id}"` });
      }
      seen.add(r.id);
    }
    idSets[kind] = seen;
  }

  // Status lookup, so a published record pointing at a draft one can be spotted below.
  const statusOf = new Map<string, string>();
  for (const kind of ENTITY_KINDS) {
    for (const r of recordsOf(kind)) statusOf.set(`${kind}/${r.id}`, r.status ?? "published");
  }

  // --- referential integrity ---------------------------------------------------
  // Driven entirely by RELATIONS. Adding a reference field to the schema and a line to that
  // table is all it takes for CI, the Studio picker, and the review queue to know about it.
  for (const relation of RELATIONS) {
    const owners: { record: unknown; id: string }[] =
      relation.from === "site"
        ? [{ record: content.siteMeta, id: "site" }]
        : recordsOf(relation.from).map((r) => ({ record: r, id: r.id }));

    for (const { record, id } of owners) {
      const ownerFile = fileOf(relation.from, id);
      const ownerPublished =
        relation.from === "site" || statusOf.get(`${relation.from}/${id}`) === "published";

      for (const { value, where } of resolveRefs(record, relation.path)) {
        if (!idSets[relation.to].has(value)) {
          add({
            level: "error",
            code: "dangling-reference",
            entity: relation.from,
            id,
            where,
            message: `${ownerFile} ${where}: "${value}" does not resolve to any ${relation.to} record`,
          });
          continue;
        }
        // The reference resolves, but points at something the public site hides. Green CI,
        // blank page — the same silent failure the FK checks exist to prevent.
        const targetStatus = statusOf.get(`${relation.to}/${value}`);
        if (ownerPublished && targetStatus && targetStatus !== "published") {
          add({
            level: "warning",
            code: "published-points-at-unpublished",
            entity: relation.from,
            id,
            where,
            message: `${ownerFile} ${where}: this record is published but its ${relation.label} "${value}" is ${targetStatus} — the link renders as nothing`,
          });
        }
      }
    }
  }

  // --- duplicate records -------------------------------------------------------
  // Two publications with the same DOI are the same paper, always. Title alone is not
  // enough: a conference paper extended into a journal article legitimately shares a title,
  // and 23 such pairs exist in this content set. Requiring the category and year to match
  // as well narrows it to the case that is genuinely a mistake.
  const byDoi = new Map<string, string[]>();
  const byTitle = new Map<string, string[]>();
  for (const p of content.publications) {
    if (p.doi) {
      const key = p.doi.toLowerCase();
      byDoi.set(key, [...(byDoi.get(key) ?? []), p.id]);
    }
    const key = `${titleKey(p.title)}|${p.category}|${p.year ?? ""}`;
    byTitle.set(key, [...(byTitle.get(key) ?? []), p.id]);
  }
  for (const [doi, ids] of byDoi) {
    if (ids.length > 1) {
      add({
        level: "error",
        code: "duplicate-doi",
        entity: "publications",
        id: ids[0],
        message: `DOI ${doi} is used by ${ids.length} publications: ${ids.join(", ")} — a DOI identifies exactly one paper`,
      });
    }
  }
  for (const ids of byTitle.values()) {
    if (ids.length > 1) {
      add({
        level: "warning",
        code: "possible-duplicate-publication",
        entity: "publications",
        id: ids[0],
        message: `same title, category and year: ${ids.join(", ")} — probably the same paper entered twice`,
      });
    }
  }

  // --- asset integrity ---------------------------------------------------------
  const refs = referencedAssets(content);
  for (const [assetPath, wheres] of refs) {
    if (!assetExists(assetPath)) {
      add({
        level: "error",
        code: "missing-asset",
        entity: "assets",
        id: assetPath,
        message: `missing image "${assetPath}" referenced by ${wheres.join(", ")}`,
      });
    }
  }

  // Images on disk that nothing points at. A warning, not an error — the repo may keep
  // originals deliberately — but it is how "uploaded a photo, forgot to set the field"
  // gets noticed.
  const imagesRoot = path.join(PUBLIC_ROOT, "images");
  if (fs.existsSync(imagesRoot)) {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
      });
    for (const file of walk(imagesRoot)) {
      const rel = "/" + path.relative(PUBLIC_ROOT, file).split(path.sep).join("/");
      if (!refs.has(rel)) {
        add({
          level: "warning",
          code: "unreferenced-image",
          entity: "assets",
          id: rel,
          message: `unreferenced image on disk: ${rel}`,
        });
      }
    }
  }

  // --- data-quality warnings ---------------------------------------------------
  for (const p of content.people) {
    if (p.personType !== "lab-lead" && p.labTenure?.joinedYear === undefined) {
      // Not an error: 16 records have no sourced joined year and this project's rule is
      // never to invent data. Studio requires it for new and edited records.
      add({ level: "warning", code: "no-joined-year", entity: "people", id: p.id, message: `people/${p.id}.yaml: no labTenure.joinedYear` });
    }
    if (!p.photo) {
      add({ level: "warning", code: "no-photo", entity: "people", id: p.id, message: `people/${p.id}.yaml: no photo` });
    }
  }

  // --- coverage ----------------------------------------------------------------
  // Reported, never enforced. One line per relation instead of one warning per record:
  // 284 individual nags would only train everyone to ignore warnings entirely.
  const authorEntries = content.publications.flatMap((p) => p.authors);
  const coverage: CoverageStat[] = [
    {
      key: "publications-with-lab-author",
      label: "Publications with at least one linked lab author",
      covered: content.publications.filter((p) => p.authors.some((a) => a.personId)).length,
      total: content.publications.length,
      hint: "Unlinked papers never appear on their authors' profiles.",
    },
    {
      key: "author-entries-linked",
      label: "Author entries linked to a person record",
      covered: authorEntries.filter((a) => a.personId).length,
      total: authorEntries.length,
      hint: "Most co-authors are external and should stay unlinked; this counts lab members too.",
    },
    {
      key: "publications-with-theme",
      label: "Publications tagged with a research theme",
      covered: content.publications.filter((p) => p.themeIds.length > 0).length,
      total: content.publications.length,
      hint: "Untagged publications do not appear in the research browser.",
    },
    {
      key: "projects-with-contributors",
      label: "Projects listing contributors",
      covered: content.projects.filter((p) => p.contributors.length > 0).length,
      total: content.projects.length,
    },
    {
      key: "recognitions-with-publication",
      label: "Awards linked to the paper they were given for",
      covered: content.recognitions.filter((r) => r.publicationId).length,
      total: content.recognitions.length,
    },
  ];

  // The one aggregate the CLI has always printed, kept so a fresh eye sees it without
  // opening Studio.
  const untagged = content.publications.length - (coverage.find((c) => c.key === "publications-with-theme")?.covered ?? 0);
  if (untagged) {
    add({
      level: "warning",
      code: "publications-untagged",
      entity: "publications",
      message: `${untagged}/${content.publications.length} publications have no themeIds — they will not appear in the research browser`,
    });
  }

  return {
    errors: issues.filter((i) => i.level === "error").map((i) => i.message),
    warnings: issues.filter((i) => i.level === "warning").map((i) => i.message),
    issues,
    coverage,
    counts: Object.fromEntries(ENTITY_KINDS.map((kind) => [kind, recordsOf(kind).length])),
  };
}
