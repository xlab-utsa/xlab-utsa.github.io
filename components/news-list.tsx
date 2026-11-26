import Image from "next/image";

import { ExternalLink } from "@/components/external-link";
import type { Post } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { formatPostDate } from "@/lib/utils";

// One news list, used twice: the homepage's recent strip (compact) and the /news archive
// (with summaries). News items never get a page of their own (SPEC.md §6) — a source link,
// when there is one, is where "read more" goes.
export function NewsList({
  posts,
  variant = "compact",
}: {
  posts: Post[];
  variant?: "compact" | "full";
}) {
  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">No news yet.</p>;
  }

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
        {posts.map((post) => (
          <div
            key={post.id}
            className="grid grid-cols-[84px_1fr] gap-4 border-b border-hairline py-3.5"
          >
            <span className="pt-0.5 font-mono text-xs text-text-faint">
              {formatPostDate(post.date, { year: "numeric", month: "short" })}
            </span>
            <span className="text-[15px] leading-relaxed text-foreground">{post.title}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-hairline">
      {posts.map((post) => (
        <li
          key={post.id}
          className={`grid gap-2 py-6 sm:gap-6 ${publicFileExists(post.image) ? "sm:grid-cols-[120px_1fr_200px]" : "sm:grid-cols-[120px_1fr]"}`}
        >
          <span className="pt-1 font-mono text-xs tracking-wide text-text-faint uppercase">
            {formatPostDate(post.date, { year: "numeric", month: "short", day: "numeric" })}
          </span>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground">{post.title}</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{post.summary}</p>
            {post.sourceUrl && (
              <ExternalLink
                href={post.sourceUrl}
                className="inline-block text-[13.5px] font-semibold text-foreground hover:underline"
              >
                Read more →
              </ExternalLink>
            )}
          </div>
          {publicFileExists(post.image) && (
            <div className="relative order-first aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted sm:order-none">
              <Image src={withBasePath(post.image!)} alt="" fill sizes="(min-width: 640px) 200px, 100vw" className="object-cover" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
