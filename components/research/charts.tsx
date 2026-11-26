// Small server-rendered charts for the research-page designs (no client JS).
//   * Sparkline   — papers per year for one area.
//   * Streamgraph — papers per year for every area, stacked around a centre line.
//   * THEME_COLORS — one colour per research area, shared by the charts and their legends.
import { cn } from "@/lib/utils";

/** One hue per research area, by id; light and dark mode both read these. */
export const THEME_COLORS: Record<string, string> = {
  eda: "oklch(0.58 0.14 250)",
  "ai-algorithms": "oklch(0.62 0.15 295)",
  "ai-acceleration": "oklch(0.66 0.12 200)",
  "ai-education": "oklch(0.7 0.15 55)",
  systems: "oklch(0.62 0.13 150)",
  "smart-energy": "oklch(0.75 0.13 95)",
  "cloud-computing": "oklch(0.64 0.15 350)",
};
export const themeColor = (id: string) => THEME_COLORS[id] ?? "var(--brand)";

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function Sparkline({
  values,
  color = "var(--brand)",
  className,
  label,
}: {
  values: number[];
  color?: string;
  className?: string;
  label?: string;
}) {
  const W = 200;
  const H = 40;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 2 - (v / max) * (H - 6)] as [number, number]);
  const line = smooth(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cn("h-10 w-full", className)}>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={color} fillOpacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Streamgraph({
  years,
  series,
  className,
}: {
  years: number[];
  series: { id: string; label: string; values: number[] }[];
  className?: string;
}) {
  const W = 1200;
  const H = 360;
  const PADX = 8;
  const totals = years.map((_, i) => series.reduce((n, s) => n + s.values[i], 0));
  const max = Math.max(...totals, 1);
  const x = (i: number) => PADX + (i / (years.length - 1)) * (W - 2 * PADX);
  const y = (v: number) => H / 2 - (v / max) * (H / 2 - 12);

  // Centre the stack: each year's bottom starts at -total/2.
  const layers = series.map((s, k) => {
    const lower = years.map((_, i) => -totals[i] / 2 + series.slice(0, k).reduce((n, t) => n + t.values[i], 0));
    const upper = lower.map((l, i) => l + s.values[i]);
    const top = smooth(upper.map((v, i) => [x(i), y(v)]));
    const bottom = smooth(
      lower
        .map((v, i) => [x(i), y(v)] as [number, number])
        .reverse()
    );
    return { ...s, d: `${top} L${bottom.slice(1)} Z` };
  });
  const ticks = years.filter((yr) => yr % 5 === 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 30}`}
      role="img"
      aria-label={`Publications per year by research area, ${years[0]}–${years[years.length - 1]}`}
      className={cn("h-auto w-full", className)}
    >
      {ticks.map((yr) => {
        const i = years.indexOf(yr);
        return (
          <g key={yr}>
            <line x1={x(i)} x2={x(i)} y1={8} y2={H} stroke="var(--hairline)" />
            <text x={x(i)} y={H + 22} textAnchor="middle" className="fill-text-faint font-mono text-[15px]">
              {yr}
            </text>
          </g>
        );
      })}
      {layers.map((l) => (
        <path key={l.id} d={l.d} fill={themeColor(l.id)} fillOpacity={0.88} stroke="var(--background)" strokeWidth={1}>
          <title>{`${l.label}: ${l.values.reduce((a, b) => a + b, 0)} papers`}</title>
        </path>
      ))}
    </svg>
  );
}
