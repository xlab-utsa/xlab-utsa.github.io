import Link from "next/link";

import { cn } from "@/lib/utils";

export { initials, LinkIcons, PersonLinks, PersonPhoto } from "@/components/people/person-parts";

// The two People-page options. Both keep the live page's structure (the PI's three-column
// block, then the groups); they differ in finish. slug = /preview/people/<slug>.
export const PEOPLE_DESIGNS = [
  { slug: "refined", n: "A", name: "Refined", line: "The same layout, sharpened: larger type, honors as figures, richer member tiles." },
  { slug: "panels", n: "B", name: "Panels", line: "The same order on soft panels: education as a timeline, members as cards with their areas." },
] as const;

/** Top bar for flipping between the People options (the site-wide preview bar sits at the bottom). */
export function PeoplePreviewBar({ current }: { current?: string }) {
  return (
    <nav
      aria-label="People page options"
      className="sticky top-[59px] z-30 flex items-center justify-center gap-1 overflow-x-auto border-y border-neutral-800 bg-neutral-950 px-4 py-1.5 text-[12.5px] text-white"
    >
      <Link
        href="/preview/people"
        className={cn("shrink-0 rounded-full px-3 py-1 font-mono tracking-wide", !current ? "bg-white text-neutral-950" : "text-white/70 hover:text-white")}
      >
        PEOPLE · ALL
      </Link>
      {PEOPLE_DESIGNS.map((d) => (
        <Link
          key={d.slug}
          href={`/preview/people/${d.slug}`}
          className={cn("shrink-0 rounded-full px-3 py-1 whitespace-nowrap", current === d.slug ? "bg-white text-neutral-950" : "text-white/70 hover:text-white")}
        >
          <span className="mr-1 font-mono text-[10.5px] opacity-60">{d.n}</span>
          {d.name}
        </Link>
      ))}
    </nav>
  );
}

