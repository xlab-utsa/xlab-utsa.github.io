import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PublicationEntry } from "@/components/publication-entry";
import { PublicationsTabs } from "@/components/publications-tabs";
import { ResearchSection } from "@/components/sections/research-section";
import {
  getPublications,
  getPublicationsByCategory,
  getPublicationsByTheme,
  getResearchThemes,
} from "@/lib/content";
import { PUBLICATION_CATEGORIES } from "@/lib/publications";

export const metadata: Metadata = {
  title: "Research & Publications",
};

// Research & Publications (SPEC.md §5): a summary banner on top, the full publication list
// below. The written overview and diagrams come from Utkarsh Kumar; until then the banner
// is the research-area browser plus a placeholder line.
export default function ResearchPage() {
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
    <>
      <div className="mx-auto max-w-[1600px] px-6 pt-14 sm:px-10">
        <PageHeader
          title="Research & Publications"
          meta={`${total} works across ${themes.length} research areas`}
          intro="An overview of the lab's research, with diagrams, is on its way. Meanwhile, explore each research area below, or jump to the full publication list."
        />
      </div>

      <ResearchSection />

      <div id="publications" className="mx-auto max-w-4xl scroll-mt-16 px-6 py-14 sm:px-10">
        <h2 className="border-b border-border pb-4 font-mono text-[15px] font-bold tracking-widest text-foreground uppercase">
          All publications
        </h2>
        <div className="mt-8">
          <PublicationsTabs panels={panels} themes={themes} total={total} />
        </div>
      </div>
    </>
  );
}
