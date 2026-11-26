import type { Metadata } from "next";
import Image from "next/image";

import { ExternalLink } from "@/components/external-link";
import { SectionIntro } from "@/components/section-intro";
import { getPostsByKind } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { formatPostDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "News",
};

// The full news archive, newest first (SPEC.md decision #2 as amended by #10) — the original
// layout (date beside each story, its picture on the right) in the site's new style. Every
// row is the same shape: the same picture frame, the picture shown whole. Items
// have no page of their own; a source link is where "read more" goes.
export default function NewsPage() {
  const posts = getPostsByKind("news");

  return (
    <div>
      <SectionIntro title="News" meta={`${posts.length} ${posts.length === 1 ? "story" : "stories"}`} className="max-w-[1100px]" />
      <div className="mx-auto max-w-[1100px] px-6 pb-24 sm:px-10">
        {posts.length === 0 ? (
          <p className="text-[17px] text-muted-foreground">No news yet.</p>
        ) : (
          <ol className="border-t border-border">
            {posts.map((post) => {
              const img = publicFileExists(post.image);
              return (
                <li key={post.id} className="grid gap-4 border-b border-border py-8 sm:grid-cols-[150px_1fr_240px] sm:gap-8">
                  <p className="pt-1.5 font-mono text-[13px] tracking-wide text-text-faint uppercase">
                    {formatPostDate(post.date, { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                  <div>
                    <h2 className="text-[clamp(1.3rem,2vw,1.6rem)] leading-snug font-bold tracking-tight text-foreground">{post.title}</h2>
                    <p className="mt-2 text-[17px] leading-relaxed text-muted-foreground">{post.summary}</p>
                    {post.sourceUrl && (
                      <ExternalLink
                        href={post.sourceUrl}
                        className="mt-4 inline-flex items-center gap-2 text-[16px] font-semibold text-foreground underline-offset-4 hover:underline"
                      >
                        Read more <span aria-hidden="true">↗</span>
                      </ExternalLink>
                    )}
                  </div>
                  {/* Every story gets the same frame; the picture is shown whole (never cropped), and a
                      story without one gets the lab's mark instead, so all rows line up. */}
                  <div className="relative order-first aspect-[4/3] overflow-hidden rounded-[18px] border border-border bg-bg-alt sm:order-none">
                    {img ? (
                      <Image src={withBasePath(post.image!)} alt="" fill sizes="(min-width: 640px) 240px, 100vw" className="object-contain p-2" />
                    ) : (
                      <span className="flex h-full items-center justify-center font-mono text-[15px] font-bold tracking-[0.3em] text-text-faint">X-LAB</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
