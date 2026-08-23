import { HeroTeamPreview } from "@/components/sections/hero-team-preview";
import { HeroTop } from "@/components/sections/hero-top";

// One-viewport block: headline + stat grid on top (HeroTop), a live "lab, today"
// preview band on the bottom (HeroTeamPreview).
export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="border-b border-border">
      <HeroTop />
      {/* <HeroTeamPreview /> */}
    </section>
  );
}
