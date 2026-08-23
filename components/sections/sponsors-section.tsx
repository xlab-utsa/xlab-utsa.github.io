import Image from "next/image";

import { ExternalLink } from "@/components/external-link";
import { RecruitingBanner } from "@/components/sections/recruiting-banner";
import { getAllSponsors, getSiteMeta } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

export function SponsorsSection() {
  const sponsors = getAllSponsors();
  const site = getSiteMeta();
  if (sponsors.length === 0 && !site.recruitingNotice) return null;

  const withGrants = sponsors.filter((s) => s.grantNumbers && s.grantNumbers.length > 0);

  return (
    <section
      id="sponsors"
      aria-labelledby="sponsors-heading"
      className="scroll-mt-16 border-b border-border"
    >
      <div className="mx-auto max-w-[1600px] px-6 py-12 sm:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <div>
            <h2
              id="sponsors-heading"
              className="mb-5 font-mono text-[15px] font-bold tracking-widest text-foreground uppercase"
            >
              Sponsors &amp; funding
            </h2>
            {sponsors.length > 0 ? (
              <>
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
                {withGrants.length > 0 && (
                  <div className="mt-5 space-y-1 text-xs text-text-faint">
                    {withGrants.map((s) => (
                      <p key={s.id}>
                        {s.name}: {s.grantNumbers!.join(", ")}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No sponsors listed yet.</p>
            )}
          </div>
          <RecruitingBanner />
        </div>
      </div>
    </section>
  );
}
