import { GalleryStrip } from "@/components/gallery-strip";
import { Hero } from "@/components/sections/hero";
import {
  BlogSummary,
  NewsSummary,
  PeopleSummary,
  ProjectsSummary,
  ResearchSummary,
  SponsorsSummary,
} from "@/components/sections/home-summaries";

// Summaries only, in nav order (SPEC.md §5); each block links to its full page. Location
// & Lab Culture has no summary yet — it gets one once its content exists.
export default function Home() {
  return (
    <>
      <Hero />
      <GalleryStrip />
      <ResearchSummary />
      <ProjectsSummary />
      <PeopleSummary />
      <NewsSummary />
      <BlogSummary />
      <SponsorsSummary />
    </>
  );
}
