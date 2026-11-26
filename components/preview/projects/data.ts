// Everything the four Projects-page previews (app/preview/projects/**) render, gathered once.
//
// SERVER/BUILD ONLY. All of it comes from content/: each project's record, plus the papers
// that belong to it — its `publicationIds`, and (since none are set yet) any publication whose
// title names the project. Lab members, years and venues are read off those papers. A link
// that is only a web search (a placeholder, not a repository) is left out.
import {
  getAllProjects,
  getCurrentPeople,
  getPersonById,
  getPublicationById,
  getPublications,
  getResearchThemes,
  getVenueById,
  type Project,
  type Publication,
} from "@/lib/content";
import { isLabLead } from "@/lib/content/people";

export interface PreviewPaper {
  id: string;
  title: string;
  year?: number;
  venue: string;
  venueName?: string;
  href?: string;
}

export interface PreviewMember {
  id: string;
  name: string;
  photo?: string;
}

export interface PreviewProject {
  id: string;
  title: string;
  tagline: string;
  description?: string;
  thumbnail?: string;
  status?: "active" | "deployed" | "archived";
  areas: { id: string; title: string }[];
  links: { key: string; label: string; href: string }[];
  papers: PreviewPaper[];
  members: PreviewMember[];
  years?: [number, number];
}

const LINK_LABELS: Record<string, string> = {
  paperUrl: "Paper",
  code: "Code",
  demo: "Demo",
  video: "Video",
  poster: "Poster",
  website: "Website",
};

const isPlaceholder = (href: string) => /^https?:\/\/(www\.)?google\.[a-z.]+\/search/i.test(href);

function paperHref(p: Publication): string | undefined {
  if (p.pdfUrl) return p.pdfUrl;
  if (p.url) return p.url;
  if (p.doi) return p.doi.startsWith("http") ? p.doi : `https://doi.org/${p.doi}`;
  return undefined;
}

function papersOf(project: Project): Publication[] {
  const byId = project.publicationIds.map((id) => getPublicationById(id)).filter((p): p is Publication => !!p);
  const name = project.title.toLowerCase();
  const byTitle = getPublications().filter((p) => p.category !== "patent" && p.title.toLowerCase().includes(name));
  const seen = new Set<string>();
  return [...byId, ...byTitle]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export function getProjectsPreviewData() {
  const themes = new Map(getResearchThemes().map((t) => [t.id, t.title]));
  const lead = getCurrentPeople().find(isLabLead);

  const projects: PreviewProject[] = [...getAllProjects()]
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title))
    .map((p) => {
      const pubs = papersOf(p);
      const papers = pubs.map((pub) => {
        const venue = pub.venueId ? getVenueById(pub.venueId) : undefined;
        return {
          id: pub.id,
          title: pub.title,
          year: pub.year,
          venue: venue?.shortName ?? pub.venue ?? "",
          venueName: venue?.name,
          href: paperHref(pub),
        };
      });

      const memberIds = [...new Set([...p.contributors, ...pubs.flatMap((pub) => pub.authors.map((a) => a.personId).filter((id): id is string => !!id))])];
      // The director is on nearly every paper; members first, him last.
      memberIds.sort((a, b) => Number(a === lead?.id) - Number(b === lead?.id));
      const members = memberIds
        .map((id) => getPersonById(id))
        .filter((x) => !!x)
        .map((x) => ({ id: x!.id, name: x!.name, photo: x!.photo }));

      const areaIds = [...new Set([...p.themeIds, ...pubs.flatMap((pub) => pub.themeIds)])];
      const years = pubs.map((x) => x.year).filter((y): y is number => !!y);

      return {
        id: p.id,
        title: p.title,
        tagline: p.tagline,
        description: p.description?.trim() || undefined,
        thumbnail: p.thumbnail,
        status: p.projectStatus,
        areas: areaIds.filter((id) => themes.has(id)).map((id) => ({ id, title: themes.get(id)! })),
        links: Object.entries(p.links ?? {})
          .filter(([, href]) => typeof href === "string" && !isPlaceholder(href))
          .map(([key, href]) => ({ key, label: LINK_LABELS[key] ?? key, href: href as string })),
        papers,
        members,
        years: years.length ? [Math.min(...years), Math.max(...years)] : undefined,
      };
    });

  const areas = [...new Map(projects.flatMap((p) => p.areas).map((a) => [a.id, a])).values()];
  return { projects, areas };
}
