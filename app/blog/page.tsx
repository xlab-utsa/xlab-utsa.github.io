import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getPostsByKind } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { formatPostDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
};

export default function BlogPage() {
  const posts = getPostsByKind("blog");

  return (
    <div className="mx-auto max-w-4xl px-6 py-14 sm:px-10">
      <h1 className="border-b border-border pb-6 text-4xl font-bold tracking-tight text-foreground">
        Blog
      </h1>
      {posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="mt-10 space-y-10">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.id}`}
                className="group flex flex-col gap-4 sm:flex-row sm:items-start"
              >
                {publicFileExists(post.image) && post.image && (
                  <div className="relative h-40 w-full shrink-0 overflow-hidden border border-border bg-muted sm:w-56">
                    <Image
                      src={withBasePath(post.image!)}
                      alt={post.title}
                      fill
                      sizes="224px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <p className="font-mono text-xs tracking-wide text-text-faint uppercase">
                    {formatPostDate(post.date, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <h2 className="text-xl font-bold tracking-tight text-foreground group-hover:underline">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground">{post.summary}</p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border border-border px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-muted-foreground uppercase"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
