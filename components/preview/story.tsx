"use client";

// Interactive parts of design 07 (story scroll):
//   * StoryResearch — scrollytelling: text steps on one side, a pinned radar on the other;
//     the step in view highlights its research area on the chart.
//   * RevealBars — bars that grow when they scroll into view.
//   * ScrollProgress — a thin reading-progress line under the header.
// All of it respects prefers-reduced-motion (no transitions; state still updates).
import { useEffect, useRef, useState } from "react";

interface Theme {
  id: string;
  title: string;
  label: string;
  short: string;
  count: number;
  recent: { id: string; title: string; year?: number }[];
}

const SIZE = 440;
const C = SIZE / 2;
const R = 150;
const PAD = 100;

function pt(i: number, n: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function Radar({ themes, active }: { themes: Theme[]; active?: string }) {
  const n = themes.length;
  const max = Math.max(...themes.map((t) => t.count));
  const shape = themes.map((t, i) => pt(i, n, (R * t.count) / max));
  return (
    <svg viewBox={`${-PAD} 0 ${SIZE + 2 * PAD} ${SIZE}`} role="img" aria-label={`Publications per research area${active ? `, highlighting ${themes.find((t) => t.id === active)?.title}` : ""}`} className="h-auto w-full text-foreground">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={themes.map((_, i) => pt(i, n, R * f).join(",")).join(" ")} fill="none" stroke="var(--hairline)" />
      ))}
      {themes.map((t, i) => {
        const [x, y] = pt(i, n, R);
        return <line key={t.id} x1={C} y1={C} x2={x} y2={y} stroke={t.id === active ? "var(--pv-accent)" : "var(--hairline)"} strokeWidth={t.id === active ? 2 : 1} className="transition-all duration-500" />;
      })}
      <polygon points={shape.map((p) => p.join(",")).join(" ")} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {themes.map((t, i) => {
        const on = t.id === active;
        const [x, y] = shape[i];
        const [lx, ly] = pt(i, n, R + 30);
        const anchor = Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end";
        return (
          <g key={t.id} className="transition-opacity duration-500" opacity={!active || on ? 1 : 0.35}>
            <circle cx={x} cy={y} r={on ? 9 : 4.5} fill={on ? "var(--pv-accent)" : "currentColor"} stroke="var(--background)" strokeWidth={2} className="transition-all duration-500" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className={on ? "fill-foreground text-[18px] font-bold" : "fill-muted-foreground text-[16px]"}>
              <tspan>{t.label}</tspan>
              <tspan x={lx} dy="1.2em" className="font-mono text-[15px] font-bold" fill={on ? "var(--pv-accent)" : undefined}>
                {t.count}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function StoryResearch({ themes }: { themes: Theme[] }) {
  const [active, setActive] = useState<string | undefined>(themes[0]?.id);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive((hit.target as HTMLElement).dataset.theme);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
      <div>
        {themes.map((t, i) => (
          <article
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-theme={t.id}
            className="flex min-h-[70vh] flex-col justify-center py-10 transition-opacity duration-500"
            style={{ opacity: active === t.id ? 1 : 0.3 }}
          >
            <p className="font-mono text-[11px] tracking-[0.22em] text-[var(--pv-accent)] uppercase">
              Area {i + 1} of {themes.length}
            </p>
            <h3 className="mt-3 text-[clamp(2rem,3.4vw,3rem)] leading-tight font-bold tracking-tight text-foreground">{t.title}</h3>
            <p className="mt-2 font-mono text-[14px] text-muted-foreground">{t.count} publications</p>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-muted-foreground">{t.short}</p>
            {t.recent.length > 0 && (
              <ul className="mt-6 space-y-2 border-l-2 border-[var(--pv-accent)] pl-4">
                {t.recent.slice(0, 2).map((p) => (
                  <li key={p.id} className="text-[14px] leading-snug text-foreground">
                    {p.title}
                    {p.year ? <span className="ml-2 font-mono text-[11px] text-text-faint">{p.year}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <a href={`/research?theme=${t.id}#publications`} className="mt-6 text-[14px] font-semibold text-foreground underline-offset-4 hover:underline">
              All {t.title} publications →
            </a>
          </article>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-[calc(59px+8vh)]">
          <Radar themes={themes} active={active} />
        </div>
      </div>
    </div>
  );
}

export function RevealBars({ data }: { data: { id: string; label: string; name: string; value: number }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const max = Math.max(...data.map((d) => d.value));
  return (
    <ol ref={ref} className="space-y-3">
      {data.map((d, i) => (
        <li key={d.id} title={`${d.name}: ${d.value} publications`} className="grid grid-cols-[96px_1fr_40px] items-center gap-4">
          <span className="text-[15px] font-bold text-foreground">{d.label}</span>
          <span className="h-4 overflow-hidden rounded-r-[4px] bg-muted">
            <span
              className="block h-full rounded-r-[4px] bg-foreground transition-[width] duration-1000 ease-out motion-reduce:transition-none"
              style={{ width: shown ? `${(d.value / max) * 100}%` : "0%", transitionDelay: `${i * 70}ms` }}
            />
          </span>
          <span className="text-right font-mono text-[15px] text-foreground">{d.value}</span>
        </li>
      ))}
    </ol>
  );
}

export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? window.scrollY / h : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-[59px] z-40 h-[3px] bg-transparent">
      <div className="h-full origin-left bg-[var(--pv-accent)]" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}
