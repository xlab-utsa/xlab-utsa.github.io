import type { Metadata } from "next";

import { AreaBrowser } from "@/components/research/area-browser";
import { Library } from "@/components/research/library";
import { getResearchData } from "@/lib/research/data";

export const metadata: Metadata = {
  title: "Research & Publications",
};

// Research & Publications (SPEC.md §5), "Side tabs" design (chosen from /preview/research):
//   * a header with the headline figures;
//   * the research areas as a vertical tab list beside one area's panel — title, summary
//     line, description and featured cards — sized to one screen on large displays
//     (components/research/area-browser.tsx picks the card grid that fits);
//   * every publication (#publications), with search, area chips, type tabs and an
//     award filter (components/research/library.tsx). The area filter lives in the URL
//     (?theme=<id>), so the home page can deep-link into one area.
// The written overview and diagrams come from Utkarsh Kumar; until then the intro says so.
export default function ResearchPage() {
  const d = getResearchData();

  return (
    <div>
      {/* ---------------- header ---------------- */}
      <header className="mx-auto grid max-w-[1600px] gap-8 px-6 pt-14 pb-12 sm:px-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <h1 className="text-[clamp(2.4rem,4.4vw,3.8rem)] leading-[1.04] font-bold tracking-tight text-foreground">Research &amp; Publications</h1>
          <p className="mt-4 max-w-[64ch] text-[18px] leading-relaxed text-muted-foreground">
            An overview of the lab&apos;s research, with diagrams, is on its way. Meanwhile, explore each research area below, or jump to the
            full publication list.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6">
          {[
            [d.totals.publications, "works"],
            [d.themes.length, "research areas"],
            [d.totals.awarded, "award-winning"],
          ].map(([v, l]) => (
            <div key={l} className="border-l-2 border-brand pl-4">
              <dd className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-none font-bold text-foreground">{v}</dd>
              <dt className="mt-1.5 text-[14px] text-muted-foreground">{l}</dt>
            </div>
          ))}
        </dl>
      </header>

      {/* ---------------- research areas: one screen on large displays ---------------- */}
      <section id="research" aria-labelledby="areas-heading" className="scroll-mt-[59px] border-y border-border bg-bg-alt">
        <div className="mx-auto max-w-[1600px] px-6 py-10 sm:px-10 lg:h-[calc(100svh-59px)] lg:max-h-[1000px] lg:min-h-[640px] lg:py-8">
          <AreaBrowser themes={d.themes} orientation="side" heading={{ id: "areas-heading", title: "Research areas", total: d.totals.publications }} />
        </div>
      </section>

      {/* ---------------- all publications ---------------- */}
      <section id="publications" aria-labelledby="pubs-heading" className="mx-auto max-w-[1100px] scroll-mt-[59px] px-6 py-16 sm:px-10">
        <h2 id="pubs-heading" className="mb-8 text-[clamp(1.6rem,2.4vw,2.1rem)] font-bold tracking-tight text-foreground">
          All publications
        </h2>
        <Library pubs={d.pubs} themes={d.themes} categories={d.categories} layout="list" typeTabs />
      </section>
    </div>
  );
}
