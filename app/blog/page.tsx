import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SectionIntro } from "@/components/section-intro";
import { readingMinutes } from "@/lib/blog";
import { getPersonById, getPostsByKind } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { formatPostDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
};

// The blog — the original layout (picture left, the post's date, title, summary and tags
// right) in the site's new style, with the author and reading time added. Each post has its
// own page (/blog/<id>).
export default function BlogPage() {
  const posts = getPostsByKind("blog");

  return (
    <div>
      <SectionIntro title="Blog" meta={`${posts.length} ${posts.length === 1 ? "post" : "posts"}`} className="max-w-[1100px]" />
      <div className="mx-auto max-w-[1100px] px-6 pb-24 sm:px-10">
        {posts.length === 0 ? (
          <p className="text-[17px] text-muted-foreground">No posts yet.</p>
        ) : (
          <ul className="border-t border-border">
            {posts.map((post) => {
              const authors = post.authorIds.map((id) => getPersonById(id)).filter((p) => p !== undefined);
              return (
                <li key={post.id} className="border-b border-border py-8">
                  <Link href={`/blog/${post.id}`} className="group flex flex-col gap-6 sm:flex-row sm:items-start">
                    {/* The same frame for every post; the picture is shown whole, never cropped. */}
                    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[18px] border border-border bg-bg-alt sm:w-72">
                      {publicFileExists(post.image) ? (
                        <Image src={withBasePath(post.image!)} alt="" fill sizes="(min-width: 640px) 288px, 100vw" className="object-contain p-2" />
                      ) : (
                        <span className="flex h-full items-center justify-center font-mono text-[15px] font-bold tracking-[0.3em] text-text-faint">X-LAB</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-3">
                      <p className="font-mono text-[13px] tracking-wide text-text-faint uppercase">
                        {formatPostDate(post.date, { year: "numeric", month: "long", day: "numeric" })} · {readingMinutes(post)} min read
                      </p>
                      <h2 className="text-[clamp(1.4rem,2.2vw,1.85rem)] leading-snug font-bold tracking-tight text-foreground group-hover:underline">
                        {post.title}
                      </h2>
                      <p className="text-[17px] leading-relaxed text-muted-foreground">{post.summary}</p>
                      {authors.length > 0 && (
                        <p className="flex items-center gap-3 text-[15px] font-semibold text-foreground">
                          <span className="flex -space-x-2">
                            {authors.map((a) => (
                              <span key={a.id} className="relative size-8 overflow-hidden rounded-full bg-muted ring-2 ring-background">
                                {publicFileExists(a.photo) && <Image src={withBasePath(a.photo!)} alt="" fill sizes="32px" className="object-cover" />}
                              </span>
                            ))}
                          </span>
                          {authors.map((a) => a.name).join(", ")}
                        </p>
                      )}
                      {post.tags.length > 0 && (
                        <ul className="flex flex-wrap gap-2 pt-1">
                          {post.tags.map((tag) => (
                            <li key={tag} className="rounded-full border border-border px-3 py-1 text-[13px] font-medium text-muted-foreground">
                              {tag}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
