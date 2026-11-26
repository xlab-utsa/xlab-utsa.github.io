import { getProjectsPreviewData } from "@/components/preview/projects/data";
import { ProjectsIntro, VenueBadge } from "@/components/preview/projects/intro";
import { Art, Faces, LinkPills, names, ProjectsPreviewBar, STATUS_LABEL, yearsLabel } from "@/components/preview/projects/nav";

// P1 · Showcase — each project gets a full-width row, like a product page: the illustration
// large on one side (alternating), and on the other its name, what it does, the papers behind
// it, the people who built it and the links.
export default function ShowcasePreview() {
  const { projects } = getProjectsPreviewData();
  return (
    <div>
      <ProjectsPreviewBar current="showcase" />
      <ProjectsIntro projects={projects} />
      <div className="mx-auto max-w-[1500px] px-6 pb-16 sm:px-10">
        {projects.map((p, i) => (
          <article key={p.id} id={p.id} className="grid scroll-mt-28 items-center gap-10 border-t border-border py-16 lg:grid-cols-2 lg:gap-16">
            <Art
              project={p}
              priority={i === 0}
              className={`aspect-[16/10] rounded-[28px] ring-1 ring-border ${i % 2 ? "lg:order-2" : ""}`}
            />
            <div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12.5px] tracking-[0.16em] uppercase">
                <span className="text-brand">{String(i + 1).padStart(2, "0")}</span>
                {p.areas.map((a) => (
                  <span key={a.id} className="text-muted-foreground">
                    {a.title}
                  </span>
                ))}
                {p.status && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    {STATUS_LABEL[p.status]}
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-[clamp(2.4rem,4.4vw,4rem)] leading-none font-bold tracking-tight text-foreground">{p.title}</h2>
              <p className="mt-5 max-w-[52ch] text-[19px] leading-relaxed text-muted-foreground">{p.tagline}</p>

              {p.papers.length > 0 && (
                <div className="mt-8">
                  <p className="font-mono text-[12px] tracking-[0.18em] text-text-faint uppercase">
                    Papers · {yearsLabel(p.years)}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {p.papers.map((x) => (
                      <li key={x.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                        <VenueBadge venue={x.venue} year={x.year} title={x.venueName} />
                        {x.href ? (
                          <a href={x.href} target="_blank" rel="noopener noreferrer" className="text-[16px] leading-snug text-foreground hover:underline">
                            {x.title}
                          </a>
                        ) : (
                          <span className="text-[16px] leading-snug text-foreground">{x.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {p.members.length > 0 && (
                <div className="mt-7 flex items-center gap-4">
                  <Faces members={p.members} size={38} />
                  <p className="text-[15px] leading-snug text-muted-foreground">{names(p.members)}</p>
                </div>
              )}
              <LinkPills project={p} className="mt-8" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
