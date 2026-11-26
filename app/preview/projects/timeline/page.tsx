import { getProjectsPreviewData } from "@/components/projects/data";
import { ProjectsIntro, VenueBadge } from "@/components/projects/intro";
import { Art, Faces, LinkPills, names, ProjectsPreviewBar, STATUS_LABEL, yearsLabel } from "@/components/preview/projects/nav";

// P3 · Timeline — the projects placed on the years of their papers. At the top, one lane per
// project across the years, a dot for each paper; below, the projects in the order they
// started, each paper a milestone on a vertical line.
export default function TimelinePreview() {
  const { projects } = getProjectsPreviewData();
  const dated = projects.filter((p) => p.years);
  const undated = projects.filter((p) => !p.years);
  const from = Math.min(...dated.map((p) => p.years![0]));
  const to = Math.max(...dated.map((p) => p.years![1]), new Date().getFullYear());
  const span = Math.max(1, to - from);
  const x = (y: number) => `${((y - from) / span) * 100}%`;
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const ordered = [...dated].sort((a, b) => a.years![0] - b.years![0]);

  return (
    <div>
      <ProjectsPreviewBar current="timeline" />
      <ProjectsIntro projects={projects} title="Built over the years" />

      {/* ---- lanes ---- */}
      <section aria-label="Project timeline" className="border-y border-border bg-bg-alt">
        <div className="mx-auto max-w-[1500px] overflow-x-auto px-6 py-12 sm:px-10">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[170px_1fr] gap-6">
              <span />
              <div className="relative h-6">
                {years.map((y) => (
                  <span key={y} className="absolute -translate-x-1/2 font-mono text-[12.5px] text-text-faint" style={{ left: x(y) }}>
                    {y}
                  </span>
                ))}
              </div>
            </div>
            {ordered.map((p) => (
              <div key={p.id} className="grid grid-cols-[170px_1fr] items-center gap-6 border-t border-border py-7">
                <a href={`#${p.id}`} className="text-[18px] font-bold tracking-tight text-foreground hover:underline">
                  {p.title}
                </a>
                <div className="relative h-14">
                  {years.map((y) => (
                    <span key={y} aria-hidden="true" className="absolute inset-y-0 w-px bg-hairline" style={{ left: x(y) }} />
                  ))}
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand/30"
                    style={{ left: x(p.years![0]), width: `max(6px, calc(${x(p.years![1])} - ${x(p.years![0])}))` }}
                  />
                  {p.papers
                    .filter((pp) => pp.year)
                    .map((pp, k) => (
                      <span
                        key={pp.id}
                        title={`${pp.venue} ${pp.year}: ${pp.title}`}
                        className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                        style={{ left: x(pp.year!) }}
                      >
                        <span className={`font-mono text-[11.5px] font-bold whitespace-nowrap text-brand-strong ${k % 2 ? "translate-y-[30px]" : "-translate-y-[30px]"}`}>
                          {pp.venue}
                        </span>
                        <span className="absolute size-4 rounded-full border-[3px] border-background bg-brand shadow" />
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- the stories ---- */}
      <div className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10">
        {[...ordered, ...undated].map((p) => (
          <article key={p.id} id={p.id} className="grid scroll-mt-28 gap-8 pb-20 md:grid-cols-[150px_1fr] md:gap-12">
            <div>
              <p className="font-mono text-[13px] tracking-[0.18em] text-brand uppercase">Since</p>
              <p className="text-[clamp(2.4rem,4vw,3.4rem)] leading-none font-bold tracking-tight text-foreground">{p.years?.[0] ?? "—"}</p>
            </div>
            <div>
              <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
                <div>
                  <p className="font-mono text-[12.5px] tracking-[0.16em] text-muted-foreground uppercase">
                    {p.areas.map((a) => a.title).join(" · ")}
                    {p.status ? ` · ${STATUS_LABEL[p.status]}` : ""}
                  </p>
                  <h2 className="mt-2 text-[clamp(2rem,3.4vw,3rem)] leading-tight font-bold tracking-tight text-foreground">{p.title}</h2>
                  <p className="mt-3 text-[18px] leading-relaxed text-muted-foreground">{p.tagline}</p>
                </div>
                <Art project={p} sizes="320px" className="aspect-[16/10] rounded-2xl ring-1 ring-border" />
              </div>

              {p.papers.length > 0 && (
                <ol className="relative mt-8 space-y-5 border-l-2 border-brand/40 pl-7">
                  {[...p.papers].reverse().map((x) => (
                    <li key={x.id} className="relative">
                      <span aria-hidden="true" className="absolute top-1.5 -left-[35px] size-3 rounded-full border-2 border-background bg-brand" />
                      <div className="flex flex-wrap items-center gap-2">
                        <VenueBadge venue={x.venue} year={x.year} title={x.venueName} />
                      </div>
                      {x.href ? (
                        <a href={x.href} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[16.5px] leading-snug text-foreground hover:underline">
                          {x.title}
                        </a>
                      ) : (
                        <p className="mt-1.5 text-[16.5px] leading-snug text-foreground">{x.title}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
                {p.members.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Faces members={p.members} size={34} />
                    <p className="text-[14.5px] text-muted-foreground">{names(p.members)}</p>
                  </div>
                )}
                <LinkPills project={p} />
              </div>
              {p.years && p.years[0] !== p.years[1] && (
                <p className="mt-4 font-mono text-[12px] text-text-faint">Papers {yearsLabel(p.years)}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
