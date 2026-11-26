import { AnimatedCounter } from "@/components/animated-counter";

// The opening of the home page: who we are on the left, six figures centred beside it (each
// on a blue rule), and the photo banner (`children`) at the foot. Together they fill the first
// screen — capped at 900px so a very tall screen doesn't open a gap between text and photos.
// Every figure is computed from content (lib/home/data.ts).
export function HomeHero({
  tagline,
  description,
  stats,
  children,
}: {
  tagline: string;
  description: string;
  stats: { key: string; n: number; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:min-h-[min(calc(100svh-59px),900px)]">
      <section
        aria-labelledby="hero-heading"
        className="mx-auto grid w-full max-w-[1500px] flex-1 items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1.25fr_1fr] lg:py-10"
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
        <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.key} className="border-l-2 border-brand pl-4">
              <dd className="text-[clamp(1.9rem,2.6vw,2.6rem)] leading-none font-bold text-foreground">
                <AnimatedCounter value={s.n} />
              </dd>
              <dt className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>
      {children && <div className="pb-8">{children}</div>}
    </div>
  );
}
