import { ExternalLink } from "@/components/external-link";
import { getSiteMeta } from "@/lib/content";

export function SiteFooter() {
  const site = getSiteMeta();
  const address = site.contact?.address;
  const addressLine = address
    ? [
        address.line1,
        address.line2,
        [address.city, address.state, address.zip].filter(Boolean).join(", "),
        address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : undefined;

  const socialEntries = Object.entries(site.socialLinks ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[1])
  );

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-10">
        <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
          <span className="text-sm font-bold text-foreground">
            {site.title} — {site.tagline}
          </span>
          <span>
            {[addressLine, site.contact?.email].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted-foreground">
          {socialEntries.map(([key, url]) => (
            <ExternalLink
              key={key}
              href={url}
              className="transition-colors hover:text-foreground"
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </ExternalLink>
          ))}
          {site.contact?.email && (
            <a
              href={`mailto:${site.contact.email}`}
              className="transition-colors hover:text-foreground"
            >
              Contact
            </a>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] px-6 pb-8 text-xs text-text-faint sm:px-10">
        © {new Date().getFullYear()} {site.title}. All rights reserved.
      </div>
    </footer>
  );
}
