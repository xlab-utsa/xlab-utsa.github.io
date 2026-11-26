// Everything the People page (and its previews in app/preview/people/**) renders, gathered once.
//
// SERVER/BUILD ONLY. Real fields only: a member's research areas, paper counts, recent papers
// and lab co-authors all come from confirmed author links (Publication.authors[].personId);
// nothing is written for anyone. Only the PI has a bio and profile in content.
import {
  getAllPeople,
  getGalleryPhotos,
  getAllVenues,
  getPublications,
  getRecognitionsByPerson,
  getResearchThemes,
  type Person,
} from "@/lib/content";
import { publicFileExists } from "@/lib/content/assets";
import { isLabLead, nowAt, PEOPLE_GROUPS, peopleGroup, primaryRole, LAB_ROLE_SHORT_LABELS } from "@/lib/content/people";
import { shortThemeLabel } from "@/lib/home/data";
import { getResearchMap } from "@/lib/research-map";
import { getAffiliationInstitutionLabel, sortPeople, summarizeRecognitions } from "@/lib/team";

export interface PersonLink {
  key: "email" | "scholar" | "website" | "linkedin" | "github";
  label: string;
  href: string;
}

export interface PreviewPaper {
  id: string;
  title: string;
  year?: number;
  venue?: string;
}

export interface PreviewPerson {
  id: string;
  name: string;
  group: (typeof PEOPLE_GROUPS)[number]["key"];
  role: string;
  roleTitle: string;
  photo?: string;
  links: PersonLink[];
  papers: number;
  themes: { id: string; label: string; count: number }[];
  recent: PreviewPaper[];
  coauthors: { id: string; name: string; count: number }[];
  /** Alumni: where they are now, e.g. "Assistant Professor" at "Penn State". */
  now?: { title: string; where: string };
}

const LINK_ORDER: [PersonLink["key"], string][] = [
  ["website", "Website"],
  ["scholar", "Google Scholar"],
  ["github", "GitHub"],
  ["linkedin", "LinkedIn"],
  ["email", "Email"],
];

function linksOf(p: Person): PersonLink[] {
  const l = p.links ?? {};
  return LINK_ORDER.flatMap(([key, label]) => {
    const v = l[key];
    if (!v) return [];
    return [{ key, label, href: key === "email" ? `mailto:${v}` : v }];
  });
}

export function getPeopleDirectory() {
  const people = sortPeople(getAllPeople());
  const lead = people.find(isLabLead)!;
  const themes = getResearchThemes();
  const themeLabel = new Map(themes.map((t) => [t.id, shortThemeLabel(t.title)]));
  const venueLabel = new Map(getAllVenues().map((v) => [v.id, v.shortName]));
  const pubs = [...getPublications()]
    .filter((p) => p.category !== "patent")
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  const toPerson = (p: Person): PreviewPerson => {
    const mine = pubs.filter((x) => x.authors.some((a) => a.personId === p.id));
    const t = new Map<string, number>();
    const co = new Map<string, number>();
    for (const x of mine) {
      for (const id of x.themeIds) t.set(id, (t.get(id) ?? 0) + 1);
      for (const a of x.authors) {
        if (a.personId && a.personId !== p.id && a.personId !== lead.id && nameOf.has(a.personId)) {
          co.set(a.personId, (co.get(a.personId) ?? 0) + 1);
        }
      }
    }
    const role = primaryRole(p)?.role;
    const now = peopleGroup(p) === "alumni" ? nowAt(p) : undefined;
    return {
      id: p.id,
      name: p.name,
      group: peopleGroup(p) as PreviewPerson["group"],
      role: role ? LAB_ROLE_SHORT_LABELS[role] : "",
      roleTitle: p.roleTitle,
      photo: publicFileExists(p.photo) ? p.photo : undefined,
      links: linksOf(p),
      papers: mine.length,
      themes: [...t.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, label: themeLabel.get(id) ?? id, count })),
      recent: mine.slice(0, 3).map((x) => ({ id: x.id, title: x.title, year: x.year, venue: x.venueId ? venueLabel.get(x.venueId) : undefined })),
      coauthors: [...co.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, name: nameOf.get(id)!, count })),
      now: now ? { title: now.roleTitle, where: getAffiliationInstitutionLabel(now) } : undefined,
    };
  };

  const everyone = people.filter((p) => p.id !== lead.id).map(toPerson);
  const groups = PEOPLE_GROUPS.map((g) => ({ ...g, people: everyone.filter((p) => p.group === g.key) })).filter(
    (g) => g.people.length > 0
  );

  const prof = lead.profile ?? {};
  const pi = {
    ...toPerson(lead),
    title: lead.roleTitle,
    /** The lab's environmental portrait of the director (gallery photo), for large layouts. */
    portrait: getGalleryPhotos().find((g) => g.id === "1a1a2622")?.image ?? lead.photo,
    secondary: lead.secondaryTitles ?? [],
    bio: lead.bio?.trim() ?? "",
    philosophy: prof.researchPhilosophy?.trim(),
    quote: prof.quote?.trim(),
    interests: prof.researchInterests ?? [],
    vision: prof.futureVision?.trim(),
    education: (prof.education ?? []).map((e) => ({ degree: e.degree, institution: e.institution, year: e.year, note: e.note })),
    appointments: (lead.affiliations ?? []).map((a) => ({ role: a.roleTitle, where: getAffiliationInstitutionLabel(a), current: !a.endDate })),
    /** Honors as numbers ("22 Professional Honors" → { n: 22, label: "Professional Honors" }). */
    honorCounts: summarizeRecognitions(getRecognitionsByPerson(lead.id)).map((line) => {
      const m = line.match(/^(\d+)\s+(.*)$/);
      return m ? { n: Number(m[1]), label: m[2] } : { n: 0, label: line };
    }),
    honors: summarizeRecognitions(getRecognitionsByPerson(lead.id)),
    papers: getPublications().filter((p) => p.category !== "patent").length,
  };

  const map = getResearchMap(12);

  return {
    pi,
    groups,
    members: everyone.filter((p) => p.group !== "alumni"),
    alumni: everyone.filter((p) => p.group === "alumni"),
    themes: themes.map((t) => ({ id: t.id, title: t.title, label: shortThemeLabel(t.title) })),
    map,
  };
}

export type PeopleDirectory = ReturnType<typeof getPeopleDirectory>;

/** Old name, used by the People previews. */
export const getPeoplePreviewData = getPeopleDirectory;
