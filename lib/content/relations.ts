// The relation graph, declared ONCE.
//
// Before this file, "publications.authors[].personId points at people" was stated in three
// places — the CI validator, a client-side copy of it, and a hardcoded field-name map in the
// Studio form — and the three had already drifted. Everything that needs to know about a
// relation now reads this table:
//
//   * lib/content/validate.ts             — referential integrity in CI
//   * components/studio/review-queue.tsx  — resolving ids to names in a submission diff
//   * components/studio/entity-browser.tsx — which picker backs which field, and delete impact
//   * components/studio/author-linker.tsx  — finding the unlinked references
//
// CLIENT-SAFE: pure data and pure functions, no fs, no node builtins.
import type { EntityKind } from "./schema";

/**
 * How much a relation is worth enforcing.
 *
 *   "required" — the schema itself demands the field, so the only failure mode is a value
 *                that does not resolve. Machine-decidable; CI blocks it.
 *   "optional" — the field may legitimately be absent. A missing link is NOT an error and
 *                must never be treated as one: a paper with no lab author is a real paper.
 *                An absent value is a COVERAGE gap, which only a human can judge.
 *
 * Both kinds are hard errors when the value is present but does not resolve.
 */
export type RelationStrength = "required" | "optional";

/** `site` is the singleton in content/site.yaml; everything else is a record collection. */
export type RelationOwner = EntityKind | "site";

export interface RelationDef {
  from: RelationOwner;
  /** Dotted path into the record. `[]` marks an array hop: `authors[].personId`. */
  path: string;
  to: EntityKind;
  strength: RelationStrength;
  /** Short human phrasing, used in review-queue findings and the health view. */
  label: string;
}

export const RELATIONS: RelationDef[] = [
  { from: "site", path: "primaryInstitutionId", to: "institutions", strength: "optional", label: "primary institution" },

  { from: "people", path: "affiliations[].institutionId", to: "institutions", strength: "required", label: "affiliation institution" },

  { from: "projects", path: "themeIds[]", to: "themes", strength: "optional", label: "research theme" },
  { from: "projects", path: "contributors[]", to: "people", strength: "optional", label: "contributor" },
  { from: "projects", path: "links.publicationId", to: "publications", strength: "optional", label: "related publication" },

  { from: "publications", path: "themeIds[]", to: "themes", strength: "optional", label: "research theme" },
  { from: "publications", path: "authors[].personId", to: "people", strength: "optional", label: "lab author" },

  { from: "posts", path: "authorId", to: "people", strength: "optional", label: "author" },
  { from: "posts", path: "relatedPublicationId", to: "publications", strength: "optional", label: "related publication" },

  { from: "recognitions", path: "personId", to: "people", strength: "required", label: "recipient" },
  { from: "recognitions", path: "publicationId", to: "publications", strength: "optional", label: "publication the award is for" },

  { from: "service", path: "personId", to: "people", strength: "required", label: "person" },

  { from: "courses", path: "personId", to: "people", strength: "required", label: "instructor" },
  { from: "courses", path: "institutionId", to: "institutions", strength: "optional", label: "institution" },
];

/** Where each entity kind's records live in AllContent / SnapshotContent. */
export const COLLECTION_KEY: Record<EntityKind, string> = {
  institutions: "institutions",
  people: "people",
  themes: "researchThemes",
  projects: "projects",
  publications: "publications",
  posts: "posts",
  recognitions: "recognitions",
  service: "service",
  courses: "courses",
  sponsors: "sponsors",
};

/** Directory under content/ for each kind — used to map a changed file back to its entity. */
export const CONTENT_DIR: Record<EntityKind, string> = {
  institutions: "content/institutions",
  people: "content/people",
  themes: "content/themes",
  projects: "content/projects",
  publications: "content/publications",
  posts: "content/posts",
  recognitions: "content/recognitions",
  service: "content/service",
  courses: "content/courses",
  sponsors: "content/sponsors",
};

type Rec = Record<string, unknown>;

export interface ResolvedRef {
  value: string;
  /** Concrete path with array indices filled in: `authors[3].personId`. */
  where: string;
}

/**
 * Walk a relation's path through a record, expanding array hops.
 *
 * Returns one entry per value actually present. An absent optional field yields nothing —
 * "not linked" is not a value, and conflating the two is exactly how a soft relation gets
 * mistakenly promoted to an error.
 */
export function resolveRefs(record: unknown, path: string): ResolvedRef[] {
  const segments = path.split(".");

  const walk = (node: unknown, index: number, where: string): ResolvedRef[] => {
    if (node === undefined || node === null) return [];
    if (index === segments.length) {
      return typeof node === "string" ? [{ value: node, where }] : [];
    }
    const segment = segments[index];
    const isArray = segment.endsWith("[]");
    const key = isArray ? segment.slice(0, -2) : segment;
    const next = (node as Rec)[key];
    if (next === undefined || next === null) return [];
    const prefix = where ? `${where}.` : "";

    if (isArray) {
      if (!Array.isArray(next)) return [];
      return next.flatMap((item, i) => walk(item, index + 1, `${prefix}${key}[${i}]`));
    }
    return walk(next, index + 1, `${prefix}${key}`);
  };

  return walk(record, 0, "");
}

/**
 * Which entity a reference field points at, keyed by the field's own name.
 *
 * Derived from RELATIONS rather than hand-listed, which is the point: add a relation above
 * and the Studio form gets a picker for it automatically instead of silently falling back to
 * a free-text box.
 */
export function refFieldTargets(): Record<string, EntityKind> {
  const out: Record<string, EntityKind> = {};
  for (const relation of RELATIONS) {
    const leaf = relation.path.split(".").pop()?.replace(/\[\]$/, "") ?? "";
    if (leaf) out[leaf] = relation.to;
  }
  return out;
}

/** Human label for a record of a given kind — what a reviewer needs instead of an id. */
export function labelOf(kind: EntityKind, record: Rec | undefined): string | undefined {
  if (!record) return undefined;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = record[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };
  switch (kind) {
    case "people":
      return pick("name");
    case "institutions":
      return pick("shortName", "name");
    case "recognitions":
      return pick("award");
    case "service":
      return pick("role");
    default:
      return pick("title", "name", "id");
  }
}

export interface InboundRef {
  /** The record that points at the target. */
  from: RelationOwner;
  fromId: string;
  where: string;
  relation: RelationDef;
}

/**
 * Every reference pointing AT a given record — what breaks if it is deleted or renamed.
 *
 * `content` is any object with the collection keys of AllContent / SnapshotContent.
 */
export function referencesTo(
  content: Record<string, unknown>,
  kind: EntityKind,
  id: string
): InboundRef[] {
  const out: InboundRef[] = [];
  for (const relation of RELATIONS) {
    if (relation.to !== kind) continue;
    if (relation.from === "site") {
      for (const { value, where } of resolveRefs(content.siteMeta, relation.path)) {
        if (value === id) out.push({ from: "site", fromId: "site.yaml", where, relation });
      }
      continue;
    }
    const records = content[COLLECTION_KEY[relation.from]];
    if (!Array.isArray(records)) continue;
    for (const record of records as Rec[]) {
      for (const { value, where } of resolveRefs(record, relation.path)) {
        if (value === id) {
          out.push({ from: relation.from, fromId: String(record.id ?? "?"), where, relation });
        }
      }
    }
  }
  return out;
}
