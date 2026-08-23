import { ExternalLink as ExternalLinkIcon, FileText, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "@/components/external-link";
import { getPersonById, type Publication } from "@/lib/content";
import { getCategoryMetaLine } from "@/lib/publications";
import { resolvePersonRedirectUrl } from "@/lib/team";

function formatDate(pub: Publication): string | undefined {
  if (pub.dateDisplay) return pub.dateDisplay;
  if (pub.month && pub.year) return `${pub.month} ${pub.year}`;
  if (pub.year) return String(pub.year);
  return undefined;
}

function doiHref(doi: string): string {
  return doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
}

// Mixed linked/plain-text author list — only authors with a confirmed personId (a real
// lab member) link out, via the same redirect resolution team cards use (there's no
// per-person page to link to instead).
function AuthorsLine({ authors }: { authors: Publication["authors"] }) {
  return (
    <p className="text-sm text-muted-foreground">
      {authors.map((author, i) => {
        const person = author.personId ? getPersonById(author.personId) : undefined;
        return (
          <span key={`${author.name}-${i}`}>
            {person ? (
              <ExternalLink
                href={resolvePersonRedirectUrl(person)}
                className="underline-offset-2 hover:text-foreground hover:underline"
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

export function PublicationEntry({ publication }: { publication: Publication }) {
  const date = formatDate(publication);
  const showLocation =
    (publication.category === "conference" || publication.category === "workshop") &&
    !!publication.location;
  const metaLine = getCategoryMetaLine(publication);

  return (
    <li className="space-y-1.5 border-b border-hairline py-4 first:pt-0 last:border-b-0">
      <p className="text-[15.5px] font-semibold tracking-tight text-foreground">
        {publication.title}
      </p>
      <AuthorsLine authors={publication.authors} />
      <p className="text-sm text-muted-foreground">
        {publication.venue && <em>{publication.venue}</em>}
        {showLocation ? `, ${publication.location}` : ""}
        {date ? (
          <span className="font-mono text-[12.5px] text-text-faint"> · {date}</span>
        ) : (
          ""
        )}
      </p>
      {metaLine && (
        <p className="font-mono text-[12.5px] text-text-faint">{metaLine}</p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {publication.note && <Badge variant="outline">{publication.note}</Badge>}
        {publication.doi && (
          <ExternalLink
            href={doiHref(publication.doi)}
            ariaLabel="DOI"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Link2 className="size-4" aria-hidden="true" />
          </ExternalLink>
        )}
        {publication.url && (
          <ExternalLink
            href={publication.url}
            ariaLabel="View publication"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
          </ExternalLink>
        )}
        {publication.pdfUrl && (
          <ExternalLink
            href={publication.pdfUrl}
            ariaLabel="PDF"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileText className="size-4" aria-hidden="true" />
          </ExternalLink>
        )}
      </div>
    </li>
  );
}
