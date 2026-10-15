import Link from "next/link";

import { Markdown } from "@/components/markdown";
import { ProjectCard } from "@/components/project-card";
import { ResearchBrowser } from "@/components/research-browser";
import { ResearchPublicationCard } from "@/components/research-publication-card";
import {
  getProjectsByTheme,
  getPublications,
  getPublicationsByTheme,
  getResearchThemes,
} from "@/lib/content";

// Server Component: pre-fetches every theme's Project + Publication grid as JSX and
// hands it to the client-only ResearchBrowser as pre-rendered content (same pattern
// as publications-tabs.tsx) — the interactive tab-switching shell never needs the raw
// content data itself, only the already-rendered panels. Every publication carries a
// research area, so each panel shows only that area's `featured` picks and links out to
// the full, filtered list on /publications.
export function ResearchSection() {
  const themes = getResearchThemes();
  const publicationCount = getPublications().length;

  const panels = themes.map((theme, i) => {
    const projects = [...getProjectsByTheme(theme.id)].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    const allPublications = getPublicationsByTheme(theme.id);
    // themeIds[0] is the primary area; a paper is featured only there, so one with a
    // secondary tag does not repeat across panels.
    const publications = allPublications.filter(
      (p) => p.featured && p.themeIds[0] === theme.id
    );
    const itemCount = projects.length + publications.length;

    return {
      id: theme.id,
      num: String(i + 1).padStart(2, "0"),
      title: theme.title,
      itemLabel: `${allPublications.length} ${allPublications.length === 1 ? "publication" : "publications"}`,
      description: (
        <>
          <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-muted-foreground">
            {theme.shortDescription}
          </p>
          {theme.longDescription && (
            <Markdown className="mt-2 max-w-[70ch] text-[13.5px] text-muted-foreground">
              {theme.longDescription}
            </Markdown>
          )}
        </>
      ),
      content:
        itemCount > 0 ? (
          <div key={theme.id}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {publications.map((publication) => (
                <ResearchPublicationCard key={publication.id} publication={publication} />
              ))}
            </div>
            <Link
              href={`/publications?theme=${theme.id}`}
              className="mt-6 inline-block text-[13.5px] font-semibold text-foreground hover:underline"
            >
              All {allPublications.length} {theme.title} publications ›
            </Link>
          </div>
        ) : null,
    };
  });

  return (
    <section
      id="research"
      aria-labelledby="research-heading"
      className="scroll-mt-16 border-b border-border bg-bg-alt"
    >
      <div className="mx-auto max-w-[1600px] px-6 py-12 sm:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3.5">
          <div className="flex flex-wrap items-baseline gap-3.5">
            <h2
              id="research-heading"
              className="font-mono text-[15px] font-bold tracking-widest text-foreground uppercase"
            >
              Projects &amp; Publications
            </h2>
            <span className="text-[13.5px] text-muted-foreground">
              One thrust in focus at a time — click to switch
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              <span aria-hidden="true" className="size-2.5 bg-brand" />
              Project
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              <span aria-hidden="true" className="size-2.5 bg-brand-orange" />
              Featured publication
            </span>
            <Link
              href="/publications"
              className="text-[13.5px] font-semibold text-foreground hover:underline"
            >
              All {publicationCount} publications ›
            </Link>
          </div>
        </div>
        <ResearchBrowser panels={panels} />
      </div>
    </section>
  );
}
