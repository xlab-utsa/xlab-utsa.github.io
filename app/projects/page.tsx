import type { Metadata } from "next";

import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/project-card";
import { PublicationEntry } from "@/components/publication-entry";
import { getAllProjects, getPublicationById } from "@/lib/content";

export const metadata: Metadata = {
  title: "Projects",
};

// Projects (SPEC.md §5–§6): each project's card beside its write-up. No per-project detail
// page — the card's links (code, demo, live site) are where a visitor goes next.
export default function ProjectsPage() {
  const projects = [...getAllProjects()].sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title)
  );

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-14 sm:px-10">
      <PageHeader
        title="Projects"
        meta={`${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
        intro="Systems, tools and platforms built in the lab — with links to the code and, where they run live, to the hosted versions."
      />
      <div className="mt-10 flex flex-col gap-12">
        {projects.map((project) => {
          const publications = project.publicationIds
            .map((id) => getPublicationById(id))
            .filter((p) => p !== undefined);
          return (
            <article
              key={project.id}
              id={project.id}
              className="grid scroll-mt-20 grid-cols-1 gap-8 border-b border-hairline pb-12 md:grid-cols-[320px_1fr]"
            >
              <ProjectCard project={project} />
              <div className="flex flex-col gap-4">
                {project.description ? (
                  <Markdown className="max-w-[75ch] text-[15px] text-muted-foreground">
                    {project.description}
                  </Markdown>
                ) : (
                  <p className="max-w-[75ch] text-[15px] leading-relaxed text-muted-foreground">
                    {project.tagline}
                    <span className="mt-2 block font-mono text-[11px] tracking-wide text-text-faint uppercase">
                      Full write-up coming soon
                    </span>
                  </p>
                )}
                {publications.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <span className="font-mono text-[11px] font-bold tracking-wider text-text-faint uppercase">
                      Publications
                    </span>
                    {publications.map((pub) => (
                      <PublicationEntry key={pub.id} publication={pub} />
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
