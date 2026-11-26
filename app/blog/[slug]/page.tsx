import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExternalLink } from "@/components/external-link";
import { Markdown } from "@/components/markdown";
import {
  getPersonById,
  getPostById,
  getPostsByKind,
  getPublicationById,
} from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { readingMinutes } from "@/lib/blog";
import { formatPostDate } from "@/lib/utils";

// `output: "export"` rejects an empty generateStaticParams() and fails the whole build —
// so a lab with no blog posts yet (or one that deletes its last post) would take the
// entire site down, not just this route. Content counts are variable by definition, so
// zero has to be a supported state: fall back to a sentinel slug that no post can own
// (ids are validated as kebab-case, so leading underscores are unreachable). The
// notFound() in the page body below turns it into a 404 exactly like any other bad slug.
const NO_POSTS_SENTINEL = "__no-posts__";

// Blog posts always get a detail page; news posts never do (SPEC.md decision #2) —
// only including kind:"blog" ids here means a news slug simply has no static page to
// serve, in prod. The kind check in the page body below keeps `next dev` consistent
// with that (dev doesn't restrict routes to generateStaticParams the way the static
// export build does).
export function generateStaticParams() {
  const posts = getPostsByKind("blog");
  if (posts.length === 0) return [{ slug: NO_POSTS_SENTINEL }];
  return posts.map((post) => ({ slug: post.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostById(slug);
  if (!post || post.kind !== "blog") return {};
  return { title: post.title, description: post.summary };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostById(slug);
  if (!post || post.kind !== "blog") notFound();

  const authors = post.authorIds
    .map((id) => getPersonById(id))
    .filter((p) => p !== undefined);
  const mentionedPublications = (post.mentions?.publicationIds ?? [])
    .map((id) => getPublicationById(id))
    .filter((p) => p !== undefined);

  const longDate = formatPostDate(post.date, { year: "numeric", month: "long", day: "numeric" });

  return (
    <article className="pb-24">
      {/* ---------------- header ---------------- */}
      <header className="mx-auto max-w-[860px] px-6 pt-12 sm:px-10">
        <Link href="/blog" className="inline-flex items-center gap-2 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
          <span aria-hidden="true">←</span> All posts
        </Link>
        <h1 className="mt-8 max-w-[24ch] text-[clamp(2.2rem,4.4vw,3.8rem)] leading-[1.05] font-bold tracking-tight text-foreground">{post.title}</h1>
        <p className="mt-5 max-w-[62ch] text-[19px] leading-relaxed text-muted-foreground">{post.summary}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-border py-5">
          {authors.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="flex -space-x-2">
                {authors.map((a) => (
                  <span key={a.id} className="relative size-10 overflow-hidden rounded-full bg-muted ring-2 ring-background">
                    {publicFileExists(a.photo) && <Image src={withBasePath(a.photo!)} alt="" fill sizes="40px" className="object-cover" />}
                  </span>
                ))}
              </span>
              <span className="text-[15px] font-semibold text-foreground">{authors.map((a) => a.name).join(", ")}</span>
            </div>
          )}
          <span className="text-[15px] text-muted-foreground">
            {longDate} · {readingMinutes(post)} min read
          </span>
          {post.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <li key={t} className="rounded-full border border-border px-3 py-1 text-[13px] font-medium text-muted-foreground">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {publicFileExists(post.image) && post.image && (
        <div className="mx-auto mt-10 max-w-[860px] px-6 sm:px-10">
          {/* Shown whole, over a blurred copy of itself, like the cards on /blog. */}
          <div className="relative aspect-[16/9] overflow-hidden rounded-[24px] bg-bg-alt">
            <Image src={withBasePath(post.image)} alt="" fill sizes="780px" aria-hidden="true" className="scale-110 object-cover opacity-60 blur-2xl" />
            <Image src={withBasePath(post.image)} alt="" fill sizes="(min-width: 860px) 780px, 100vw" className="object-contain" priority />
          </div>
        </div>
      )}

      {/* ---------------- body ---------------- */}
      <div className="mx-auto max-w-[860px] px-6 pt-10 sm:px-10">
        {post.body && <Markdown className="text-[18px] leading-relaxed">{post.body}</Markdown>}
        {mentionedPublications.length > 0 && (
          <p className="mt-10 rounded-[18px] bg-bg-alt p-5 text-[15px] text-muted-foreground">
            {mentionedPublications.length === 1 ? "Related publication" : "Related publications"}:{" "}
            {mentionedPublications.map((pub, i) => (
              <span key={pub.id}>
                <Link href="/research#publications" className="font-semibold text-foreground underline-offset-2 hover:underline">
                  {pub.title}
                </Link>
                {i < mentionedPublications.length - 1 ? "; " : ""}
              </span>
            ))}
          </p>
        )}
        {post.sourceUrl && (
          <p className="mt-6">
            <ExternalLink href={post.sourceUrl} className="text-[16px] font-semibold text-foreground underline-offset-4 hover:underline">
              Original source ↗
            </ExternalLink>
          </p>
        )}
      </div>

    </article>
  );
}
