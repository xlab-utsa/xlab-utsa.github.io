import type { Metadata } from "next";

import { ExternalLink } from "@/components/external-link";
import { SectionIntro } from "@/components/section-intro";
import { getSiteMeta } from "@/lib/content";

export const metadata: Metadata = {
  title: "Location & Lab Culture",
};

// UTSA Main Campus, San Antonio. Shown with OpenStreetMap's embed — no API key, no
// tracking cookies — and plain links for a larger map and directions.
const MAP_CENTER = { lat: 29.583, lon: -98.6197 };
const MAP_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=-98.6320%2C29.5760%2C-98.6070%2C29.5900&layer=mapnik&marker=${MAP_CENTER.lat}%2C${MAP_CENTER.lon}`;
const MAP_LINK = `https://www.openstreetmap.org/?mlat=${MAP_CENTER.lat}&mlon=${MAP_CENTER.lon}#map=16/${MAP_CENTER.lat}/${MAP_CENTER.lon}`;
const DIRECTIONS_LINK = `https://www.openstreetmap.org/directions?to=${MAP_CENTER.lat}%2C${MAP_CENTER.lon}`;

// Location & Lab Culture (SPEC.md §5) — the original layout, two equal columns (where we are
// | lab culture), in the site's new style. The culture write-up is still to be written; the
// location part is real.
export default function LabPage() {
  const address = getSiteMeta().contact?.address;
  const addressLines = address
    ? [address.line1, address.line2, [address.city, address.state, address.zip].filter(Boolean).join(", "), address.country].filter(Boolean)
    : [];

  return (
    <div>
      <SectionIntro title="Location & Lab Culture" className="max-w-[1500px]" />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-6 pb-24 sm:px-10 lg:grid-cols-2">
        {/* ---------------- where we are ---------------- */}
        <section aria-labelledby="location-heading" className="flex flex-col rounded-[24px] bg-bg-alt p-6 sm:p-8">
          <h2 id="location-heading" className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold tracking-tight text-foreground">
            Where we are
          </h2>
          {addressLines.length > 0 && (
            <address className="mt-3 text-[18px] leading-relaxed text-muted-foreground not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          )}
          <div className="mt-6 aspect-[4/3] w-full overflow-hidden rounded-[18px] bg-muted">
            <iframe title="Map of UTSA Main Campus" src={MAP_EMBED} loading="lazy" className="h-full w-full border-0" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ExternalLink href={DIRECTIONS_LINK} className="rounded-full bg-foreground px-6 py-3 text-[15px] font-semibold text-background transition-opacity hover:opacity-85">
              Get directions ↗
            </ExternalLink>
            <ExternalLink href={MAP_LINK} className="rounded-full border border-border bg-background px-6 py-3 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted">
              Open a larger map ↗
            </ExternalLink>
          </div>
        </section>

        {/* ---------------- lab culture ---------------- */}
        <section aria-labelledby="culture-heading" className="flex flex-col rounded-[24px] bg-bg-alt p-6 sm:p-8">
          <h2 id="culture-heading" className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold tracking-tight text-foreground">
            Lab culture
          </h2>
          <div className="mt-6 flex flex-1 items-center justify-center rounded-[18px] border-2 border-dashed border-border p-8 text-center">
            <p className="max-w-[40ch] text-[18px] leading-relaxed text-muted-foreground">
              A look at how the lab works — group meetings, mentoring, and life in San Antonio — is coming soon.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
