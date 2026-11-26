"use client";

// "Who works on what": lab members → research areas → venues, as an interactive map.
// Every curve is real — a member is linked to an area by the papers they co-authored there,
// an area to a venue by the papers it published there; stroke width is the paper count.
// Hover or keyboard-focus any node and only its connections stay lit.
import { useMemo, useState } from "react";

import { withBasePath } from "@/lib/base-path";

interface Node {
  id: string;
  label: string;
  sub?: string;
  photo?: string;
  value?: number;
}

type Key = `p:${string}` | `t:${string}` | `v:${string}`;

const W = 1200;
const COL = { p: 210, t: 600, v: 990 };

export function WhoWorksOnWhat({
  people,
  themes,
  venues,
  links,
  venueLinks,
}: {
  people: Node[];
  themes: Node[];
  venues: Node[];
  links: { personId: string; themeId: string; weight: number }[];
  venueLinks: { themeId: string; venueId: string; weight: number }[];
}) {
  const [active, setActive] = useState<Key>();

  const rows = Math.max(people.length, themes.length, venues.length);
  const H = Math.max(560, rows * 54 + 60);
  const ys = (n: number) => (i: number) => 40 + ((H - 80) * (i + 0.5)) / n;
  const py = ys(people.length);
  const ty = ys(themes.length);
  const vy = ys(venues.length);
  const maxT = Math.max(...themes.map((t) => t.value ?? 1));
  const tr = (v = 1) => 10 + 22 * Math.sqrt(v / maxT);

  // What lights up when `active` is set: the node, its neighbours, and (through an area)
  // the next column too.
  const lit = useMemo(() => {
    if (!active) return undefined;
    const set = new Set<string>([active]);
    const [kind, id] = [active.slice(0, 1), active.slice(2)];
    const themesOf = new Set<string>();
    if (kind === "p") links.filter((l) => l.personId === id).forEach((l) => themesOf.add(l.themeId));
    if (kind === "t") themesOf.add(id);
    if (kind === "v") venueLinks.filter((l) => l.venueId === id).forEach((l) => themesOf.add(l.themeId));
    themesOf.forEach((t) => set.add(`t:${t}`));
    if (kind !== "p") links.filter((l) => themesOf.has(l.themeId)).forEach((l) => set.add(`p:${l.personId}`));
    if (kind !== "v") venueLinks.filter((l) => themesOf.has(l.themeId)).forEach((l) => set.add(`v:${l.venueId}`));
    return set;
  }, [active, links, venueLinks]);

  const on = (k: string) => !lit || lit.has(k);
  const maxL = Math.max(...links.map((l) => l.weight), 1);
  const maxV = Math.max(...venueLinks.map((l) => l.weight), 1);
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };
  const focusable = (k: Key, label: string) => ({
    tabIndex: 0,
    role: "button" as const,
    "aria-label": label,
    onMouseEnter: () => setActive(k),
    onMouseLeave: () => setActive(undefined),
    onFocus: () => setActive(k),
    onBlur: () => setActive(undefined),
    style: { cursor: "pointer", outline: "none" },
  });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[860px]" role="group" aria-label="Map of lab members, research areas and venues">
        <defs>
          <clipPath id="wwow-face">
            <circle r="17" />
          </clipPath>
        </defs>

        {/* column headings */}
        {[
          ["p", "Lab members"],
          ["t", "Research areas"],
          ["v", "Top venues"],
        ].map(([k, label]) => (
          <text key={k} x={COL[k as "p"]} y={16} textAnchor="middle" className="fill-text-faint font-mono text-[11px] tracking-[0.2em] uppercase">
            {label}
          </text>
        ))}

        {/* edges: people → areas */}
        {links.map((l) => {
          const i = people.findIndex((p) => p.id === l.personId);
          const j = themes.findIndex((t) => t.id === l.themeId);
          if (i < 0 || j < 0) return null;
          const shown = on(`p:${l.personId}`) && on(`t:${l.themeId}`);
          return (
            <path
              key={`${l.personId}-${l.themeId}`}
              d={curve(COL.p + 24, py(i), COL.t - tr(themes[j].value), ty(j))}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={1 + 5 * (l.weight / maxL)}
              strokeOpacity={lit ? (shown ? 0.75 : 0.04) : 0.22}
              className="transition-[stroke-opacity] duration-300"
            />
          );
        })}

        {/* edges: areas → venues */}
        {venueLinks.map((l) => {
          const j = themes.findIndex((t) => t.id === l.themeId);
          const k = venues.findIndex((v) => v.id === l.venueId);
          if (j < 0 || k < 0) return null;
          const shown = on(`t:${l.themeId}`) && on(`v:${l.venueId}`);
          return (
            <path
              key={`${l.themeId}-${l.venueId}`}
              d={curve(COL.t + tr(themes[j].value), ty(j), COL.v - 10, vy(k))}
              fill="none"
              stroke="currentColor"
              strokeWidth={1 + 5 * (l.weight / maxV)}
              strokeOpacity={lit ? (shown ? 0.6 : 0.03) : 0.14}
              className="text-foreground transition-[stroke-opacity] duration-300"
            />
          );
        })}

        {/* people */}
        {people.map((p, i) => (
          <g key={p.id} transform={`translate(${COL.p}, ${py(i)})`} opacity={on(`p:${p.id}`) ? 1 : 0.25} className="transition-opacity duration-300" {...focusable(`p:${p.id}`, p.label)}>
            <circle r="19" className="fill-background" stroke="var(--brand)" strokeWidth={active === `p:${p.id}` ? 2.5 : 1} />
            {p.photo ? (
              <image href={withBasePath(p.photo)} x={-17} y={-17} width={34} height={34} clipPath="url(#wwow-face)" preserveAspectRatio="xMidYMid slice" />
            ) : (
              <text textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground font-mono text-[11px]">
                {p.label.slice(0, 2)}
              </text>
            )}
            <text x={-30} textAnchor="end" dominantBaseline="central" className="fill-foreground text-[14px] font-semibold">
              {p.label}
            </text>
            {p.sub && (
              <text x={-30} y={16} textAnchor="end" className="fill-text-faint font-mono text-[10px] uppercase">
                {p.sub}
              </text>
            )}
          </g>
        ))}

        {/* research areas */}
        {themes.map((t, j) => (
          <g key={t.id} transform={`translate(${COL.t}, ${ty(j)})`} opacity={on(`t:${t.id}`) ? 1 : 0.25} className="transition-opacity duration-300" {...focusable(`t:${t.id}`, `${t.label}, ${t.value} papers`)}>
            <circle r={tr(t.value)} fill="var(--brand)" fillOpacity={active === `t:${t.id}` ? 1 : 0.85} />
            <text textAnchor="middle" dominantBaseline="central" className="font-mono text-[12px] font-bold" fill="var(--brand-foreground)">
              {t.value}
            </text>
            <text y={tr(t.value) + 15} textAnchor="middle" className="fill-foreground text-[13.5px] font-semibold">
              {t.label}
            </text>
          </g>
        ))}

        {/* venues */}
        {venues.map((v, k) => (
          <g key={v.id} transform={`translate(${COL.v}, ${vy(k)})`} opacity={on(`v:${v.id}`) ? 1 : 0.25} className="transition-opacity duration-300" {...focusable(`v:${v.id}`, `${v.label}, ${v.value} papers`)}>
            <rect x={-8} y={-8} width={16} height={16} rx={3} className="fill-foreground" />
            <text x={18} dominantBaseline="central" className="fill-foreground text-[14px] font-bold">
              {v.label}
            </text>
            <text x={18} y={16} className="fill-text-faint font-mono text-[10.5px]">
              {v.value} papers
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
