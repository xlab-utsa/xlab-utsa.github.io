import Image from "next/image";

import { ExternalLink } from "@/components/external-link";
import {
  getPersonById,
  getPublicationById,
  type Person,
  type Project,
} from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { resolvePersonRedirectUrl } from "@/lib/team";

// `projectStatus` (active/deployed/archived), not the schema-v2 `status` envelope every
// entity carries for draft/published/hidden.
const STATUS_LABELS: Record<NonNullable<Project["projectStatus"]>, string> = {
  active: "Active",
  deployed: "Deployed",
  archived: "Archived",
};

function resolvePaperLink(project: Project): string | undefined {
  if (project.links?.paperUrl) return project.links.paperUrl;
  const pub = project.links?.publicationId
    ? getPublicationById(project.links.publicationId)
    : undefined;
  if (!pub) return undefined;
  if (pub.pdfUrl) return pub.pdfUrl;
  if (pub.url) return pub.url;
  if (pub.doi) return pub.doi.startsWith("http") ? pub.doi : `https://doi.org/${pub.doi}`;
  return undefined;
}

function ContributorsLine({ ids }: { ids: string[] }) {
  const people = ids
    .map((id) => getPersonById(id))
    .filter((p): p is Person => Boolean(p));
  if (people.length === 0) return null;

  return (
    <span className="text-[11.5px] leading-snug text-text-faint">
      {people.map((person, i) => (
        <span key={person.id}>
          <ExternalLink
            href={resolvePersonRedirectUrl(person)}
            className="hover:text-foreground hover:underline"
          >
            {person.name}
          </ExternalLink>
          {i < people.length - 1 ? ", " : ""}
        </span>
      ))}
    </span>
  );
}

// No detail page, ever (SPEC.md §6) — this card is the entire presence a Project has
// on the site. `description` is intentionally not rendered, matching the poloclub-
// style card omission SPEC.md calls out. Fill-vs-outline (not hue) is how "Project"
// is distinguished from "Publication" cards elsewhere in the B&W palette — see the
// legend in research-browser.tsx.
export function ProjectCard({ project }: { project: Project }) {
  const hasThumbnail = publicFileExists(project.thumbnail);
  const paperLink = resolvePaperLink(project);
  const links = project.links ?? {};

  const linkEntries: { key: string; href: string; label: string }[] = [];
  if (paperLink) linkEntries.push({ key: "paper", href: paperLink, label: "Paper" });
  if (links.code) linkEntries.push({ key: "code", href: links.code, label: "Code" });
  if (links.demo) linkEntries.push({ key: "demo", href: links.demo, label: "Demo" });
  if (links.video) linkEntries.push({ key: "video", href: links.video, label: "Video" });
  if (links.poster) linkEntries.push({ key: "poster", href: links.poster, label: "Poster" });
  if (links.website) linkEntries.push({ key: "website", href: links.website, label: "Website" });

  return (
    <div className="flex flex-col border border-t-[3px] border-brand-soft-border border-t-brand bg-brand-soft-bg">
      <div className="relative aspect-video border-b border-brand-soft-border bg-[repeating-linear-gradient(135deg,var(--hairline)_0_6px,var(--bg-alt)_6px_12px)]">
        {hasThumbnail && project.thumbnail && (
          <Image
            src={withBasePath(project.thumbnail!)}
            alt={project.title}
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] font-bold tracking-wider text-brand-strong uppercase">
            <span aria-hidden="true" className="size-1.5 bg-brand" />
            Project
          </span>
          {project.projectStatus && (
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {STATUS_LABELS[project.projectStatus]}
            </span>
          )}
        </div>
        {paperLink ? (
          <ExternalLink
            href={paperLink}
            className="text-lg leading-snug font-bold tracking-tight text-foreground hover:underline"
          >
            {project.title}
          </ExternalLink>
        ) : (
          <span className="text-lg leading-snug font-bold tracking-tight text-foreground">
            {project.title}
          </span>
        )}
        <span className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
          {project.tagline}
        </span>
        {project.collaborationWith && (
          <span className="text-[11.5px] text-text-faint">
            Collaboration with {project.collaborationWith}
          </span>
        )}
        {project.contributors && project.contributors.length > 0 && (
          <ContributorsLine ids={project.contributors} />
        )}
        {linkEntries.length > 0 && (
          <div className="flex flex-wrap gap-3 border-t border-hairline pt-2.5">
            {linkEntries.map(({ key, href, label }) => (
              <ExternalLink
                key={key}
                href={href}
                className="font-mono text-[11px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground"
              >
                {label}
              </ExternalLink>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
