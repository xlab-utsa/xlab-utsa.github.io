import raw from "../synthetic/data.generated.json";
import { entities } from "./schema-graph";

export interface SyntheticRecord {
  record: Record<string, unknown>;
  covers: string[];
}

export interface CoverageEntry {
  totalRecords: number;
  tagCounts: Record<string, number>;
}

const dataset = raw.dataset as Record<string, SyntheticRecord[]>;
const coverage = raw.coverage as Record<string, CoverageEntry>;

export function getRecordsForEntity(entityId: string): SyntheticRecord[] {
  return dataset[entityId] ?? [];
}

export function getCoverage(entityId: string): CoverageEntry | undefined {
  return coverage[entityId];
}

export function getAllCoverage(): Record<string, CoverageEntry> {
  return coverage;
}

/** Human-readable label for a record, so FK targets don't just show a raw id. */
export function getDisplayLabel(entityId: string, record: Record<string, unknown>): string {
  switch (entityId) {
    case "institution":
      return String(record.name ?? record.id);
    case "person":
      return String(record.name ?? record.id);
    case "research-theme":
      return String(record.title ?? record.id);
    case "project":
      return String(record.title ?? record.id);
    case "publication":
      return String(record.title ?? record.id);
    case "post":
      return String(record.title ?? record.id);
    case "site-meta":
      return String(record.title ?? "Site Meta");
    case "recognition": {
      const award = record.award ? String(record.award) : "";
      const title = record.title ? `: ${record.title}` : "";
      return `${award}${title}` || String(record.id);
    }
    case "service-record":
      return String(record.role ?? record.id);
    case "course":
      return String(record.title ?? record.id);
    case "sponsor":
      return String(record.name ?? record.id);
    default:
      return String((record as { id?: unknown }).id ?? "?");
  }
}

export function findRecordById(entityId: string, id: string): SyntheticRecord | undefined {
  return getRecordsForEntity(entityId).find((r) => (r.record as { id?: unknown }).id === id);
}

// ---------------------------------------------------------------------------
// Global id -> {entityId, label} lookup, built once. This is what lets the Fields
// view resolve an id the MOMENT it's encountered — top-level (Project.themeId) or
// buried in a nested array (Person.affiliations[].institutionId) — instead of only
// resolving the handful of relationships explicitly listed in getRelatedRefs below.
// Any string value found anywhere in a record gets checked against this map.
// ---------------------------------------------------------------------------
const idLookup = new Map<string, { entityId: string; label: string }>();
for (const entity of entities) {
  for (const { record } of getRecordsForEntity(entity.id)) {
    const id = (record as { id?: unknown }).id;
    if (typeof id === "string") {
      idLookup.set(id, { entityId: entity.id, label: getDisplayLabel(entity.id, record) });
    }
  }
}

/** If `value` is a known record id anywhere in the dataset, returns what it resolves
 * to. Used to annotate raw ids inline wherever they appear, not just in a separate
 * "Relationships" summary. */
export function resolveId(value: unknown): { entityId: string; label: string } | undefined {
  return typeof value === "string" ? idLookup.get(value) : undefined;
}

export interface RelatedRef {
  fieldLabel: string;
  targetEntityId: string;
  targetId: string;
}

/** Resolves every outgoing FK reference for a record, entity by entity — mirrors the
 * relationships declared in schema-graph.ts's `fk` metadata, but reads the actual
 * (sometimes nested) field on the real record rather than a generic path-walker,
 * since there are only 11 relationships total and hand-written accessors are more
 * robust than a generic dot/bracket-path resolver for this small a set. */
export function getRelatedRefs(entityId: string, record: Record<string, unknown>): RelatedRef[] {
  const refs: RelatedRef[] = [];
  const push = (fieldLabel: string, targetEntityId: string, targetId: unknown) => {
    if (typeof targetId === "string" && targetId.length > 0) {
      refs.push({ fieldLabel, targetEntityId, targetId });
    }
  };

  switch (entityId) {
    case "person": {
      const affiliations = (record.affiliations as Array<{ institutionId?: string }> | undefined) ?? [];
      affiliations.forEach((a, i) => push(`affiliations[${i}].institutionId`, "institution", a.institutionId));
      break;
    }
    case "project": {
      push("themeId", "research-theme", record.themeId);
      const links = record.links as { publicationId?: string } | undefined;
      push("links.publicationId", "publication", links?.publicationId);
      const contributors = (record.contributors as string[] | undefined) ?? [];
      contributors.forEach((personId, i) => push(`contributors[${i}]`, "person", personId));
      break;
    }
    case "publication": {
      const authors = (record.authors as Array<{ personId?: string }> | undefined) ?? [];
      authors.forEach((a, i) => push(`authors[${i}].personId`, "person", a.personId));
      break;
    }
    case "post": {
      push("authorId", "person", record.authorId);
      push("relatedPublicationId", "publication", record.relatedPublicationId);
      break;
    }
    case "site-meta": {
      push("primaryInstitutionId", "institution", record.primaryInstitutionId);
      break;
    }
    case "recognition": {
      push("personId", "person", record.personId);
      push("publicationId", "publication", record.publicationId);
      break;
    }
    case "service-record": {
      push("personId", "person", record.personId);
      break;
    }
    case "course": {
      push("personId", "person", record.personId);
      push("institutionId", "institution", record.institutionId);
      break;
    }
    default:
      break;
  }
  return refs;
}

/** Which OTHER records point at this one — the reverse direction, computed on demand. */
export function getIncomingRefs(entityId: string, id: string): Array<{ fromEntityId: string; fromRecordId: string; fieldLabel: string }> {
  const incoming: Array<{ fromEntityId: string; fromRecordId: string; fieldLabel: string }> = [];
  for (const otherEntity of entities) {
    for (const { record } of getRecordsForEntity(otherEntity.id)) {
      const refs = getRelatedRefs(otherEntity.id, record);
      for (const ref of refs) {
        if (ref.targetEntityId === entityId && ref.targetId === id) {
          incoming.push({ fromEntityId: otherEntity.id, fromRecordId: String(record.id), fieldLabel: ref.fieldLabel });
        }
      }
    }
  }
  return incoming;
}

/** A couple of quick-glance facts per entity for the table view — deliberately not
 * exhaustive, just enough to recognize a row without opening the detail panel. */
export function getQuickFacts(entityId: string, record: Record<string, unknown>): string[] {
  switch (entityId) {
    case "person":
      return [
        String(record.personType),
        `${((record.affiliations as unknown[] | undefined) ?? []).length} affiliation(s)`,
        record.profile ? "has profile" : "",
      ].filter(Boolean);
    case "publication": {
      const authors = (record.authors as Array<{ personId?: string }> | undefined) ?? [];
      const linkedCount = authors.filter((a) => a.personId).length;
      return [
        String(record.category),
        String(record.year ?? "?"),
        record.featured ? "featured" : "",
        linkedCount > 0 ? `${linkedCount} lab author(s)` : "",
      ].filter(Boolean);
    }
    case "project": {
      const contributors = (record.contributors as unknown[] | undefined) ?? [];
      return [
        String(record.status ?? "?"),
        record.themeId ? "themed" : "no theme",
        record.featured ? "featured" : "",
        contributors.length > 0 ? `${contributors.length} contributor(s)` : "",
      ].filter(Boolean);
    }
    case "post":
      return [String(record.kind), String(record.date), record.body ? "has body" : "no body"].filter(Boolean);
    case "recognition":
      return [String(record.category), String(record.year ?? "?")];
    case "service-record":
      return [String(record.category), String(record.periodDisplay ?? "")];
    case "course":
      return [String(record.termDisplay ?? "")];
    case "institution":
      return [String(record.country ?? "")].filter(Boolean);
    case "sponsor":
      return [`${((record.grantNumbers as unknown[] | undefined) ?? []).length} grant(s)`];
    default:
      return [];
  }
}

export { dataset };
