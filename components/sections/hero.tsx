import { HeroTop } from "@/components/sections/hero-top";

// Headline + stat grid. The photo banner sits directly below it (app/page.tsx).
export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="border-b border-border">
      <HeroTop />
    </section>
  );
}
