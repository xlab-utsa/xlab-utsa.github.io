// What to suggest to a member filling in their profile, derived from what the lab already
// has. Nothing here is invented: every suggestion is a value that other members' records
// actually carry (the most common department, the title pattern for that position, a real
// bio to imitate) or a plain fact (the site's primary institution, the current year).
//
// CLIENT-SAFE: pure functions over the snapshot.
"use client";

import type { Person, SiteMeta } from "@/lib/content/schema";

type Rec = Record<string, unknown>;

export const PERSON_TYPE_LABELS: Record<string, string> = {
  "lab-lead": "Lab lead / PI",
  postdoc: "Postdoc",
  "research-staff": "Research staff",
  "phd-student": "PhD student",
  "masters-student": "Master's student",
  "undergrad-student": "Undergraduate",
  "grad-collaborator": "Collaborator",
};

/** How that position is usually written on a title line. */
const PERSON_TYPE_TITLE: Record<string, string> = {
  "lab-lead": "Lab Lead",
  postdoc: "Postdoctoral Researcher",
  "research-staff": "Research Staff",
  "phd-student": "PhD Student",
  "masters-student": "Master's Student",
  "undergrad-student": "Undergraduate Researcher",
  "grad-collaborator": "Graduate Collaborator",
};

export const LINK_KEYS = ["email", "scholar", "website", "linkedin", "github", "universityProfile"] as const;
export type LinkKey = (typeof LINK_KEYS)[number];

export interface ProfileRecommendations {
  /** A title line in the lab's usual shape for this position, or undefined when there is no position yet. */
  titleLine?: string;
  /** Institution id most lab members (of this position, else everyone) are affiliated with. */
  institutionId?: string;
  institutionName?: string;
  /** Department most lab members (of this position, else everyone) list. */
  department?: string;
  /** A short real bio from a lab-mate, to imitate. */
  bioExample?: { name: string; bio: string };
  /** A first-sentence starter using the member's own first name. */
  bioStarter: string;
  /** How many members carry each link, out of `memberCount`. */
  linkCounts: Record<LinkKey, number>;
  memberCount: number;
  /** The link lab-mates list most; what a visitor is most likely to look for. */
  topLink?: LinkKey;
  currentYear: number;
}

function mostCommon(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function profileRecommendations(
  record: Rec,
  content: { people: Person[]; institutions: { id: string; name: string; shortName?: string }[]; siteMeta?: SiteMeta }
): ProfileRecommendations {
  const self = String(record.id ?? "");
  const others = content.people.filter((p) => p.id !== self);
  const type = typeof record.personType === "string" ? record.personType : undefined;
  const peers = others.filter((p) => p.personType === type);
  // Peers first; the whole lab when there are none of this position yet.
  const pool = peers.length ? peers : others;

  const department = mostCommon(pool.map((p) => p.affiliations?.[0]?.department));
  const institutionId =
    mostCommon(pool.map((p) => p.affiliations?.[0]?.institutionId)) ?? content.siteMeta?.primaryInstitutionId;
  const inst = content.institutions.find((i) => i.id === institutionId);

  const titleBase = type ? PERSON_TYPE_TITLE[type] : undefined;
  const titleLine = titleBase ? (department ? `${titleBase}, ${department}` : titleBase) : undefined;

  const withBio = others
    .filter((p) => p.bio && p.bio.trim().length >= 60 && p.bio.trim().length <= 400)
    .sort((a, b) => (a.bio?.length ?? 0) - (b.bio?.length ?? 0));
  const bioExample = withBio[0] ? { name: withBio[0].name, bio: withBio[0].bio!.trim() } : undefined;

  const first = String(record.name ?? "").trim().split(/\s+/)[0] || "Jane";
  const bioStarter = `${first} works on `;

  const linkCounts = Object.fromEntries(LINK_KEYS.map((k) => [k, 0])) as Record<LinkKey, number>;
  for (const p of others) for (const k of LINK_KEYS) if (p.links?.[k]) linkCounts[k]++;
  const topLink = (LINK_KEYS.filter((k) => k !== "email").sort((a, b) => linkCounts[b] - linkCounts[a])[0] ?? undefined) as
    | LinkKey
    | undefined;

  return {
    titleLine,
    institutionId,
    institutionName: inst ? (inst.shortName ?? inst.name) : undefined,
    department,
    bioExample,
    bioStarter,
    linkCounts,
    memberCount: others.length,
    topLink: topLink && linkCounts[topLink] > 0 ? topLink : undefined,
    currentYear: new Date().getFullYear(),
  };
}

/** Initials for the avatar placeholder: "Jane Q. Doe" → "JD". */
export function initialsOf(name: unknown): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? [parts[0]] : [parts[0], parts[parts.length - 1]];
  return letters.map((w) => w[0]!.toUpperCase()).join("");
}
