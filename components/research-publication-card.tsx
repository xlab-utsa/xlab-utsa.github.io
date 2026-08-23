import Image from "next/image";

import { ExternalLink } from "@/components/external-link";
import { getPersonById, type Publication } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { getCategoryMetaLine } from "@/lib/publications";
import { resolvePersonRedirectUrl } from "@/lib/team";

function formatDate(pub: Publication): string | undefined {
  if (pub.dateDisplay) return pub.dateDisplay;
  if (pub.month && pub.year) return `${pub.month} ${pub.year}`;
  if (pub.year) return String(pub.year);
  return undefined;
}

function primaryLink(pub: Publication): string | undefined {
  if (pub.pdfUrl) return pub.pdfUrl;
  if (pub.url) return pub.url;
  if (pub.doi) return pub.doi.startsWith("http") ? pub.doi : `https://doi.org/${pub.doi}`;
  return undefined;
}

function AuthorsLine({ authors }: { authors: Publication["authors"] }) {
  return (
    <p className="text-[12.5px] leading-snug text-muted-foreground">
      {authors.map((author, i) => {
        const person = author.personId ? getPersonById(author.personId) : undefined;
        return (
          <span key={`${author.name}-${i}`}>
            {person ? (
              <ExternalLink
                href={resolvePersonRedirectUrl(person)}
                className="hover:text-foreground hover:underline"
              >
                {author.name}
              </ExternalLink>
            ) : (
              author.name
            )}
            {i < authors.length - 1 ? ", " : ""}
          </span>
        );
      })}
    </p>
  );
}

// The orange-toned sibling of project-card.tsx, same card shape, for Publications
// tagged with a themeId (SPEC.md — an inferred subset, not all 301 entries). Distinct
// from publication-entry.tsx (the dense list row used on /publications) — this is a
// card matching the research browser's grid, not a list.
export function ResearchPublicationCard({ publication }: { publication: Publication }) {
  const date = formatDate(publication);
  const link = primaryLink(publication);
  const metaLine = getCategoryMetaLine(publication);
  const hasThumbnail = publicFileExists(publication.thumbnail);

  return (
    <div className="flex flex-col border border-t-[3px] border-brand-orange-soft-border border-t-brand-orange bg-brand-orange-soft-bg">
      <div className="relative aspect-video border-b border-brand-orange-soft-border bg-[repeating-linear-gradient(135deg,var(--brand-orange-soft-border)_0_6px,var(--brand-orange-soft-bg)_6px_12px)]">
        {hasThumbnail && publication.thumbnail && (
          <Image
            src={withBasePath(publication.thumbnail!)}
            alt={publication.title}
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] font-bold tracking-wider text-brand-orange-strong uppercase">
            <span aria-hidden="true" className="size-1.5 bg-brand-orange" />
            Publication
          </span>
          {date && (
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {date}
            </span>
          )}
        </div>
        {link ? (
          <ExternalLink
            href={link}
            className="text-lg leading-snug font-bold tracking-tight text-foreground hover:underline"
          >
            {publication.title}
          </ExternalLink>
        ) : (
          <span className="text-lg leading-snug font-bold tracking-tight text-foreground">
            {publication.title}
          </span>
        )}
        <AuthorsLine authors={publication.authors} />
        {publication.venue && (
          <em className="text-[13px] text-muted-foreground">{publication.venue}</em>
        )}
        {metaLine && (
          <span className="font-mono text-[11px] text-text-faint">{metaLine}</span>
        )}
      </div>
    </div>
  );
}
