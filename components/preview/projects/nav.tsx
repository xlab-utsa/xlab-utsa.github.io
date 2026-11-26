import Link from "next/link";

import { cn } from "@/lib/utils";

export { Art, Faces, LinkPills, names, STATUS_LABEL, yearsLabel } from "@/components/projects/parts";

// The four Projects-page designs. Order = build order; slug = /preview/projects/<slug>.
export const PROJECT_DESIGNS = [
  { slug: "showcase", n: "P1", name: "Showcase", line: "One big alternating row per project, like a product page." },
  { slug: "wall", n: "P2", name: "Card wall", line: "A grid of tall cards with research-area filters; grows well as projects are added." },
  { slug: "timeline", n: "P3", name: "Timeline", line: "The projects placed on the years of their papers, each paper a milestone." },
  { slug: "explorer", n: "P4", name: "Explorer", line: "A list of projects beside a large panel that changes as you pick one." },
] as const;

/** Top bar for flipping between the four Projects designs (the site-wide preview bar sits at the bottom). */
export function ProjectsPreviewBar({ current }: { current?: string }) {
  return (
    <nav
      aria-label="Projects page designs"
      className="sticky top-[59px] z-30 flex items-center justify-center gap-1 overflow-x-auto border-y border-neutral-800 bg-neutral-950 px-4 py-1.5 text-[12.5px] text-white"
    >
      <Link
        href="/preview/projects"
        className={cn("shrink-0 rounded-full px-3 py-1 font-mono tracking-wide", !current ? "bg-white text-neutral-950" : "text-white/70 hover:text-white")}
      >
        PROJECTS · ALL
      </Link>
      {PROJECT_DESIGNS.map((d) => (
        <Link
          key={d.slug}
          href={`/preview/projects/${d.slug}`}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 whitespace-nowrap",
            current === d.slug ? "bg-white text-neutral-950" : "text-white/70 hover:text-white"
          )}
        >
          <span className="mr-1 font-mono text-[10.5px] opacity-60">{d.n}</span>
          {d.name}
        </Link>
      ))}
    </nav>
  );
}

