import type { Metadata } from "next";

import { PublicationEntry } from "@/components/publication-entry";
import { PublicationsTabs } from "@/components/publications-tabs";
import {
  getPublications,
  getPublicationsByCategory,
  getPublicationsByTheme,
  getResearchThemes,
} from "@/lib/content";
import { PUBLICATION_CATEGORIES } from "@/lib/publications";

export const metadata: Metadata = {
  title: "Publications",
};

export default function PublicationsPage() {
  const panels = PUBLICATION_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    items: getPublicationsByCategory(key).map((pub) => ({
      id: pub.id,
      themeIds: pub.themeIds,
      node: <PublicationEntry key={pub.id} publication={pub} />,
    })),
  }));

  const themes = getResearchThemes().map((theme) => ({
    id: theme.id,
    title: theme.title,
    count: getPublicationsByTheme(theme.id).length,
  }));

  const total = getPublications().length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-14 sm:px-10">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Publications
        </h1>
        <p className="mt-2 font-mono text-[13px] text-text-faint">
          {total} works across {themes.length} research areas
        </p>
      </div>
      <div className="mt-8">
        <PublicationsTabs panels={panels} themes={themes} total={total} />
      </div>
    </div>
  );
}
