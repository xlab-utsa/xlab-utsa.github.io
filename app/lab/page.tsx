import type { Metadata } from "next";

import { ExternalLink } from "@/components/external-link";
import { PageHeader } from "@/components/page-header";
import { getSiteMeta } from "@/lib/content";

export const metadata: Metadata = {
  title: "Location & Lab Culture",
};

// UTSA Main Campus, San Antonio. Shown with OpenStreetMap's embed — no API key, no
// tracking cookies — and a plain link for anyone who would rather open a full map.
const MAP_CENTER = { lat: 29.5830, lon: -98.6197 };
const MAP_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=-98.6320%2C29.5760%2C-98.6070%2C29.5900&layer=mapnik&marker=${MAP_CENTER.lat}%2C${MAP_CENTER.lon}`;
const MAP_LINK = `https://www.openstreetmap.org/?mlat=${MAP_CENTER.lat}&mlon=${MAP_CENTER.lon}#map=16/${MAP_CENTER.lat}/${MAP_CENTER.lon}`;

// Location & Lab Culture (SPEC.md §5). The culture write-up is still to be written; the
// location part is real.
export default function LabPage() {
  const address = getSiteMeta().contact?.address;
  const addressLines = address
    ? [address.line1, address.line2, [address.city, address.state, address.zip].filter(Boolean).join(", "), address.country].filter(Boolean)
    : [];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-14 sm:px-10">
      <PageHeader title="Location & Lab Culture" />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section aria-labelledby="location-heading" className="flex flex-col gap-4">
          <h2 id="location-heading" className="font-mono text-[15px] font-bold tracking-widest text-foreground uppercase">
            Where we are
          </h2>
          {addressLines.length > 0 && (
            <address className="text-[15px] leading-relaxed text-muted-foreground not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          )}
          <div className="aspect-[4/3] w-full overflow-hidden border border-border bg-muted">
            <iframe
              title="Map of UTSA Main Campus"
              src={MAP_EMBED}
              loading="lazy"
              className="h-full w-full border-0"
            />
          </div>
          <ExternalLink href={MAP_LINK} className="text-[13.5px] font-semibold text-foreground hover:underline">
            Open a larger map →
          </ExternalLink>
        </section>

        <section aria-labelledby="culture-heading" className="flex flex-col gap-4">
          <h2 id="culture-heading" className="font-mono text-[15px] font-bold tracking-widest text-foreground uppercase">
            Lab culture
          </h2>
          <div className="flex min-h-[240px] items-center justify-center border border-dashed border-border p-6 text-center">
            <p className="max-w-[40ch] text-[14px] leading-relaxed text-muted-foreground">
              A look at how the lab works — group meetings, mentoring, and life in San Antonio — is coming soon.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
