"use client";

// The home page's centrepiece: the director, the research and where it is published, told as
// one scroll. For the length of this section Jinjun Xiong's portrait stays pinned on the left
// (it lets go when the section ends); on the right the lab scrolls past in three parts —
//   1. Director  — the bio and honors.
//   2. Research  — each area in turn, with a radar floating beside the text that lights it up.
//   3. Venues    — the top venues as bars, lighting up the group being read.
// A three-part progress line over the portrait says where you are. Below xl the floating
// charts sit inline in their steps; below lg the portrait becomes a cover image.
// prefers-reduced-motion: no transitions (state still updates).
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

export interface StoryTheme {
  id: string;
  title: string;
  label: string;
  short: string;
  count: number;
  recent: { id: string; title: string; year?: number }[];
}

export interface StoryVenue {
  id: string;
  label: string;
  name: string;
  value: number;
  group: "eda" | "other";
}

export interface StoryDirector {
  name: string;
  title: string;
  secondary: string[];
  photo?: string;
  portrait?: string;
  bio: string[];
  honors: string[];
}

type Act = "director" | "research" | "venues";
const ACTS: { id: Act; label: string }[] = [
  { id: "director", label: "Director" },
  { id: "research", label: "Research" },
  { id: "venues", label: "Venues" },
];

const actOf = (step: string): Act => (step.startsWith("d") ? "director" : step.startsWith("v") ? "venues" : "research");

// ---------------------------------------------------------------- radar

const SIZE = 440;
const C = SIZE / 2;
const R = 150;
const PAD = 110;

function pt(i: number, n: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

// The polygon is SVG; the labels are ordinary HTML laid over it, so they keep a readable size
// however small the chart is drawn (SVG text would shrink with it).
function Radar({ themes, active, className }: { themes: StoryTheme[]; active?: string; className?: string }) {
  const n = themes.length;
  const max = Math.max(...themes.map((t) => t.count));
  const shape = themes.map((t, i) => pt(i, n, (R * t.count) / max));
  const activeTitle = themes.find((t) => t.id === active)?.title;
  const W = SIZE + 2 * PAD;
  return (
    <div className={cn("relative text-foreground", className)}>
      <svg
        viewBox={`${-PAD} 0 ${W} ${SIZE}`}
        role="img"
        aria-label={`Publications per research area${activeTitle ? `, highlighting ${activeTitle}` : ""}: ${themes.map((t) => `${t.title} ${t.count}`).join(", ")}`}
        className="block h-auto w-full"
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={themes.map((_, i) => pt(i, n, R * f).join(",")).join(" ")} fill="none" stroke="var(--hairline)" />
        ))}
        {themes.map((t, i) => {
          const [x, y] = pt(i, n, R);
          const on = t.id === active;
          return (
            <line
              key={t.id}
              x1={C}
              y1={C}
              x2={x}
              y2={y}
              stroke={on ? "var(--brand)" : "var(--hairline)"}
              strokeWidth={on ? 2 : 1}
              className="transition-all duration-500 motion-reduce:transition-none"
            />
          );
        })}
        <polygon
          points={shape.map((p) => p.join(",")).join(" ")}
          fill="var(--brand)"
          fillOpacity={0.1}
          stroke="var(--brand)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {themes.map((t, i) => {
          const on = t.id === active;
          const [x, y] = shape[i];
          return (
            <circle
              key={t.id}
              cx={x}
              cy={y}
              r={on ? 9 : 4.5}
              fill={on ? "var(--brand)" : "currentColor"}
              stroke="var(--background)"
              strokeWidth={2}
              opacity={!active || on ? 1 : 0.35}
              className="transition-all duration-500 motion-reduce:transition-none"
            />
          );
        })}
      </svg>
      {themes.map((t, i) => {
        const on = t.id === active;
        const [lx, ly] = pt(i, n, R + 26);
        const anchor = Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end";
        return (
          <div
            key={t.id}
            aria-hidden="true"
            className={cn(
              "absolute leading-tight whitespace-nowrap transition-opacity duration-500 motion-reduce:transition-none",
              anchor === "middle" ? "-translate-x-1/2 text-center" : anchor === "start" ? "text-left" : "-translate-x-full text-right",
              ly < C - 40 ? "-translate-y-full" : ly > C + 40 ? "" : "-translate-y-1/2"
            )}
            style={{ left: `${((lx + PAD) / W) * 100}%`, top: `${(ly / SIZE) * 100}%`, opacity: !active || on ? 1 : 0.4 }}
          >
            <span className={cn("block", on ? "text-[16px] font-bold text-foreground sm:text-[19px]" : "text-[14px] text-muted-foreground sm:text-[17px]")}>
              {t.label}
            </span>
            <span className={cn("block font-mono text-[13px] font-bold sm:text-[15px]", on ? "text-brand" : "text-muted-foreground")}>{t.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- venue bars

function VenueBars({ venues, lit, grown }: { venues: StoryVenue[]; lit?: StoryVenue["group"]; grown: boolean }) {
  const max = Math.max(...venues.map((v) => v.value));
  return (
    <ol className="space-y-3">
      {venues.map((v, i) => {
        const on = !lit || v.group === lit;
        return (
          <li
            key={v.id}
            title={`${v.name}: ${v.value} publications`}
            className="grid grid-cols-[104px_1fr_36px] items-center gap-4 transition-opacity duration-500 motion-reduce:transition-none"
            style={{ opacity: on ? 1 : 0.28 }}
          >
            <span className="truncate text-[17px] font-bold text-foreground">{v.label}</span>
            <span className="h-4 overflow-hidden rounded-r-[4px] bg-muted">
              <span
                className={cn(
                  "block h-full rounded-r-[4px] transition-[width,background-color] duration-1000 ease-out motion-reduce:transition-none",
                  on && lit ? "bg-brand" : "bg-foreground"
                )}
                style={{ width: grown ? `${(v.value / max) * 100}%` : "0%", transitionDelay: `${i * 60}ms` }}
              />
            </span>
            <span className="text-right font-mono text-[17px] text-foreground">{v.value}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- pieces

function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[13px] tracking-[0.22em] text-brand uppercase", className)}>{children}</p>;
}

// ---------------------------------------------------------------- the section

export function LabStory({
  director,
  themes,
  venues,
  totals,
}: {
  director: StoryDirector;
  themes: StoryTheme[];
  venues: StoryVenue[];
  totals: { publications: number; venues: number; patents: number };
}) {
  const eda = venues.filter((v) => v.group === "eda");
  const other = venues.filter((v) => v.group === "other");
  const sum = (vs: StoryVenue[]) => vs.reduce((n, v) => n + v.value, 0);
  const list = (vs: StoryVenue[]) => vs.map((v) => v.label).join(", ").replace(/, ([^,]*)$/, " and $1");
  const maxTheme = Math.max(...themes.map((t) => t.count));
  const portrait = director.portrait ?? director.photo;

  const [step, setStep] = useState("d1");
  const [grown, setGrown] = useState(false);
  const root = useRef<HTMLElement>(null);
  const at = ACTS.findIndex((x) => x.id === actOf(step));

  // The active step is the one under the middle of the screen, re-checked on every scroll
  // frame. (An IntersectionObserver only reports the steps that just crossed its line, and a
  // late report from the previous step could win, leaving the wrong step lit.)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const steps = [...el.querySelectorAll<HTMLElement>("[data-step]")];
    let frame = 0;
    const pick = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      let best: HTMLElement | undefined;
      let gap = Infinity;
      for (const s of steps) {
        const b = s.getBoundingClientRect();
        if (b.top <= mid && b.bottom >= mid) {
          best = s;
          break;
        }
        const d = Math.min(Math.abs(b.top - mid), Math.abs(b.bottom - mid));
        if (d < gap) {
          gap = d;
          best = s;
        }
      }
      if (!best) return;
      const id = best.dataset.step!;
      setStep(id);
      if (actOf(id) === "venues") setGrown(true);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const stepProps = (id: string, className?: string) => {
    return {
      "data-step": id,
      "data-active": step === id,
      className: cn(
        "py-10 xl:flex xl:min-h-[62vh] xl:flex-col xl:justify-center xl:py-14 xl:opacity-30 xl:transition-opacity xl:duration-500 xl:data-[active=true]:opacity-100 motion-reduce:transition-none",
        className
      ),
    };
  };

  const theme = themes.find((t) => `t:${t.id}` === step);
  const lit = step === "v1" ? "eda" : step === "v2" ? "other" : undefined;

  return (
    <section ref={root} aria-labelledby="lab-story-heading" className="border-y border-border">
      <div className="grid lg:grid-cols-[minmax(340px,29%)_1fr]">
        {/* ============================ the director, pinned for this section ===== */}
        <aside className="relative h-[68vh] min-h-[420px] lg:sticky lg:top-[59px] lg:h-[calc(100vh-59px)] lg:self-start">
          <div className="absolute inset-0 lg:[mask-image:linear-gradient(to_right,black_78%,transparent)]">
            {portrait && (
              <Image
                src={withBasePath(portrait)}
                alt={director.name}
                fill
                sizes="(min-width: 1024px) 29vw, 100vw"
                className="object-cover object-[50%_25%]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 top-0 hidden h-28 bg-gradient-to-b from-black/55 to-transparent lg:block" />
          </div>

          {/* where you are in the section */}
          <div className="absolute inset-x-0 top-0 hidden gap-3 pt-6 pr-[26%] pl-8 lg:flex">
            {ACTS.map((a, i) => (
              <div key={a.id} className="flex-1">
                <span
                  className={cn(
                    "block h-[3px] rounded-full transition-colors duration-500 motion-reduce:transition-none",
                    i === at ? "bg-[oklch(0.75_0.13_250)]" : i < at ? "bg-white/60" : "bg-white/20"
                  )}
                />
                <span className={cn("mt-2 block font-mono text-[11.5px] tracking-[0.2em] uppercase", i === at ? "text-white" : "text-white/55")}>
                  {a.label}
                </span>
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 px-8 pb-9 text-white lg:pr-[24%]">
            <p className="font-mono text-[12.5px] tracking-[0.22em] text-white/65 uppercase">Director</p>
            <p className="mt-2 text-[clamp(2.1rem,3.2vw,3rem)] leading-none font-bold tracking-tight">{director.name}</p>
            <p className="mt-2 text-[17px] leading-snug text-white/85">{director.title}</p>
            <dl className="mt-5 flex gap-7 border-t border-white/20 pt-4">
              {(
                [
                  [totals.publications, "publications"],
                  [totals.patents, "patents"],
                  [totals.venues, "venues"],
                ] as const
              ).map(([v, l]) => (
                <div key={l}>
                  <dd className="text-[28px] leading-none font-bold">{v}</dd>
                  <dt className="mt-1 font-mono text-[11.5px] tracking-[0.16em] text-white/60 uppercase">{l}</dt>
                </div>
              ))}
            </dl>
          </div>
        </aside>

        {/* ============================ the lab, scrolling past ===== */}
        <div className="min-w-0 px-6 pt-16 pb-10 sm:px-10 lg:px-14 lg:pt-24 xl:pb-[18vh]">
          <Kicker>Inside the lab</Kicker>
          <h2
            id="lab-story-heading"
            className="mt-3 max-w-[20ch] text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.04] font-bold tracking-tight text-foreground"
          >
            Who leads it, what we study, where it is published
          </h2>

          {/* ---- 01 · the director ---- */}
          <div className="max-w-[64ch]">
            <article {...stepProps("d1", "xl:min-h-[52vh]")}>
              <Kicker>01 · The director</Kicker>
              <ul className="mt-3 space-y-1 text-[17px] font-semibold text-brand">
                {director.secondary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="mt-5 text-[19px] leading-relaxed text-muted-foreground">{director.bio[0]}</p>
            </article>
            <article {...stepProps("d2", "xl:min-h-[52vh]")}>
              <p className="text-[19px] leading-relaxed text-muted-foreground">{director.bio[1]}</p>
              {director.bio[2] && <p className="mt-5 text-[19px] leading-relaxed text-muted-foreground">{director.bio[2]}</p>}
              <ul className="mt-7 flex flex-wrap gap-2">
                {director.honors.map((h) => (
                  <li
                    key={h}
                    className="rounded-full border border-brand-soft-border bg-brand-soft-bg px-4 py-2 text-[15px] font-semibold text-brand-strong"
                  >
                    {h}
                  </li>
                ))}
              </ul>
              <Link href="/people" className="mt-7 inline-flex items-center gap-2 text-[17px] font-semibold text-foreground underline-offset-4 hover:underline">
                Meet the whole group <span aria-hidden="true">→</span>
              </Link>
            </article>
          </div>

          {/* ---- 02 · the research: steps + a radar floating beside them ---- */}
          <div className="xl:grid xl:grid-cols-[1fr_1.05fr] xl:gap-16">
            <div>
              <article {...stepProps("r0")}>
                <Kicker>02 · The research</Kicker>
                <h3 className="mt-3 text-[clamp(2rem,3.2vw,2.8rem)] leading-tight font-bold tracking-tight text-foreground">
                  {totals.publications} papers, {themes.length} areas
                </h3>
                <p className="mt-4 max-w-[54ch] text-[19px] leading-relaxed text-muted-foreground">
                  From electronic design automation to AI algorithms, hardware accelerators and AI in the classroom — the work spans the
                  whole stack. Keep scrolling: each area takes its turn on the chart.
                </p>
                <Radar themes={themes} className="mt-8 max-w-[520px] xl:hidden" />
              </article>
              {themes.map((t, i) => (
                <article key={t.id} {...stepProps(`t:${t.id}`, "xl:min-h-[56vh]")}>
                  <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">
                    Area {i + 1} of {themes.length}
                  </p>
                  <h4 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] leading-tight font-bold tracking-tight text-foreground">{t.title}</h4>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="font-mono text-[16px] text-muted-foreground">{t.count} publications</span>
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted xl:hidden">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${(t.count / maxTheme) * 100}%` }} />
                    </span>
                  </div>
                  <p className="mt-4 max-w-[52ch] text-[19px] leading-relaxed text-muted-foreground">{t.short}</p>
                  {t.recent.length > 0 && (
                    <ul className="mt-5 space-y-2 border-l-2 border-brand pl-4">
                      {t.recent.slice(0, 2).map((p) => (
                        <li key={p.id} className="text-[16.5px] leading-snug text-foreground">
                          {p.title}
                          {p.year ? <span className="ml-2 font-mono text-[13px] text-text-faint">{p.year}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/research?theme=${t.id}#publications`}
                    className="mt-5 inline-flex items-center gap-2 text-[17px] font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    All {t.title} publications <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
            <div className="hidden pb-[14vh] xl:block">
              <div className="sticky top-[calc(59px+12vh)]">
                <Radar themes={themes} active={theme?.id} />
              </div>
            </div>
          </div>

          {/* ---- 03 · where we publish: steps + bars floating beside them ---- */}
          <div className="xl:grid xl:grid-cols-[1fr_1.05fr] xl:gap-16">
            <div>
              <article {...stepProps("v1")}>
                <Kicker>03 · Where we publish</Kicker>
                <h3 className="mt-3 text-[clamp(2rem,3.2vw,2.8rem)] leading-tight font-bold tracking-tight text-foreground">
                  The design-automation flagships
                </h3>
                <p className="mt-4 max-w-[52ch] text-[19px] leading-relaxed text-muted-foreground">
                  In electronic design automation, {list(eda)} carry {sum(eda)} of the lab&apos;s papers.
                </p>
                <div className="mt-8 max-w-[520px] xl:hidden">
                  <VenueBars venues={eda} grown />
                </div>
              </article>
              <article {...stepProps("v2")}>
                <h3 className="text-[clamp(2rem,3.2vw,2.8rem)] leading-tight font-bold tracking-tight text-foreground">
                  AI systems, machine learning and education
                </h3>
                <p className="mt-4 max-w-[52ch] text-[19px] leading-relaxed text-muted-foreground">
                  Beyond design automation, the work appears at {list(other)} — {sum(other)} papers — and at {totals.venues} venues in all.
                </p>
                <div className="mt-8 max-w-[520px] xl:hidden">
                  <VenueBars venues={other} grown />
                </div>
                <Link href="/research" className="mt-7 inline-flex items-center gap-2 text-[17px] font-semibold text-foreground underline-offset-4 hover:underline">
                  Research &amp; publications <span aria-hidden="true">→</span>
                </Link>
              </article>
            </div>
            <div className="hidden pt-[14vh] xl:block">
              <div className="sticky top-[calc(59px+18vh)]">
                <p className="font-mono text-[13px] tracking-[0.2em] text-text-faint uppercase">Top venues, by papers</p>
                <div className="mt-5">
                  <VenueBars venues={venues} lit={lit} grown={grown} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
