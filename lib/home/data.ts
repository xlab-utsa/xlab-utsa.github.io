// Everything the home page (and the design previews in app/preview/**) render, gathered once.
//
// SERVER/BUILD ONLY (reads content via lib/content). Every figure is computed from the
// content tree exactly as the live home page does, so the seven previews differ only in
// design, never in data. Preview-only words (the longer bio, photo captions) live in
// ./copy.ts and are clearly marked there.
import {
  getAllProjects,
  getAllRecognitions,
  getAllSponsors,
  getAllVenues,
  getAlumniPeople,
  getCurrentPeople,
  getGalleryPhotos,
  getPostsByKind,
  getPublications,
  getPublicationsByTheme,
  getRecognitionsByPerson,
  getResearchThemes,
  getSiteMeta,
  type Person,
  type RecognitionCategory,
} from "@/lib/content";
import { isLabLead, nowAt, primaryRole, LAB_ROLE_SHORT_LABELS } from "@/lib/content/people";
import { getAffiliationInstitutionLabel, sortPeople, summarizeRecognitions } from "@/lib/team";
import { getResearchMap } from "@/lib/research-map";
import { PHOTO_CAPTIONS, PI_LONG_BIO } from "./copy";

/** "Electronic Design Automation" → "EDA": long area names do not fit tight layouts. */
export function shortThemeLabel(title: string): string {
  if (title.length <= 18) return title;
  return title
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("");
}

export interface PreviewPerson {
  id: string;
  name: string;
  role: string;
  photo?: string;
  nowAt?: string;
  url?: string;
}

function toPreviewPerson(p: Person): PreviewPerson {
  const current = nowAt(p);
  const role = primaryRole(p)?.role;
  return {
    id: p.id,
    name: p.name,
    role: role ? LAB_ROLE_SHORT_LABELS[role] : "",
    photo: p.photo,
    nowAt: current ? `${current.roleTitle}, ${getAffiliationInstitutionLabel(current)}` : undefined,
    url: p.links?.redirectUrl ?? p.links?.website ?? p.links?.scholar,
  };
}

export function getHomeData() {
  const site = getSiteMeta();
  const publications = getPublications();
  const recognitions = getAllRecognitions();
  const count = (c: RecognitionCategory) => recognitions.filter((r) => r.category === c).length;

  const themes = getResearchThemes().map((t) => {
    const pubs = getPublicationsByTheme(t.id);
    return {
      id: t.id,
      title: t.title,
      label: shortThemeLabel(t.title),
      short: t.shortDescription,
      count: pubs.length,
      recent: pubs.filter((p) => p.category !== "patent").slice(0, 3).map((p) => ({ id: p.id, title: p.title, year: p.year })),
    };
  });

  const venueCounts = new Map<string, number>();
  for (const p of publications) if (p.venueId) venueCounts.set(p.venueId, (venueCounts.get(p.venueId) ?? 0) + 1);
  const venues = getAllVenues()
    .filter((v) => venueCounts.has(v.id))
    .map((v) => ({ id: v.id, label: v.shortName, name: v.name, kind: v.kind, value: venueCounts.get(v.id)! }))
    .sort((a, b) => b.value - a.value);

  const byYear = new Map<number, number>();
  for (const p of publications) if (p.year) byYear.set(p.year, (byYear.get(p.year) ?? 0) + 1);
  const years = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year, value }));

  const current = getCurrentPeople();
  const piRecord = current.find(isLabLead)!;
  const patents = publications.filter((p) => p.category === "patent").length;
  const pi = {
    name: piRecord.name,
    title: piRecord.roleTitle,
    secondary: piRecord.secondaryTitles ?? [],
    photo: piRecord.photo,
    shortBio: piRecord.bio?.trim() ?? "",
    longBio: PI_LONG_BIO,
    education: piRecord.profile?.education ?? [],
    appointments: (piRecord.affiliations ?? []).filter((a) => !a.endDate).map((a) => `${a.roleTitle}, ${getAffiliationInstitutionLabel(a)}`),
    honors: summarizeRecognitions(getRecognitionsByPerson(piRecord.id)),
    quote: piRecord.profile?.quote,
    patents,
  };

  const members = sortPeople(current.filter((p) => p.id !== piRecord.id)).map(toPreviewPerson);
  const alumni = sortPeople(getAlumniPeople()).map(toPreviewPerson);

  const stats = [
    { key: "pubs", n: publications.length, label: "Publications" },
    { key: "members", n: current.length, label: "Lab members" },
    { key: "best", n: count("best-paper-award"), label: "Best Paper Awards" },
    { key: "noms", n: count("best-paper-nomination"), label: "Best Paper nominations" },
    { key: "intl", n: count("international-competition-award"), label: "Competition awards" },
    { key: "projects", n: getAllProjects().length, label: "Open-source projects" },
  ];

  const photos = getGalleryPhotos().map((g) => ({
    id: g.id,
    src: g.image,
    date: g.date,
    caption: g.caption ?? PHOTO_CAPTIONS[g.id] ?? "X-Lab",
  }));

  const { links, venueLinks, venueGroup } = getResearchMap();

  // Industry first, then government, then the university.
  const kindRank = { industry: 0, foundation: 1, government: 2, university: 3 } as const;
  const sponsors = [...getAllSponsors()].sort(
    (x, y) =>
      kindRank[x.kind ?? "industry"] - kindRank[y.kind ?? "industry"] ||
      x.name.localeCompare(y.name)
  );

  return {
    site,
    stats,
    themes,
    venues: venues.map((v) => ({ ...v, group: venueGroup.get(v.id) ?? ("other" as const) })),
    years,
    pi,
    members,
    alumni,
    projects: getAllProjects(),
    news: getPostsByKind("news"),
    blog: getPostsByKind("blog"),
    sponsors,
    photos,
    links,
    venueLinks,
    totals: { publications: publications.length, venues: venues.length, patents },
  };
}

export type HomeData = ReturnType<typeof getHomeData>;
