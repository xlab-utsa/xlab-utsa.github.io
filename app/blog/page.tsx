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

// The blog as a grid of equal cards: cover picture, date and reading time, title, summary,
// author. Every cover sits in the same 16:10 frame and is shown whole — over a blurred copy
// of itself, so pictures of any shape fill the frame without being cropped. Each post has
// its own page (/blog/<id>).
export default function BlogPage() {
  const posts = getPostsByKind("blog");

  return (
    <div>
      <SectionIntro
        title="Blog"
        meta={`${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
        intro="Articles by lab members on their field and where it is heading."
        className="max-w-[1100px]"
      />
      <div className="mx-auto max-w-[1100px] px-6 pb-24 sm:px-10">
        {posts.length === 0 ? (
          <p className="text-[17px] text-muted-foreground">No posts yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const authors = post.authorIds.map((id) => getPersonById(id)).filter((p) => p !== undefined);
              const img = publicFileExists(post.image);
              return (
                <li key={post.id}>
                  <Link
                    href={`/blog/${post.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-border bg-background transition-shadow hover:shadow-lg"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-bg-alt">
                      {img ? (
                        <>
                          <Image src={withBasePath(post.image!)} alt="" fill sizes="350px" aria-hidden="true" className="scale-110 object-cover opacity-60 blur-xl" />
                          <Image
                            src={withBasePath(post.image!)}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 350px, (min-width: 640px) 50vw, 100vw"
                            className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </>
                      ) : (
                        <span className="flex h-full items-center justify-center font-mono text-[15px] font-bold tracking-[0.3em] text-text-faint">X-LAB</span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <p className="font-mono text-[12.5px] tracking-wide text-text-faint uppercase">
                        {formatPostDate(post.date, { year: "numeric", month: "short", day: "numeric" })} · {readingMinutes(post)} min read
                      </p>
                      <h2 className="text-[20px] leading-snug font-bold tracking-tight text-foreground group-hover:underline">{post.title}</h2>
                      <p className="line-clamp-3 text-[15.5px] leading-relaxed text-muted-foreground">{post.summary}</p>
                      {authors.length > 0 && (
                        <p className="mt-auto flex items-center gap-2.5 border-t border-border pt-4 text-[14.5px] font-semibold text-foreground">
                          <span className="flex -space-x-2">
                            {authors.map((a) => (
                              <span key={a.id} className="relative size-7 overflow-hidden rounded-full bg-muted ring-2 ring-background">
                                {publicFileExists(a.photo) && <Image src={withBasePath(a.photo!)} alt="" fill sizes="28px" className="object-cover" />}
                              </span>
                            ))}
                          </span>
                          {authors.map((a) => a.name).join(", ")}
                        </p>
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
