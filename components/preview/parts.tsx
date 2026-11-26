// Small pieces shared by the home-page design previews.
import Image from "next/image";
import Link from "next/link";

import { AnimatedCounter } from "@/components/animated-counter";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { PreviewPerson } from "@/lib/home/data";

export { AnimatedCounter as Counter };

/** A gallery photo that fills its (relatively positioned) parent. */
export function Photo({
  src,
  alt,
  sizes = "50vw",
  priority,
  className,
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return <Image src={withBasePath(src)} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Round face for a lab member, with an initials fallback. */
export function Face({ person, size = 56, className }: { person: PreviewPerson; size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-mono text-[11px] text-muted-foreground", className)}
      style={{ width: size, height: size }}
      title={person.name}
    >
      {person.photo ? <Image src={withBasePath(person.photo)} alt={person.name} fill sizes={`${size}px`} className="object-cover" /> : initials(person.name)}
    </span>
  );
}

/** Text link with an arrow, used as each block's way through to its full page. */
export function More({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground", className)}>
      <span className="underline-offset-4 group-hover:underline">{children}</span>
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

export function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
