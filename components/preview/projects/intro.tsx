import type { PreviewProject } from "./data";

// The same opening for all four designs, so they differ only below it.
export function ProjectsIntro({ projects, title = "What we build", className = "" }: { projects: PreviewProject[]; title?: string; className?: string }) {
  const papers = new Set(projects.flatMap((p) => p.papers.map((x) => x.id))).size;
  const people = new Set(projects.flatMap((p) => p.members.map((m) => m.id))).size;
  return (
    <header className={`mx-auto grid max-w-[1500px] gap-8 px-6 pt-14 pb-10 sm:px-10 lg:grid-cols-[1.3fr_1fr] lg:items-end ${className}`}>
      <div>
        <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">Projects</p>
        <h1 className="mt-3 text-[clamp(2.6rem,5vw,4.4rem)] leading-[1.02] font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-4 max-w-[58ch] text-[18px] leading-relaxed text-muted-foreground">
          Systems, tools and models from the lab — each with the papers behind it, the people who built it, and the code.
        </p>
      </div>
      <dl className="flex gap-10 lg:justify-end">
        {[
          [projects.length, "projects"],
          [papers, "papers"],
          [people, "lab members"],
        ].map(([n, l]) => (
          <div key={l} className="border-l-2 border-brand pl-4">
            <dd className="text-[clamp(2rem,3vw,2.8rem)] leading-none font-bold text-foreground">{n}</dd>
            <dt className="mt-1.5 text-[14px] text-muted-foreground">{l}</dt>
          </div>
        ))}
      </dl>
    </header>
  );
}

/** "NeurIPS 2023" style badge for a paper. */
export function VenueBadge({ venue, year, title }: { venue: string; year?: number; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-md border border-brand-soft-border bg-brand-soft-bg px-2 py-0.5 font-mono text-[12px] font-bold text-brand-strong">
      {venue}
      {year ? <span className="font-normal opacity-75">{year}</span> : null}
    </span>
  );
}
