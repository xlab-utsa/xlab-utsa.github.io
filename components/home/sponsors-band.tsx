import Image from "next/image";
import Link from "next/link";

import type { Sponsor } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

// The home page's closing band: a deep-blue field with a soft glow, and the sponsors as a wall
// of logo tiles (not links: the sponsors page carries the addresses). It stays dark in both
// themes, so every logo is shown in white (one consistent treatment, whatever the file's
// colours). A sponsor without a logo file yet shows its name set in type instead.
const KIND_LABEL: Record<NonNullable<Sponsor["kind"]>, string> = {
  industry: "Industry",
  government: "Federal agency",
  university: "University",
  foundation: "Foundation",
};

function Tile({ sponsor }: { sponsor: Sponsor }) {
  const hasLogo = publicFileExists(sponsor.logo);
  return (
    <div className="flex h-full flex-col rounded-[22px] bg-white/[0.05] p-7 ring-1 ring-white/10">
      <div className="flex flex-1 items-center justify-center py-10">
        {hasLogo ? (
          <span className="relative block h-16 w-full max-w-[210px]">
            <Image src={withBasePath(sponsor.logo!)} alt={sponsor.name} fill sizes="210px" className="object-contain brightness-0 invert" />
          </span>
        ) : (
          <span className="text-center text-[clamp(2rem,2.8vw,2.7rem)] leading-none font-bold tracking-[-0.03em] text-white">
            {sponsor.shortName ?? sponsor.name}
          </span>
        )}
      </div>
      <div className="border-t border-white/10 pt-4">
        {(hasLogo || sponsor.shortName) && <p className="text-[15.5px] leading-snug font-semibold text-white/85">{sponsor.name}</p>}
        {sponsor.kind && (
          <p className="mt-1 font-mono text-[12px] tracking-[0.18em] text-white/50 uppercase first:mt-0">{KIND_LABEL[sponsor.kind]}</p>
        )}
      </div>
    </div>
  );
}

export function SponsorsBand({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  return (
    <section aria-labelledby="sponsors-heading" className="relative isolate overflow-hidden bg-[oklch(0.17_0.05_255)] text-white">
      {/* glow */}
      <div aria-hidden="true" className="absolute -top-40 -left-32 -z-10 size-[620px] rounded-full bg-[oklch(0.6_0.17_255)] opacity-30 blur-[140px]" />

      <div className="mx-auto max-w-[1500px] px-6 py-20 sm:px-10 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[13px] tracking-[0.24em] text-[oklch(0.8_0.1_250)] uppercase">Supported by</p>
            <h2 id="sponsors-heading" className="mt-3 max-w-[24ch] text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.05] font-bold tracking-tight">
              Industry, government and the university behind the work
            </h2>
          </div>
          <Link
            href="/sponsors"
            className="inline-flex items-center gap-2 text-[17px] font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            All sponsors <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
