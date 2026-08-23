// Team-section helpers. `lib/content/index.ts`'s getters intentionally don't sort by
// `sortWeight` or group by `personType` (that's presentation, not data-loading) — this
// module owns that, plus the card click-through resolution from SPEC.md decision #4.
import {
  getInstitutionById,
  type Affiliation,
  type Person,
  type Recognition,
  type RecognitionCategory,
} from "@/lib/content";

type PersonType = Person["personType"];

export function scholarSearchUrl(name: string): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(name)}`;
}

// SPEC.md decision #4 (updated): links.redirectUrl overrides everything when set;
// otherwise fall back through the original priority chain, ending in a generated
// Google Scholar search so no card is ever a dead click.
export function resolvePersonRedirectUrl(person: Person): string {
  const links = person.links;
  return (
    links?.redirectUrl ||
    links?.website ||
    links?.linkedin ||
    links?.github ||
    links?.scholar ||
    scholarSearchUrl(person.name)
  );
}

// Which of a person's (possibly several, historical) affiliations represents "their"
// institution for the team card tag: prefer an ongoing primary role, then any ongoing
// role, then just the first on record.
export function getPrimaryAffiliation(person: Person): Affiliation | undefined {
  const affiliations = person.affiliations;
  if (!affiliations || affiliations.length === 0) return undefined;
  return (
    affiliations.find((a) => a.type === "primary" && !a.endDate) ??
    affiliations.find((a) => !a.endDate) ??
    affiliations[0]
  );
}

export function getAffiliationInstitutionLabel(affiliation: Affiliation): string {
  const institution = getInstitutionById(affiliation.institutionId);
  return institution?.shortName ?? institution?.name ?? affiliation.institutionId;
}

export function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    const weightDiff =
      (a.sortWeight ?? Number.POSITIVE_INFINITY) -
      (b.sortWeight ?? Number.POSITIVE_INFINITY);
    if (weightDiff !== 0) return weightDiff;
    return a.name.localeCompare(b.name);
  });
}

// Declaration order in types/content.ts's PersonType union is the intended seniority
// order for #team groupings.
export const PERSON_TYPE_GROUPS: { type: PersonType; label: string }[] = [
  { type: "lab-lead", label: "Lab Lead" },
  { type: "postdoc", label: "Postdoctoral Researchers" },
  { type: "research-staff", label: "Research Staff" },
  { type: "phd-student", label: "PhD Students" },
  { type: "masters-student", label: "Master's Students" },
  { type: "undergrad-student", label: "Undergraduate Students" },
  { type: "grad-collaborator", label: "Graduate Collaborators" },
];

export function groupByPersonType(
  people: Person[]
): { type: PersonType; label: string; people: Person[] }[] {
  const sorted = sortPeople(people);
  return PERSON_TYPE_GROUPS.map(({ type, label }) => ({
    type,
    label,
    people: sorted.filter((p) => p.personType === type),
  })).filter((group) => group.people.length > 0);
}

// Short form for dense tiles (hero "lab, today" band, compact member grids) where
// the full PERSON_TYPE_GROUPS label ("Postdoctoral Researchers") is too long.
const PERSON_TYPE_SHORT_LABELS: Record<PersonType, string> = {
  "lab-lead": "PI",
  postdoc: "Postdoc",
  "research-staff": "Staff",
  "phd-student": "PhD",
  "masters-student": "MS",
  "undergrad-student": "Undergrad",
  "grad-collaborator": "Collaborator",
};

export function personTypeShortLabel(type: PersonType): string {
  return PERSON_TYPE_SHORT_LABELS[type];
}

const RECOGNITION_CATEGORY_LABELS: Record<RecognitionCategory, string> = {
  "best-paper-award": "Best Paper Award",
  "best-paper-nomination": "Best Paper Nomination",
  "best-poster-award": "Best Poster Award",
  "international-competition-award": "International Competition Award",
  "professional-honor-award": "Professional Honor",
};

// Collapses a person's Recognition records into short "N Best Paper Awards"-style
// summary lines (largest category first) — the PI's Honors list currently has 54
// entries, far too many to itemize individually.
export function summarizeRecognitions(recognitions: Recognition[]): string[] {
  const counts = new Map<RecognitionCategory, number>();
  for (const r of recognitions) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => {
      const label = RECOGNITION_CATEGORY_LABELS[category];
      return count === 1 ? `1 ${label}` : `${count} ${label}s`;
    });
}
