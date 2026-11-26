import { StatsTiles, type Stat } from "@/components/home/hero-stats";

// The opening of the home page: who we are on the left, the lab's figures beside it as six
// equal tiles (components/home/hero-stats.tsx; other layouts are compared at
// /preview/stats), and the photo banner (`children`) takes the rest. Together they fill the
// first screen, capped at 900px so a very tall screen doesn't open a gap between text and photos.
// Every figure is computed from content (lib/home/data.ts).
export function HomeHero({
  tagline,
  description,
  stats,
  children,
}: {
  tagline: string;
  description: string;
  stats: Stat[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:min-h-[min(calc(100svh-59px),900px)]">
      <section
        aria-labelledby="hero-heading"
        className="mx-auto grid w-full max-w-[1500px] items-center gap-10 px-6 pt-14 pb-8 sm:px-10 lg:grid-cols-[1.25fr_1fr] lg:pt-20 lg:pb-6"
      >
        <div>
          <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">X-Lab · UT San Antonio</p>
          <h1
            id="hero-heading"
            className="mt-4 max-w-[18ch] text-[clamp(2.6rem,5vw,4.8rem)] leading-[1.02] font-bold tracking-tight text-foreground"
          >
            {tagline}
          </h1>
          <p className="mt-5 max-w-[60ch] text-[18px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <StatsTiles stats={stats} />
      </section>
      {children && <div className="flex flex-1 items-center pb-8">{children}</div>}
    </div>
  );
}
