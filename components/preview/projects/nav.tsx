import Image from "next/image";
import Link from "next/link";

import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

import type { PreviewMember, PreviewProject } from "./data";

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

/** The project's illustration on a white panel (the art is line work on white, so it stays white in dark mode too). */
export function Art({ project, className, sizes = "50vw", priority }: { project: PreviewProject; className?: string; sizes?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      {project.thumbnail && (
        <Image src={withBasePath(project.thumbnail)} alt="" fill sizes={sizes} priority={priority} className="object-contain p-[6%]" />
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Overlapping faces of the lab members on a project. */
export function Faces({ members, size = 34, className }: { members: PreviewMember[]; size?: number; className?: string }) {
  return (
    <ul className={cn("flex -space-x-2", className)}>
      {members.map((m) => (
        <li key={m.id} title={m.name} className="relative shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background" style={{ width: size, height: size }}>
          {m.photo ? (
            <Image src={withBasePath(m.photo)} alt={m.name} fill sizes={`${size}px`} className="object-cover" />
          ) : (
            <span className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">{initials(m.name)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export const STATUS_LABEL = { active: "Active", deployed: "Deployed", archived: "Archived" } as const;

export const yearsLabel = (y?: [number, number]) => (!y ? "" : y[0] === y[1] ? `${y[0]}` : `${y[0]}–${y[1]}`);

/** "Chenhui Xu, Yuting Hu and Jinjun Xiong". */
export const names = (members: PreviewMember[]) => members.map((m) => m.name).join(", ").replace(/, ([^,]*)$/, " and $1");

/** Link pills: filled for the first, outlined for the rest. */
export function LinkPills({ project, className }: { project: PreviewProject; className?: string }) {
  if (project.links.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {project.links.map((l, i) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors",
            i === 0 ? "bg-foreground text-background hover:opacity-85" : "border border-border text-foreground hover:bg-muted"
          )}
        >
          {l.label} <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}
