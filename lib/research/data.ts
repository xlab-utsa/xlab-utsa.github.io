// Everything the research-page design previews (app/preview/research/**) render, gathered
// once. SERVER/BUILD ONLY. Every figure is computed from the content tree, so the four
// designs differ only in layout, never in data.
import {
  getAllRecognitions,
  getAllVenues,
  getPersonById,
  getProjectsByTheme,
  getPublications,
  getPublicationsByTheme,
  getResearchThemes,
  type Publication,
  type RecognitionCategory,
} from "@/lib/content";
import { publicFileExists } from "@/lib/content/assets";
import { shortThemeLabel } from "@/lib/home/data";
import { getCategoryMetaLine, PUBLICATION_CATEGORIES } from "@/lib/publications";
import { resolvePersonRedirectUrl } from "@/lib/team";

/** Award categories a paper can carry, best first, with the label shown on a paper. */
export const PAPER_AWARDS: { key: RecognitionCategory; label: string }[] = [
  { key: "best-paper-award", label: "Best Paper Award" },
  { key: "international-competition-award", label: "Competition Award" },
  { key: "best-paper-nomination", label: "Best Paper Nomination" },
  { key: "best-poster-award", label: "Best Poster Award" },
];

/** A publication flattened for the client-side library (plain data, no JSX). */
export interface LibPub {
  id: string;
  title: string;
  authors: { name: string; href?: string }[];
  year?: number;
  date?: string;
  category: Publication["category"];
  venue?: string;
  venueShort?: string;
  meta?: string;
  note?: string;
  themeIds: string[];
  doi?: string;
  url?: string;
  thumbnail?: string;
  awards: string[];
  awardRank: number;
}

function dateOf(p: Publication): string | undefined {
  if (p.dateDisplay) return p.dateDisplay;
  if (p.month && p.year) return `${p.month} ${p.year}`;
  return p.year ? String(p.year) : undefined;
}

export function getResearchData() {
  const publications = getPublications();
  const venues = new Map(getAllVenues().map((v) => [v.id, v]));
  const recognitions = getAllRecognitions().filter((r) => r.publicationId);

  const awardsOf = new Map<string, RecognitionCategory[]>();
  for (const r of recognitions) {
    const list = awardsOf.get(r.publicationId!) ?? [];
    if (!list.includes(r.category)) list.push(r.category);
    awardsOf.set(r.publicationId!, list);
  }
  const rankOf = (cats: RecognitionCategory[]) =>
    Math.min(...cats.map((c) => PAPER_AWARDS.findIndex((a) => a.key === c)).filter((i) => i >= 0), 99);

  const pubs: LibPub[] = publications.map((p) => {
    const cats = awardsOf.get(p.id) ?? [];
    const venue = p.venueId ? venues.get(p.venueId) : undefined;
    return {
      id: p.id,
      title: p.title,
      authors: p.authors.map((a) => {
        const person = a.personId ? getPersonById(a.personId) : undefined;
        return { name: a.name, href: person ? resolvePersonRedirectUrl(person) : undefined };
      }),
      year: p.year,
      date: dateOf(p),
      category: p.category,
      venue: p.venue,
      venueShort: venue?.shortName,
      meta: getCategoryMetaLine(p),
      note: p.note,
      themeIds: p.themeIds,
      doi: p.doi ? (p.doi.startsWith("http") ? p.doi : `https://doi.org/${p.doi}`) : undefined,
      url: p.url,
      thumbnail: publicFileExists(p.thumbnail) ? p.thumbnail : undefined,
      awards: PAPER_AWARDS.filter((a) => cats.includes(a.key)).map((a) => a.label),
      awardRank: rankOf(cats),
    };
  });

  const years = pubs.map((p) => p.year).filter((y): y is number => !!y);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearRange = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const themes = getResearchThemes().map((t) => {
    const own = getPublicationsByTheme(t.id);
    const perYear = yearRange.map((y) => own.filter((p) => p.year === y).length);
    const vc = new Map<string, number>();
    for (const p of own) if (p.venueId) vc.set(p.venueId, (vc.get(p.venueId) ?? 0) + 1);
    const topVenues = [...vc.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, n]) => ({ id, label: venues.get(id)?.shortName ?? id, n }));
    const active = yearRange.filter((_, i) => perYear[i] > 0);
    const featured = own
      .filter((p) => p.featured && p.themeIds[0] === t.id)
      .sort((a, b) => (a.featuredOrder ?? 1e9) - (b.featuredOrder ?? 1e9))
      .map((p) => pubs.find((x) => x.id === p.id)!);
    const withFigures = pubs.filter((p) => p.themeIds[0] === t.id && p.thumbnail);
    return {
      id: t.id,
      title: t.title,
      label: shortThemeLabel(t.title),
      short: t.shortDescription,
      long: t.longDescription ?? "",
      count: own.length,
      perYear,
      since: active[0],
      latest: active[active.length - 1],
      peak: yearRange[perYear.indexOf(Math.max(...perYear))],
      topVenues,
      awards: own.filter((p) => awardsOf.has(p.id)).length,
      projects: getProjectsByTheme(t.id).map((p) => ({ id: p.id, title: p.title, tagline: p.tagline, thumbnail: p.thumbnail })),
      featured,
      figures: (featured.filter((p) => p.thumbnail).length >= 3 ? featured.filter((p) => p.thumbnail) : withFigures).slice(0, 6),
    };
  });

  const categories = PUBLICATION_CATEGORIES.map((c) => ({ ...c, count: pubs.filter((p) => p.category === c.key).length }));

  return {
    pubs: [...pubs].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    themes,
    categories,
    yearRange,
    totals: {
      publications: pubs.length,
      withFigures: pubs.filter((p) => p.thumbnail).length,
      awarded: pubs.filter((p) => p.awards.length > 0).length,
      bestPaper: pubs.filter((p) => p.awards.includes("Best Paper Award")).length,
      years: maxYear - minYear + 1,
      minYear,
      maxYear,
    },
  };
}

export type ResearchData = ReturnType<typeof getResearchData>;
export type ResearchTheme = ResearchData["themes"][number];
