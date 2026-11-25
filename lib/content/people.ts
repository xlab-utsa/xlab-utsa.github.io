// Everything derived from a person's lab roles, in ONE place.
//
// Schema v3 stores what a person was in the lab as a list (`labRoles`), and stores nothing
// derived: not "is a current member", not "is alumni", not "which group on the People page".
// Those answers come from here, and only from here — the site, the validator and Studio all
// call these, so the three can never disagree about who counts as alumni.
//
// CLIENT-SAFE: pure functions, no fs. Imported by Studio as well as the build.
import type { Affiliation, LabRole, LabRoleType, Person } from "./schema";

type HasRoles = Pick<Person, "labRoles">;

/** Seniority order — mirrors LabRoleTypeSchema's declaration order. */
export const LAB_ROLE_ORDER: LabRoleType[] = [
  "lab-lead",
  "visiting-faculty",
  "postdoc",
  "research-staff",
  "phd-student",
  "masters-student",
  "undergrad-student",
];

/** Full labels, as a person would pick their position. */
export const LAB_ROLE_LABELS: Record<LabRoleType, string> = {
  "lab-lead": "Lab lead / PI",
  "visiting-faculty": "Visiting faculty",
  postdoc: "Postdoc",
  "research-staff": "Research staff",
  "phd-student": "PhD student",
  "masters-student": "Master's student",
  "undergrad-student": "Undergraduate",
};

/** Short form for dense tiles. */
export const LAB_ROLE_SHORT_LABELS: Record<LabRoleType, string> = {
  "lab-lead": "PI",
  "visiting-faculty": "Visiting",
  postdoc: "Postdoc",
  "research-staff": "Staff",
  "phd-student": "PhD",
  "masters-student": "MS",
  "undergrad-student": "Undergrad",
};

const rank = (r: LabRoleType) => LAB_ROLE_ORDER.indexOf(r);

function bySeniority(a: LabRole, b: LabRole): number {
  return rank(a.role) - rank(b.role);
}

/** The roles a person holds now, most senior first. */
export function currentRoles(person: HasRoles): LabRole[] {
  return (person.labRoles ?? []).filter((r) => r.current).sort(bySeniority);
}

/** In the lab today. */
export function isCurrentMember(person: HasRoles): boolean {
  return currentRoles(person).length > 0;
}

/** Was in the lab, isn't now. */
export function isAlumni(person: HasRoles): boolean {
  return (person.labRoles ?? []).length > 0 && !isCurrentMember(person);
}

export function isLabLead(person: HasRoles): boolean {
  return currentRoles(person).some((r) => r.role === "lab-lead");
}

/**
 * The single role that represents someone: their most senior current role, or — for alumni —
 * the role they left most recently (by `end`, then by seniority when dates are missing).
 */
export function primaryRole(person: HasRoles): LabRole | undefined {
  const now = currentRoles(person);
  if (now.length) return now[0];
  return [...(person.labRoles ?? [])].sort((a, b) => {
    const byEnd = (b.end ?? "").localeCompare(a.end ?? "");
    return byEnd !== 0 ? byEnd : bySeniority(a, b);
  })[0];
}

/** Earliest known start year across all of a person's roles, if any was recorded. */
export function joinedYear(person: HasRoles): number | undefined {
  const starts = (person.labRoles ?? []).map((r) => r.start).filter((s): s is string => Boolean(s));
  if (!starts.length) return undefined;
  return Number(starts.sort()[0].slice(0, 4));
}

/**
 * The groups of the People page (SPEC.md §5). The PI is not a group — it gets its own block.
 * Master's and undergraduate stay separate in the data and share one group on the page.
 */
export type PeopleGroup = "lead" | "faculty-postdocs" | "phd" | "students" | "alumni";

export const PEOPLE_GROUPS: { key: Exclude<PeopleGroup, "lead">; label: string }[] = [
  { key: "faculty-postdocs", label: "Postdocs & Visiting Faculty" },
  { key: "phd", label: "PhD Students" },
  { key: "students", label: "Masters & Undergraduates" },
  { key: "alumni", label: "Alumni" },
];

export function peopleGroup(person: HasRoles): PeopleGroup | undefined {
  if (isAlumni(person)) return "alumni";
  const role = primaryRole(person)?.role;
  switch (role) {
    case "lab-lead":
      return "lead";
    case "visiting-faculty":
    case "postdoc":
    case "research-staff":
      return "faculty-postdocs";
    case "phd-student":
      return "phd";
    case "masters-student":
    case "undergrad-student":
      return "students";
    default:
      return undefined;
  }
}

/**
 * Where an alumnus is now: the first affiliation that has not ended. By convention
 * (schema.ts, AffiliationSchema) the first entry is the current one.
 */
export function nowAt(person: Pick<Person, "affiliations">): Affiliation | undefined {
  return person.affiliations?.find((a) => !a.endDate);
}

/**
 * Index into `labRoles` of the role a single-role form should edit: the most senior current
 * role, else the most recent past one. -1 when the person has no roles yet.
 */
export function editableRoleIndex(labRoles: LabRole[] | undefined): number {
  if (!labRoles?.length) return -1;
  const target = primaryRole({ labRoles });
  return target ? labRoles.indexOf(target) : 0;
}
