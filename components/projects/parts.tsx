import Image from "next/image";

import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

import type { PreviewMember, PreviewProject } from "./data";

// Small pieces shared by the Projects page (components/projects/explorer.tsx) and the
// Projects design previews (app/preview/projects/**). Safe in client components.

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
