// Publications per research area, as a radar ("spider") chart — the form the 2026-11-23
// meeting asked for. Drawn at build time as plain SVG: no chart library, no client JS.
//
// One series, so no legend; every axis is direct-labelled with its count, which is also the
// accessible reading of the chart (identity never rests on the shape alone). Each vertex
// carries a native tooltip with the exact figure.
export interface RadarDatum {
  id: string;
  label: string;
  value: number;
}

const SIZE = 420;
const CENTER = SIZE / 2;
const RADIUS = 138;
const RINGS = 4;
/** Room either side for the axis labels, which sit outside the plot. */
const PAD_X = 90;

function point(i: number, n: number, r: number): [number, number] {
  // Start at 12 o'clock, go clockwise.
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export function RadarChart({ data, title }: { data: RadarDatum[]; title: string }) {
  const n = data.length;
  if (n < 3) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  const ring = (fraction: number) =>
    data.map((_, i) => point(i, n, RADIUS * fraction).join(",")).join(" ");
  const shape = data.map((d, i) => point(i, n, (RADIUS * d.value) / max));

  return (
    <figure className="flex flex-col items-center gap-3">
      <svg
        viewBox={`${-PAD_X} 0 ${SIZE + 2 * PAD_X} ${SIZE}`}
        role="img"
        aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
        className="h-auto w-full max-w-[560px] text-foreground"
      >
        {/* recessive grid */}
        {Array.from({ length: RINGS }, (_, k) => (
          <polygon
            key={k}
            points={ring((k + 1) / RINGS)}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth={1}
          />
        ))}
        {data.map((_, i) => {
          const [x, y] = point(i, n, RADIUS);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--hairline)" strokeWidth={1} />;
        })}

        {/* the series */}
        <polygon
          points={shape.map((p) => p.join(",")).join(" ")}
          fill="currentColor"
          fillOpacity={0.12}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {shape.map(([x, y], i) => (
          <g key={data[i].id}>
            {/* generous invisible hit target for the tooltip */}
            <circle cx={x} cy={y} r={12} fill="transparent">
              <title>{`${data[i].label}: ${data[i].value} publications`}</title>
            </circle>
            <circle cx={x} cy={y} r={4} fill="currentColor" stroke="var(--background)" strokeWidth={2} pointerEvents="none" />
          </g>
        ))}

        {/* direct labels */}
        {data.map((d, i) => {
          const [x, y] = point(i, n, RADIUS + 24);
          const anchor = Math.abs(x - CENTER) < 8 ? "middle" : x > CENTER ? "start" : "end";
          return (
            <text key={d.id} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-muted-foreground text-[17px]">
              <tspan>{d.label}</tspan>
              <tspan x={x} dy="1.2em" className="fill-foreground font-mono text-[16px] font-bold">
                {d.value}
              </tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className="font-mono text-[11px] tracking-wide text-text-faint uppercase">{title}</figcaption>
    </figure>
  );
}
