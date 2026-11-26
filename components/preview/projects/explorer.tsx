"use client";

// P4 · Explorer — the interactive part: a list of projects (a tab list) beside one large panel
// for the chosen project. Arrow keys move between projects; on small screens the list sits
// above the panel.
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { PreviewProject } from "./data";
import { Art, Faces, LinkPills, names, STATUS_LABEL, yearsLabel } from "./nav";

export function ProjectExplorer({ projects }: { projects: PreviewProject[] }) {
  const [i, setI] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const p = projects[i];

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + projects.length) % projects.length;
    setI(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-12">
      <div role="tablist" aria-label="Projects" aria-orientation="vertical" onKeyDown={onKey} className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-[calc(59px+56px)] lg:self-start">
        {projects.map((q, k) => (
          <button
            key={q.id}
            ref={(el) => {
              tabs.current[k] = el;
            }}
            role="tab"
            id={`tab-${q.id}`}
            aria-selected={k === i}
            aria-controls="project-panel"
            tabIndex={k === i ? 0 : -1}
            onClick={() => setI(k)}
            className={cn(
              "group flex items-center gap-4 rounded-2xl border p-3 text-left transition-colors",
              k === i ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"
            )}
          >
            <Art project={q} sizes="96px" className="aspect-[16/10] w-24 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className="block text-[18px] leading-tight font-bold tracking-tight">{q.title}</span>
              <span className={cn("mt-1 block truncate font-mono text-[11.5px] tracking-[0.12em] uppercase", k === i ? "text-background/70" : "text-muted-foreground")}>
                {q.areas[0]?.title}
                {q.years ? ` · ${yearsLabel(q.years)}` : ""}
              </span>
            </span>
          </button>
        ))}
        <p className="mt-2 px-1 text-[13px] text-text-faint">Click a project, or use the arrow keys.</p>
      </div>

      <section id="project-panel" role="tabpanel" aria-labelledby={`tab-${p.id}`} key={p.id} className="pv-rise min-w-0">
        <Art project={p} priority sizes="(min-width: 1024px) 60vw, 100vw" className="aspect-[16/8] rounded-[28px] ring-1 ring-border" />
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12.5px] tracking-[0.16em] text-muted-foreground uppercase">
          {p.areas.map((a) => (
            <span key={a.id} className="text-brand">
              {a.title}
            </span>
          ))}
          {p.status && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
              {STATUS_LABEL[p.status]}
            </span>
          )}
        </div>
        <h2 className="mt-3 text-[clamp(2.4rem,4.4vw,4rem)] leading-none font-bold tracking-tight text-foreground">{p.title}</h2>
        <p className="mt-4 max-w-[60ch] text-[19px] leading-relaxed text-muted-foreground">{p.tagline}</p>

        <div className="mt-10 grid gap-10 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-[12px] tracking-[0.18em] text-text-faint uppercase">Papers</p>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {p.papers.map((x) => (
                <li key={x.id} className="grid grid-cols-[110px_1fr] gap-4 py-4">
                  <span className="font-mono text-[13px] leading-snug" title={x.venueName}>
                    <span className="block font-bold text-brand-strong">{x.venue}</span>
                    <span className="text-muted-foreground">{x.year}</span>
                  </span>
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
          <div>
            {p.members.length > 0 && (
              <>
                <p className="font-mono text-[12px] tracking-[0.18em] text-text-faint uppercase">Built by</p>
                <Faces members={p.members} size={44} className="mt-3" />
                <p className="mt-3 text-[15px] leading-snug text-muted-foreground">{names(p.members)}</p>
              </>
            )}
            <LinkPills project={p} className="mt-8" />
          </div>
        </div>
      </section>
    </div>
  );
}
