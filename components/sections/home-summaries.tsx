import Link from "next/link";

import { NewsList } from "@/components/news-list";
import { SummaryHeading } from "@/components/page-header";
import { PiSummary } from "@/components/people/people-directory";
import { ProjectCard } from "@/components/project-card";
import { RadarChart } from "@/components/research/radar-chart";
import { VenueBars } from "@/components/research/venue-bars";
import { SponsorGrid } from "@/components/sponsor-grid";
import {
  getAllProjects,
  getAllSponsors,
  getAllVenues,
  getPostsByKind,
  getPublications,
  getPublicationsByTheme,
  getResearchThemes,
} from "@/lib/content";
import { formatPostDate } from "@/lib/utils";

// The homepage is summaries only (SPEC.md §5): each block is a glimpse of one section page
// and links through to it. Everything here is computed from content at build time.

function HomeSection({
  id,
  title,
  href,
  linkLabel,
  alt = false,
  children,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
  alt?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={`border-b border-border ${alt ? "bg-bg-alt" : ""}`}>
      <div className="mx-auto max-w-[1600px] px-6 py-12 sm:px-10">
        <SummaryHeading id={`${id}-heading`} title={title} href={href} linkLabel={linkLabel} />
        {children}
      </div>
    </section>
  );
}

/** Long area names do not fit around a radar; "Electronic Design Automation" → "EDA". */
function axisLabel(title: string): string {
  if (title.length <= 18) return title;
  return title
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("");
}

const TOP_VENUES = 10;

export function ResearchSummary() {
  const themes = getResearchThemes();
  const radar = themes.map((t) => ({
    id: t.id,
    label: axisLabel(t.title),
    value: getPublicationsByTheme(t.id).length,
  }));

  const venueCounts = new Map<string, number>();
  for (const p of getPublications()) {
    if (p.venueId) venueCounts.set(p.venueId, (venueCounts.get(p.venueId) ?? 0) + 1);
  }
  const venues = getAllVenues()
    .filter((v) => venueCounts.has(v.id))
    .map((v) => ({ id: v.id, label: v.shortName, name: v.name, value: venueCounts.get(v.id)! }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_VENUES);

  return (
    <HomeSection id="research" title="Research" href="/research" linkLabel="Research & publications" alt>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <RadarChart data={radar} title="Publications per research area" />
        <VenueBars data={venues} title="Top venues" />
      </div>
    </HomeSection>
  );
}

const HOME_PROJECTS = 3;

export function ProjectsSummary() {
  const projects = [...getAllProjects()]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, HOME_PROJECTS);
  if (projects.length === 0) return null;

  return (
    <HomeSection id="projects" title="Projects" href="/projects" linkLabel="All projects">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </HomeSection>
  );
}

export function PeopleSummary() {
  return (
    <HomeSection id="people" title="People" href="/people" linkLabel="The whole group" alt>
      <PiSummary />
    </HomeSection>
  );
}

const HOME_NEWS = 4;

export function NewsSummary() {
  const posts = getPostsByKind("news").slice(0, HOME_NEWS);
  if (posts.length === 0) return null;
  return (
    <HomeSection id="news" title="Latest news" href="/news" linkLabel="All news">
      <NewsList posts={posts} />
    </HomeSection>
  );
}

const HOME_BLOG = 3;

export function BlogSummary() {
  const posts = getPostsByKind("blog").slice(0, HOME_BLOG);
  if (posts.length === 0) return null;
  return (
    <HomeSection id="blog" title="From the blog" href="/blog" linkLabel="All posts" alt>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/blog/${post.id}`} className="group flex flex-col gap-1.5">
              <span className="font-mono text-xs tracking-wide text-text-faint uppercase">
                {formatPostDate(post.date, { year: "numeric", month: "short", day: "numeric" })}
              </span>
              <span className="text-[17px] font-bold tracking-tight text-foreground group-hover:underline">
                {post.title}
              </span>
              <span className="line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{post.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}

export function SponsorsSummary() {
  return (
    <HomeSection id="sponsors" title="Sponsors" href="/sponsors" linkLabel="All sponsors">
      <SponsorGrid sponsors={getAllSponsors()} />
    </HomeSection>
  );
}
