import { StatsDivided, StatsInline, StatsTiles } from "@/components/home/hero-stats";
import { getHomeData } from "@/lib/home/data";

// Three even ways to show the hero's six figures, each beside the real hero text.
export default function StatsPreview() {
  const d = getHomeData();
  const options = [
    { id: "A", name: "Divided grid", line: "A 3x2 grid split by hairlines, like a spec sheet", node: <StatsDivided stats={d.stats} /> },
    { id: "B", name: "Soft tiles", line: "Six equal rounded tiles, figures in blue", node: <StatsTiles stats={d.stats} /> },
    { id: "C", name: "Side by side", line: "Figure and label on one line, two ruled columns", node: <StatsInline stats={d.stats} /> },
  ];

  return (
    <div>
      {options.map((o) => (
        <section key={o.id} className="border-b border-border">
          <div className="sticky top-[59px] z-30 border-y border-neutral-800 bg-neutral-950 px-6 py-2 text-center font-mono text-[12px] tracking-[0.18em] text-white uppercase">
            Option {o.id} · {o.name} · {o.line}
          </div>
          <div className="mx-auto grid max-w-[1500px] items-center gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">X-Lab · UT San Antonio</p>
              <h1 className="mt-4 max-w-[18ch] text-[clamp(2.6rem,5vw,4.8rem)] leading-[1.02] font-bold tracking-tight text-foreground">
                {d.site.tagline}
              </h1>
              <p className="mt-5 max-w-[60ch] text-[18px] leading-relaxed text-muted-foreground">{d.site.description}</p>
            </div>
            {o.node}
          </div>
        </section>
      ))}
    </div>
  );
}
