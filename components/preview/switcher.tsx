"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DESIGNS } from "./designs";

/** Floating bar for flipping between the design previews. Preview pages only. */
export function PreviewSwitcher() {
  const path = usePathname().replace(/\/$/, "");
  return (
    <nav
      aria-label="Design previews"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-neutral-950/90 p-1 text-[12px] text-white shadow-2xl backdrop-blur"
    >
      <Link
        href="/preview"
        className={`shrink-0 rounded-full px-3 py-1.5 font-mono tracking-wide ${path === "/preview" ? "bg-white text-neutral-950" : "text-white/70 hover:text-white"}`}
      >
        ALL
      </Link>
      {DESIGNS.map((d) => {
        const active = path === `/preview/${d.slug}`;
        return (
          <Link
            key={d.slug}
            href={`/preview/${d.slug}`}
            className={`shrink-0 rounded-full px-3 py-1.5 whitespace-nowrap ${active ? "bg-white text-neutral-950" : "text-white/70 hover:text-white"}`}
          >
            <span className="mr-1 font-mono text-[10px] opacity-60">{d.n}</span>
            {d.name}
          </Link>
        );
      })}
    </nav>
  );
}
