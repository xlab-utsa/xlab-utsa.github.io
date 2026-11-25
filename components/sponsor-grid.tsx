import Image from "next/image";

import { ExternalLink } from "@/components/external-link";
import type { Sponsor } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

// Logos only, identical on the homepage and /sponsors until the PI asks for grant detail
// (SPEC.md decision #7). A sponsor without a logo file shows its name instead.
export function SponsorGrid({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) {
    return <p className="text-sm text-muted-foreground">No sponsors listed yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {sponsors.map((sponsor) => {
        const hasLogo = publicFileExists(sponsor.logo);
        const inner = (
          <div className="flex h-[58px] items-center justify-center border border-border bg-bg-alt p-1.5">
            {hasLogo ? (
              <div className="relative h-full w-full">
                <Image
                  src={withBasePath(sponsor.logo!)}
                  alt={sponsor.name}
                  fill
                  sizes="120px"
                  className="object-contain"
                />
              </div>
            ) : (
              <span className="text-center font-mono text-[11.5px] text-muted-foreground">
                {sponsor.name}
              </span>
            )}
          </div>
        );
        return sponsor.url ? (
          <ExternalLink key={sponsor.id} href={sponsor.url} ariaLabel={sponsor.name}>
            {inner}
          </ExternalLink>
        ) : (
          <div key={sponsor.id}>{inner}</div>
        );
      })}
    </div>
  );
}
