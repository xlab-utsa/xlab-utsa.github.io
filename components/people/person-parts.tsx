import Image from "next/image";
import { Briefcase, Code2, Globe, GraduationCap, Mail } from "lucide-react";

import { withBasePath } from "@/lib/base-path";
import type { PersonLink } from "@/lib/people-directory";
import { cn } from "@/lib/utils";

// Small pieces of a person's presentation, shared by the People page and its previews.

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** A person's photo filling its box, or their initials. */
export function PersonPhoto({ name, photo, sizes, className, priority }: { name: string; photo?: string; sizes: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {photo ? (
        <Image src={withBasePath(photo)} alt={name} fill sizes={sizes} priority={priority} className="object-cover object-[50%_25%]" />
      ) : (
        <span className="grid h-full w-full place-items-center font-mono text-[clamp(14px,2vw,28px)] text-muted-foreground">{initials(name)}</span>
      )}
    </div>
  );
}

/** Text links: "Website · Google Scholar · Email". */
export function PersonLinks({ links, className }: { links: PersonLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[14px] font-semibold", className)}>
      {links.map((l) => (
        <li key={l.key}>
          <a
            href={l.href}
            {...(l.key === "email" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {l.label}
            {l.key !== "email" && <span aria-hidden="true"> ↗</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

const ICONS = { email: Mail, scholar: GraduationCap, website: Globe, linkedin: Briefcase, github: Code2 } as const;

/** A person's links as small square icon buttons (only the links they have). */
export function LinkIcons({ links, size = 36, className }: { links: PersonLink[]; size?: number; className?: string }) {
  if (links.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {links.map((l) => {
        const Icon = ICONS[l.key];
        return (
          <li key={l.key}>
            <a
              href={l.href}
              aria-label={l.label}
              title={l.label}
              {...(l.key === "email" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              className="grid place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
              style={{ width: size, height: size }}
            >
              <Icon aria-hidden="true" className="size-[45%]" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
