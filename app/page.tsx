import { FeaturedPublicationsSection } from "@/components/sections/featured-publications-section";
import { Hero } from "@/components/sections/hero";
import { NewsSection } from "@/components/sections/news-section";
import { ResearchSection } from "@/components/sections/research-section";
import { SponsorsSection } from "@/components/sections/sponsors-section";
import { TeamSection } from "@/components/sections/team-section";

export default function Home() {
  return (
    <>
      <Hero />
      <NewsSection />
      <ResearchSection />
      <TeamSection />
      <FeaturedPublicationsSection />
      <SponsorsSection />
    </>
  );
}
