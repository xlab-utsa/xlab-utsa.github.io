import Image from "next/image";
import Link from "next/link";

import type { Sponsor } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

// The home page's closing section, in the page's own style: the same kicker, heading and soft
// rounded tiles as the hero and the lab story, following light and dark mode. Each sponsor is a
// tile (not a link: the sponsors page carries the addresses) with its logo on a white panel —
// white in both themes, as project thumbnails are, so every logo keeps its own colours. A
// sponsor without a logo file yet shows its name set in type instead.
const KIND_LABEL: Record<NonNullable<Sponsor["kind"]>, string> = {
  industry: "Industry",
  government: "Federal agency",
  university: "University",
  foundation: "Foundation",
};

function Tile({ sponsor }: { sponsor: Sponsor }) {
  const hasLogo = publicFileExists(sponsor.logo);
  return (
    <div className="flex h-full flex-col rounded-[18px] bg-bg-alt p-3">
      <div className="flex h-32 items-center justify-center rounded-[14px] bg-white px-6">
        {hasLogo ? (
          <span className="relative block h-14 w-full max-w-[190px]">
            <Image src={withBasePath(sponsor.logo!)} alt={sponsor.name} fill sizes="190px" className="object-contain" />
          </span>
        ) : (
          <span className="text-center text-[clamp(1.6rem,2.2vw,2.1rem)] leading-none font-bold tracking-tight text-neutral-900">
            {sponsor.shortName ?? sponsor.name}
          </span>
        )}
      </div>
      <div className="px-3 pt-4 pb-2">
        <p className="text-[15px] leading-snug font-semibold text-foreground">{sponsor.name}</p>
        {sponsor.kind && <p className="mt-1 font-mono text-[11.5px] tracking-[0.18em] text-muted-foreground uppercase">{KIND_LABEL[sponsor.kind]}</p>}
      </div>
    </div>
  );
}

export function SponsorsBand({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  return (
    <section aria-labelledby="sponsors-heading">
      <div className="mx-auto max-w-[1500px] px-6 py-20 sm:px-10 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">Supported by</p>
            <h2
              id="sponsors-heading"
              className="mt-3 max-w-[24ch] text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.04] font-bold tracking-tight text-foreground"
            >
              Industry, government and the university behind the work
            </h2>
          </div>
          <Link
            href="/sponsors"
            className="inline-flex items-center gap-2 text-[17px] font-semibold text-foreground underline-offset-4 hover:underline"
          >
            All sponsors <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sponsors.map((s) => (
            <li key={s.id}>
              <Tile sponsor={s} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
