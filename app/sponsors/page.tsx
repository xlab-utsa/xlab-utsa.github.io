import type { Metadata } from "next";
import Image from "next/image";

import { ExternalLink } from "@/components/external-link";
import { SectionIntro } from "@/components/section-intro";
import { getAllSponsors, type Sponsor } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

export const metadata: Metadata = {
  title: "Sponsors",
};

// The original layout — one grid of equal tiles — in the site's new style: each sponsor's
// logo on a white panel (white in both themes, so every logo keeps its own colours), its
// name and kind, linking to its site. Grant detail waits for the PI (SPEC.md decision #7).
const KIND_LABEL: Record<NonNullable<Sponsor["kind"]>, string> = {
  industry: "Industry",
  government: "Federal agency",
  university: "University",
  foundation: "Foundation",
};

function Tile({ s }: { s: Sponsor }) {
  const hasLogo = publicFileExists(s.logo);
  return (
    <span className="flex h-full flex-col rounded-[18px] bg-bg-alt p-3 transition-shadow group-hover:shadow-md">
      <span className="flex h-36 items-center justify-center rounded-[14px] bg-white px-8">
        {hasLogo ? (
          <span className="relative block h-16 w-full max-w-[200px]">
            <Image src={withBasePath(s.logo!)} alt={s.name} fill sizes="200px" className="object-contain" />
          </span>
        ) : (
          <span className="text-center text-[clamp(1.6rem,2.2vw,2.1rem)] leading-none font-bold tracking-tight text-neutral-900">{s.shortName ?? s.name}</span>
        )}
      </span>
      <span className="flex flex-1 items-end justify-between gap-3 px-3 pt-4 pb-2">
        <span>
          <span className="line-clamp-2 block min-h-[2.75em] text-[16px] leading-snug font-semibold text-foreground">{s.name}</span>
          {s.kind && <span className="mt-1 block font-mono text-[11.5px] tracking-[0.18em] text-muted-foreground uppercase">{KIND_LABEL[s.kind]}</span>}
        </span>
        {s.url && (
          <span aria-hidden="true" className="text-[15px] text-muted-foreground group-hover:text-foreground">
            ↗
          </span>
        )}
      </span>
    </span>
  );
}

export default function SponsorsPage() {
  const sponsors = getAllSponsors();

  return (
    <div>
      <SectionIntro title="Sponsors" intro="The organizations whose support makes the lab's research possible." className="max-w-[1100px]" />
      <div className="mx-auto max-w-[1100px] px-6 pb-24 sm:px-10">
        {sponsors.length === 0 ? (
          <p className="text-[17px] text-muted-foreground">No sponsors listed yet.</p>
        ) : (
          // Equal tiles in rows of three (two on tablets); a short last row sits centred.
          <ul className="flex flex-wrap justify-center gap-4">
            {sponsors.map((s) => (
              <li key={s.id} className="w-full sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]">
                {s.url ? (
                  <ExternalLink href={s.url} ariaLabel={s.name} className="group block h-full">
                    <Tile s={s} />
                  </ExternalLink>
                ) : (
                  <Tile s={s} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
