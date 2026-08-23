// The shape of a validation report.
//
// Split out from validate.ts, which reads the filesystem, so the Studio can describe and
// render a report in the browser without pulling `fs` into the client bundle. The report
// itself is produced once at build time by scripts/build-snapshot.ts and shipped inside
// public/content-snapshot.json.
//
// CLIENT-SAFE: types only.

export type IssueLevel = "error" | "warning";

/**
 * A single finding, in a form the Studio can group and render.
 *
 * `code` is the stable machine name for the kind of problem; `message` is the sentence a
 * person reads. Grouping by code rather than by message is what keeps the health view
 * readable when 284 records share one problem.
 */
export interface Issue {
  level: IssueLevel;
  code: string;
  /** Which collection the offending record belongs to, or "site"/"assets". */
  entity: string;
  id?: string;
  /** Field path within the record, when the problem is field-level. */
  where?: string;
  message: string;
}

/**
 * How many records have made an optional link at all.
 *
 * Never an error. A paper with no lab author is a real paper; blocking it would only teach
 * people to invent links. Measured in aggregate so it can be worked through deliberately,
 * rather than nagged about once per record.
 */
export interface CoverageStat {
  key: string;
  label: string;
  covered: number;
  total: number;
  hint?: string;
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  issues: Issue[];
  coverage: CoverageStat[];
  counts: Record<string, number>;
}

/** What build-snapshot.ts embeds in the snapshot — the verdict without the flat string lists. */
export type SnapshotReport = Pick<ValidationReport, "issues" | "coverage">;

/** Human wording for the issue codes the Studio groups by. */
export const ISSUE_TITLES: Record<string, string> = {
  schema: "Record does not match the schema",
  "duplicate-id": "Duplicate id",
  "dangling-reference": "Link points at a record that does not exist",
  "published-points-at-unpublished": "Published record links to a draft or hidden one",
  "duplicate-doi": "Two publications share one DOI",
  "possible-duplicate-publication": "Possibly the same paper entered twice",
  "missing-asset": "Referenced image is missing",
  "unreferenced-image": "Image on disk that nothing uses",
  "no-joined-year": "No joined year — cannot become alumni",
  "no-photo": "No photo",
  "publications-untagged": "Publications with no research theme",
  "integrity-skipped": "Integrity checks were skipped",
};
