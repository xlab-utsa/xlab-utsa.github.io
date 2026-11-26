import { GalleryStrip } from "@/components/gallery-strip";
import { HomeHero } from "@/components/home/home-hero";
import { LabStory } from "@/components/home/lab-story";
import { SponsorsBand } from "@/components/home/sponsors-band";
import { getHomeData } from "@/lib/home/data";

// The home page, top to bottom: who we are (with six figures), the lab in pictures, then
// the centrepiece — the director, the research and where it is published as one scroll —
// and the sponsors. Every figure comes from content (lib/home/data.ts).
export default function Home() {
  const d = getHomeData();
  const portrait = d.photos.find((p) => p.id === "1a1a2622")?.src;

  return (
    <>
      <HomeHero tagline={d.site.tagline} description={d.site.description} stats={d.stats}>
        <GalleryStrip />
      </HomeHero>
      <LabStory
        director={{
          name: d.pi.name,
          title: d.pi.title,
          secondary: d.pi.secondary,
          photo: d.pi.photo,
          portrait,
          bio: d.pi.longBio,
          honors: d.pi.honors,
        }}
        themes={[...d.themes].sort((a, b) => b.count - a.count)}
        venues={d.venues.slice(0, 12)}
        totals={d.totals}
      />
      <SponsorsBand sponsors={d.sponsors} />
    </>
  );
}
