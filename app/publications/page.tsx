import type { Metadata } from "next";

import { PublicationEntry } from "@/components/publication-entry";
import { PublicationsTabs } from "@/components/publications-tabs";
import { getPublicationsByCategory } from "@/lib/content";
import { PUBLICATION_CATEGORIES } from "@/lib/publications";

export const metadata: Metadata = {
  title: "Publications",
};

export default function PublicationsPage() {
  const panels = PUBLICATION_CATEGORIES.map(({ key, label }) => {
    const publications = getPublicationsByCategory(key);
    return {
      key,
      label: `${label} (${publications.length})`,
      content: (
        <ol>
          {publications.map((pub) => (
            <PublicationEntry key={pub.id} publication={pub} />
          ))}
        </ol>
      ),
    };
  });

  const total = PUBLICATION_CATEGORIES.reduce(
    (sum, { key }) => sum + getPublicationsByCategory(key).length,
    0
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-14 sm:px-10">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Publications
        </h1>
        <p className="mt-2 font-mono text-[13px] text-text-faint">
          {total} works across {PUBLICATION_CATEGORIES.length} categories
        </p>
      </div>
      <div className="mt-8">
        <PublicationsTabs panels={panels} />
      </div>
    </div>
  );
}
