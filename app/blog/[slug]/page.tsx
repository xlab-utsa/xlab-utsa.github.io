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

  const author = post.authorId ? getPersonById(post.authorId) : undefined;
  const relatedPublication = post.relatedPublicationId
    ? getPublicationById(post.relatedPublicationId)
    : undefined;

  return (
    <article className="mx-auto max-w-3xl px-6 py-14 sm:px-10">
      <Link
        href="/blog"
        className="font-mono text-[13px] text-muted-foreground hover:text-foreground"
      >
        ← Back to Blog
      </Link>
      <p className="mt-6 font-mono text-xs tracking-wide text-text-faint uppercase">
        {formatPostDate(post.date, { year: "numeric", month: "long", day: "numeric" })}
        {author && ` · by ${author.name}`}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
        {post.title}
      </h1>
      {publicFileExists(post.image) && post.image && (
        <div className="relative mt-6 aspect-video w-full overflow-hidden border border-border bg-muted">
          <Image
            src={withBasePath(post.image!)}
            alt={post.title}
            fill
            sizes="768px"
            className="object-cover"
          />
        </div>
      )}
      {post.body && <Markdown className="mt-8">{post.body}</Markdown>}
      {relatedPublication && (
        <p className="mt-8 text-sm text-muted-foreground">
          Related publication:{" "}
          <Link href="/publications" className="underline-offset-2 hover:underline">
            {relatedPublication.title}
          </Link>
        </p>
      )}
      {post.sourceUrl && (
        <p className="mt-4 text-sm">
          <ExternalLink href={post.sourceUrl} className="text-primary hover:underline">
            Original source →
          </ExternalLink>
        </p>
      )}
    </article>
  );
}
