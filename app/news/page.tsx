import type { Metadata } from "next";

import { NewsList } from "@/components/news-list";
import { PageHeader } from "@/components/page-header";
import { getPostsByKind } from "@/lib/content";

export const metadata: Metadata = {
  title: "News",
};

// The full news archive, newest first (SPEC.md decision #2 as amended by #10). Items have
// no page of their own; a source link is where "read more" goes.
export default function NewsPage() {
  const posts = getPostsByKind("news");
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 sm:px-10">
      <PageHeader title="News" meta={`${posts.length} ${posts.length === 1 ? "item" : "items"}`} />
      <div className="mt-4">
        <NewsList posts={posts} variant="full" />
      </div>
    </div>
  );
}
