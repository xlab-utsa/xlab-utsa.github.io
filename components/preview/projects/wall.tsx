"use client";

// P2 · Card wall — the interactive part: research-area filter chips over a grid of tall cards.
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { PreviewProject } from "./data";
import { Art, Faces, STATUS_LABEL } from "./nav";

export function ProjectWall({ projects, areas }: { projects: PreviewProject[]; areas: { id: string; title: string }[] }) {
  const [area, setArea] = useState<string>();
  const shown = area ? projects.filter((p) => p.areas.some((a) => a.id === area)) : projects;

  const chip = (id: string | undefined, label: string, count: number) => (
    <button
      key={id ?? "all"}
      type="button"
      aria-pressed={area === id}
      onClick={() => setArea(id)}
      className={cn(
        "rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors",
        area === id ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-muted"
      )}
    >
      {label} <span className="ml-1 font-mono text-[12px] opacity-60">{count}</span>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by research area">
        {chip(undefined, "All", projects.length)}
        {areas.map((a) => chip(a.id, a.title, projects.filter((p) => p.areas.some((x) => x.id === a.id)).length))}
      </div>

      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <li key={p.id}>
            <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <Art project={p} sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[16/10] border-b border-border" />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11.5px] tracking-[0.16em] text-brand uppercase">{p.areas.map((a) => a.title).join(" · ")}</p>
                  {p.status && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      {STATUS_LABEL[p.status]}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-[28px] leading-tight font-bold tracking-tight text-foreground">{p.title}</h2>
                <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">{p.tagline}</p>

                {p.papers.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {p.papers.map((x) => (
                      <li key={x.id}>
                        <a
                          href={x.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={x.title}
                          className="inline-flex items-center gap-1.5 rounded-md border border-brand-soft-border bg-brand-soft-bg px-2 py-0.5 font-mono text-[12px] font-bold text-brand-strong hover:underline"
                        >
                          {x.venue}
                          {x.year ? <span className="font-normal opacity-75">{x.year}</span> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-5">
                  <Faces members={p.members} size={32} />
                  <div className="flex gap-2">
                    {p.links.map((l) => (
                      <a
                        key={l.key}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-border px-3.5 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
                      >
                        {l.label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
