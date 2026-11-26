"use client";

// The research-area browser for the research-page designs: one area in focus at a time, as
// on the live page.
//   * orientation "side" — the chosen design. On large screens it is built to fill exactly
//     the height it is given (the page sizes it to one screen): the area list on the left
//     (with `heading` above it), and on the right the area's title, a one-line summary, its
//     description, and one row of featured cards that stretches to fill what is left.
//   * orientation "top" — area pills across the top, cards below (kept for comparison).
// Cards: the area's projects first, then its featured papers — those with a figure first.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { themeColor } from "@/components/research/charts";
import { withBasePath } from "@/lib/base-path";
import type { ResearchTheme } from "@/lib/research/data";
import { cn } from "@/lib/utils";

type Card =
  | { kind: "project"; id: string; title: string; tagline?: string; thumbnail?: string }
  | { kind: "paper"; id: string; title: string; label: string; meta: string; authors: string; thumbnail?: string };

function cardsOf(t: ResearchTheme, max: number): Card[] {
  const papers = [...t.featured].sort((a, b) => Number(!!b.thumbnail) - Number(!!a.thumbnail));
  return [
    ...t.projects.map((p) => ({ kind: "project" as const, ...p })),
    ...papers.map((p) => ({
      kind: "paper" as const,
      id: p.id,
      title: p.title,
      label: p.awards[0] ? `★ ${p.awards[0]}` : "Featured publication",
      meta: [p.venueShort ?? p.venue, p.year].filter(Boolean).join(" · "),
      authors: p.authors.map((a) => a.name).join(", "),
      thumbnail: p.thumbnail,
    })),
  ].slice(0, max);
}

function CardView({ c, color, fill, compact, className }: { c: Card; color: string; fill?: boolean; compact?: boolean; className?: string }) {
  const project = c.kind === "project";
  const figure = (
    <div className={cn("relative border-b border-hairline bg-white", fill ? cn("aspect-[16/9] lg:aspect-auto lg:flex-1", compact ? "lg:min-h-[64px]" : "lg:min-h-[110px]") : "aspect-[16/9]")}>
      <Image src={withBasePath(c.thumbnail!)} alt={project ? "" : `Central figure from “${c.title}”`} fill sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 24vw, 100vw" className="object-contain p-3" />
    </div>
  );
  const body = (
    <div className={cn("flex shrink-0 flex-col gap-1.5", compact ? "gap-1 px-4 py-3" : "p-4")}>
      <span className={cn("font-mono text-[11px] font-bold tracking-[0.14em] uppercase", project ? "text-brand" : "text-brand-orange-strong")}>
        {project ? "Project" : c.label}
      </span>
      <span className={cn("text-[15.5px] leading-snug font-semibold text-foreground", compact ? "line-clamp-2" : "line-clamp-3")}>{c.title}</span>
      {project ? (
        c.tagline && <span className={cn("text-[13.5px] leading-snug text-muted-foreground", compact ? "line-clamp-1" : "line-clamp-2")}>{c.tagline}</span>
      ) : (
        <span className="font-mono text-[12px] text-text-faint uppercase">{c.meta}</span>
      )}
    </div>
  );
  // A paper with no figure: the space becomes a quiet title card in the area's colour.
  const noFigure = !c.thumbnail && (
    <div
      className={cn("flex flex-col justify-end gap-2 p-5", fill ? "min-h-[150px] overflow-hidden lg:min-h-0 lg:flex-1" : "min-h-[150px]")}
      style={{ background: `color-mix(in oklch, ${color} 10%, var(--background))` }}
    >
      <span aria-hidden="true" className="font-serif text-[56px] leading-none" style={{ color }}>
        “
      </span>
      {c.kind === "paper" && <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{c.authors}</span>}
    </div>
  );
  const shell = cn(
    "flex flex-col overflow-hidden rounded-xl bg-background",
    project ? "border-2 border-brand" : "border border-border",
    fill && "lg:min-h-0",
    className
  );
  const inner = (
    <>
      {c.thumbnail ? figure : noFigure}
      {body}
    </>
  );
  return project ? (
    <Link href={`/projects#${c.id}`} className={cn(shell, "transition-shadow hover:shadow-md")}>
      {inner}
    </Link>
  ) : (
    <article className={shell}>{inner}</article>
  );
}

// ------------------------------------------------------------------ side: one screen

// A card reads well at about this size (figure + title + label).
const CARD_MIN_H = 230;
const CARD_MIN_W = 250;
const GAP = 16;

/** The grid box's size on large screens (null on small screens or before measuring). */
function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (window.innerWidth < 1024) return setBox(null);
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, box };
}

/**
 * The grid for `n` cards in a w×h box: try every row count that fits; prefer showing more
 * cards, then fewer empty slots, then cards closest to square (least stretched).
 */
function layoutFor(n: number, w: number, h: number): { cols: number; rows: number } {
  const maxCols = Math.max(2, Math.min(4, Math.floor((w + GAP) / (CARD_MIN_W + GAP))));
  const maxRows = Math.max(1, Math.min(2, Math.floor((h + GAP) / (CARD_MIN_H + GAP))));
  let best = { cols: Math.min(maxCols, n), rows: 1, score: -Infinity };
  for (let rows = 1; rows <= maxRows; rows++) {
    const cols = Math.max(1, Math.min(maxCols, Math.ceil(n / rows)));
    const shown = Math.min(n, cols * rows);
    const empty = cols * rows - shown;
    const cw = (w - GAP * (cols - 1)) / cols;
    const ch = (h - GAP * (rows - 1)) / rows;
    const stretch = Math.abs(Math.log(ch / cw));
    const score = shown * 100 - empty * 10 - stretch;
    if (score > best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}

function FitPanel({ t }: { t: ResearchTheme }) {
  const { ref, box } = useBox();
  const all = cardsOf(t, 8);
  // Large screens: the measured layout. Small screens, or before measuring: up to six,
  // stacked naturally.
  const fit = box ? layoutFor(all.length, box.w, box.h) : null;
  const cols = fit?.cols ?? 3;
  const rows = fit?.rows ?? 1;
  const cards = fit ? all.slice(0, cols * rows) : all.slice(0, 6);
  const color = themeColor(t.id);
  return (
    <div className="flex min-w-0 flex-col lg:h-full lg:min-h-0">
      <div>
        <h3 className="flex items-center gap-3 text-[clamp(1.8rem,2.6vw,2.6rem)] leading-[1.08] font-bold tracking-tight text-foreground">
          <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ background: color }} />
          {t.title}
        </h3>
        <p className="mt-2 font-mono text-[13px] text-text-faint">
          {t.count} publications · {t.since}–{t.latest} · most often at {t.topVenues.slice(0, 3).map((v) => v.label).join(", ")}
        </p>
        <p className="mt-4 max-w-[75ch] text-[18px] leading-relaxed text-foreground">{t.short}</p>
        {t.long && <p className="mt-2 line-clamp-4 max-w-[80ch] text-[16px] leading-relaxed text-muted-foreground">{t.long}</p>}
      </div>

      {/* The box is always rendered on large screens so it can be measured. */}
      <div
        ref={ref}
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-1"
        style={fit ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` } : undefined}
      >
        {cards.map((c) => (
          <CardView key={c.id} c={c} color={color} fill compact={rows > 1} />
        ))}
      </div>
      <Link href={`?theme=${t.id}#publications`} className="mt-4 inline-flex shrink-0 items-center gap-2 text-[16px] font-semibold text-foreground underline-offset-4 hover:underline">
        All {t.count} {t.title} publications <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ top (comparison)

function TopPanel({ t }: { t: ResearchTheme }) {
  const color = themeColor(t.id);
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-3 text-[clamp(1.7rem,2.6vw,2.3rem)] leading-tight font-bold tracking-tight text-foreground">
        <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ background: color }} />
        {t.title}
      </h3>
      <p className="mt-3 text-[18px] leading-relaxed text-foreground">{t.short}</p>
      {t.long && <p className="mt-3 max-w-[80ch] text-[16px] leading-relaxed text-muted-foreground">{t.long}</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cardsOf(t, 6).map((c) => (
          <CardView key={c.id} c={c} color={color} />
        ))}
      </div>
      <Link href={`?theme=${t.id}#publications`} className="mt-6 inline-flex items-center gap-2 text-[16px] font-semibold text-foreground underline-offset-4 hover:underline">
        All {t.count} {t.title} publications <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ the browser

export function AreaBrowser({
  themes,
  orientation,
  heading,
}: {
  themes: ResearchTheme[];
  orientation: "side" | "top";
  /**
   * The section heading, shown above the area list (side) or the pills (top), with a link
   * down to the full list. Plain data, not JSX: markup passed in from a Server Component
   * trips React's list-key check here.
   */
  heading?: { id: string; title: string; total: number };
}) {
  const [active, setActive] = useState(themes[0]?.id);
  const t = themes.find((x) => x.id === active) ?? themes[0];
  const side = orientation === "side";
  const head = heading && (
    <div className="mb-5 flex items-baseline justify-between gap-4 lg:block">
      <h2 id={heading.id} className="text-[clamp(1.6rem,2.2vw,2rem)] font-bold tracking-tight text-foreground">
        {heading.title}
      </h2>
      <a
        href="#publications"
        className="text-[15px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline lg:mt-1 lg:inline-block"
      >
        All {heading.total} publications ↓
      </a>
    </div>
  );

  const tabs = (
    <div
      role="tablist"
      aria-label="Research areas"
      aria-orientation={side ? "vertical" : "horizontal"}
      className={cn("flex gap-2 overflow-x-auto pb-1", side && "lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0")}
    >
      {themes.map((x, i) => {
        const on = x.id === t.id;
        return (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setActive(x.id)}
            className={cn(
              "shrink-0 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              side
                ? cn(
                    "rounded-xl border px-4 py-2.5 lg:w-full",
                    on ? "border-foreground bg-background shadow-sm" : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  )
                : cn(
                    "rounded-full border px-4 py-2 text-[15px] font-medium",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"
                  )
            )}
          >
            {side ? (
              <span className="flex items-center gap-3">
                <span className="hidden font-mono text-[12px] text-text-faint lg:inline">{String(i + 1).padStart(2, "0")}</span>
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: themeColor(x.id) }} />
                <span className={cn("min-w-0 flex-1 text-[15.5px] leading-snug whitespace-nowrap lg:whitespace-normal", on && "font-semibold text-foreground")}>
                  {x.title}
                </span>
                <span className="font-mono text-[13px] text-text-faint">{x.count}</span>
              </span>
            ) : (
              <>
                {x.title} <span className="font-mono text-[12.5px] opacity-60">{x.count}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );

  if (!side) {
    return (
      <div>
        {head}
        <div className="mb-8">{tabs}</div>
        <div role="tabpanel" aria-label={t.title}>
          <TopPanel t={t} />
        </div>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[290px_1fr] lg:gap-12">
      <div className="mb-8 lg:mb-0 lg:flex lg:min-h-0 lg:flex-col">
        {head}
        {tabs}
      </div>
      <div role="tabpanel" aria-label={t.title} className="lg:min-h-0">
        <FitPanel t={t} />
      </div>
    </div>
  );
}
