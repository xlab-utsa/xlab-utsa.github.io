import { getPostsByKind } from "@/lib/content";
import { formatPostDate } from "@/lib/utils";

// Entire News presence on the site (SPEC.md decision #2) — recent items only, no
// archive, no route. Dense date+text list, no imagery (matches the mockup's news
// list — unlike the blog archive, which keeps images).
const NEWS_LIMIT = 4;

export function NewsSection() {
  const posts = getPostsByKind("news").slice(0, NEWS_LIMIT);
  if (posts.length === 0) return null;

  return (
    <section
      id="news"
      aria-labelledby="news-heading"
      className="scroll-mt-16 border-b border-border bg-background"
    >
      <div className="mx-auto max-w-[1600px] px-6 py-12 sm:px-10">
        <h2
          id="news-heading"
          className="mb-6 font-mono text-[15px] font-bold tracking-widest text-foreground uppercase"
        >
          Latest news
        </h2>
        <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="grid grid-cols-[84px_1fr] gap-4 border-b border-hairline py-3.5"
            >
              <span className="pt-0.5 font-mono text-xs text-text-faint">
                {formatPostDate(post.date, { year: "numeric", month: "short" })}
              </span>
              <span className="text-[15px] leading-relaxed text-foreground">
                {post.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
