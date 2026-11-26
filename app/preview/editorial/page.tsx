import Image from "next/image";
import Link from "next/link";

import { RadarChart } from "@/components/research/radar-chart";
import { Photo, shortDate } from "@/components/preview/parts";
import { withBasePath } from "@/lib/base-path";
import { getHomeData } from "@/lib/home/data";

// 03 · Editorial — the home page as the front page of a research journal: masthead, a lead
// story, a letter from the director, numbered figures, and the lab's own masthead of people.
// Serif display type (Instrument Serif) over the site's sans; warm paper in light mode.

function Rule({ double }: { double?: boolean }) {
  return double ? (
    <div aria-hidden="true" className="space-y-[3px]">
      <div className="h-px bg-[var(--pv-ink)]" />
      <div className="h-px bg-[var(--pv-ink)]" />
    </div>
  ) : (
    <div aria-hidden="true" className="h-px bg-[var(--pv-rule)]" />
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10.5px] tracking-[0.22em] uppercase opacity-60">{children}</p>;
}

function Figure({ n, caption, children }: { n: number; caption: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col">
      <div className="flex-1">{children}</div>
      <figcaption className="mt-4 border-t border-[var(--pv-rule)] pt-3 text-[13.5px] leading-snug">
        <span className="font-display text-[16px] italic">Fig. {n} — </span>
        <span className="opacity-75">{caption}</span>
      </figcaption>
    </figure>
  );
}

function YearBars({ years }: { years: { year: number; value: number }[] }) {
  const max = Math.max(...years.map((y) => y.value));
  const W = 560;
  const H = 220;
  const bw = W / years.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`Publications per year: ${years.map((y) => `${y.year} ${y.value}`).join(", ")}`} className="h-auto w-full">
      {years.map((y, i) => {
        const h = (y.value / max) * H;
        return (
          <g key={y.year}>
            <rect x={i * bw + 2} y={H - h} width={bw - 4} height={h} rx={2} className="fill-[var(--pv-ink)]">
              <title>{`${y.year}: ${y.value} publications`}</title>
            </rect>
            {(i === 0 || (i === years.length - 1 && y.year % 5 > 1) || y.year % 5 === 0) && (
              <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" className="fill-[var(--pv-ink)] font-mono text-[11px] opacity-60">
                {y.year}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function EditorialPreview() {
  const d = getHomeData();
  const lead = d.photos.find((p) => p.id === "1a1a0056")!;
  const second = d.photos.find((p) => p.id === "cg1a9437-1")!;
  const latest = d.news[0];
  const peak = d.years.reduce((a, b) => (b.value > a.value ? b : a));
  const dateline = latest ? new Date(`${latest.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const phd = d.members.filter((m) => m.role === "PhD");
  const postdocs = d.members.filter((m) => m.role !== "PhD");

  return (
    <div className="pv-paper">
      <div className="mx-auto max-w-[1320px] px-6 pt-10 pb-16 sm:px-10">
        {/* ---------------- masthead ---------------- */}
        <header className="text-center">
          <Rule double />
          <div className="flex items-center justify-between py-2 font-mono text-[10.5px] tracking-[0.2em] uppercase opacity-70">
            <span>UT San Antonio</span>
            <span className="hidden sm:inline">College of AI, Cyber and Computing</span>
            <span>{dateline}</span>
          </div>
          <Rule />
          <h1 className="font-display py-4 text-[clamp(4.5rem,13vw,11rem)] leading-[0.85] tracking-[-0.03em]">The X-Lab</h1>
          <Rule />
          <p className="font-display py-2 text-[clamp(1.1rem,1.8vw,1.45rem)] italic">{d.site.tagline}</p>
          <Rule double />
        </header>

        {/* ---------------- lead story + briefs ---------------- */}
        <section className="mt-10 grid gap-10 lg:grid-cols-12">
          <article className="lg:col-span-8">
            <figure>
              <div className="relative aspect-[16/9] overflow-hidden">
                <Photo src={lead.src} alt={lead.caption} sizes="(min-width: 1024px) 66vw, 100vw" priority />
              </div>
              <figcaption className="mt-2 text-[12.5px] italic opacity-70">{lead.caption}.</figcaption>
            </figure>
            <h2 className="font-display mt-6 text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.02]">
              Scaling intelligence — and intelligence per joule.
            </h2>
            <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed opacity-85">{d.site.description}</p>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] tracking-[0.16em] uppercase">
              <Link href="/research" className="underline underline-offset-4">Research &amp; publications</Link>
              <Link href="/projects" className="underline underline-offset-4">Projects</Link>
              <Link href="/people" className="underline underline-offset-4">People</Link>
            </div>
          </article>

          <aside className="lg:col-span-4 lg:border-l lg:border-[var(--pv-rule)] lg:pl-10">
            <Kicker>In brief</Kicker>
            <ul className="mt-4 divide-y divide-[var(--pv-rule)]">
              {d.news.slice(0, 3).map((n) => (
                <li key={n.id} className="py-4 first:pt-0">
                  <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase opacity-60">{shortDate(n.date)}</p>
                  <h3 className="font-display mt-1 text-[22px] leading-tight">{n.title}</h3>
                  <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-snug opacity-75">{n.summary}</p>
                </li>
              ))}
            </ul>
            <Link href="/news" className="mt-2 inline-block font-mono text-[11px] tracking-[0.16em] uppercase underline underline-offset-4">
              All news
            </Link>

            <div className="mt-8 border-t border-[var(--pv-rule)] pt-6">
              <Kicker>By the numbers</Kicker>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
                {d.stats.map((s) => (
                  <div key={s.key}>
                    <dd className="font-display text-[40px] leading-none">{s.n}</dd>
                    <dt className="mt-1 text-[12px] leading-snug opacity-70">{s.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </section>

        {/* ---------------- letter from the director ---------------- */}
        <section className="mt-16">
          <Rule double />
          <div className="grid gap-10 pt-10 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <Kicker>From the director</Kicker>
              <div className="relative mt-5 aspect-[4/5] w-full max-w-[260px] overflow-hidden grayscale">
                {d.pi.photo && <Photo src={d.pi.photo} alt={d.pi.name} sizes="260px" />}
              </div>
              <p className="font-display mt-4 text-[26px] leading-none">{d.pi.name}</p>
              <p className="mt-1 text-[13px] leading-snug opacity-70">{d.pi.title}</p>
            </div>
            <div className="lg:col-span-9">
              <h2 className="font-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.05]">
                Building functional AI systems that are meaningful to society.
              </h2>
              <div className="mt-6 gap-10 text-[15.5px] leading-[1.7] opacity-90 md:columns-2">
                {d.pi.longBio.map((p, i) => (
                  <p key={p.slice(0, 20)} className={i === 0 ? "pv-dropcap mb-4" : "mb-4"}>
                    {p}
                  </p>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-[13px] opacity-75">
                {d.pi.honors.slice(0, 4).map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- figures ---------------- */}
        <section className="mt-16">
          <Rule double />
          <div className="flex items-baseline justify-between pt-6">
            <Kicker>Research, in figures</Kicker>
            <Link href="/research" className="font-mono text-[11px] tracking-[0.16em] uppercase underline underline-offset-4">
              All {d.totals.publications} works
            </Link>
          </div>
          <div className="mt-8 grid gap-12 lg:grid-cols-3">
            <Figure n={1} caption={`Publications by research area, all years (n = ${d.totals.publications}). A paper can belong to more than one area.`}>
              <RadarChart data={d.themes.map((t) => ({ id: t.id, label: t.label, value: t.count }))} title="" />
            </Figure>
            <Figure n={2} caption={`The ten venues we publish in most, of ${d.totals.venues} in all.`}>
              <table className="w-full text-[14px]">
                <tbody>
                  {d.venues.slice(0, 10).map((v, i) => (
                    <tr key={v.id} className="border-b border-[var(--pv-rule)]">
                      <td className="w-7 py-1.5 font-mono text-[11px] opacity-50">{i + 1}</td>
                      <td className="py-1.5 font-semibold">{v.label}</td>
                      <td className="font-display py-1.5 text-right text-[20px]">{v.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Figure>
            <Figure n={3} caption={`Publications per year, ${d.years[0].year}–${d.years[d.years.length - 1].year}; the busiest year was ${peak.year}, with ${peak.value}.`}>
              <YearBars years={d.years} />
            </Figure>
          </div>
        </section>

        {/* ---------------- features + masthead ---------------- */}
        <section className="mt-16">
          <Rule double />
          <div className="grid gap-12 pt-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Kicker>Features · Projects</Kicker>
              <div className="mt-6 grid gap-8 sm:grid-cols-3">
                {d.projects.map((p) => (
                  <Link key={p.id} href={`/projects#${p.id}`} className="group">
                    <div className="relative aspect-square overflow-hidden border border-[var(--pv-rule)] bg-white dark:bg-neutral-900">
                      {p.thumbnail && <Image src={withBasePath(p.thumbnail)} alt="" fill sizes="25vw" className="object-contain p-5" />}
                    </div>
                    <h3 className="font-display mt-3 text-[26px] leading-none group-hover:underline">{p.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-snug opacity-75">{p.tagline}</p>
                  </Link>
                ))}
              </div>
              <div className="relative mt-10 aspect-[21/9] overflow-hidden">
                <Photo src={second.src} alt={second.caption} sizes="66vw" />
              </div>
              <p className="mt-2 text-[12.5px] italic opacity-70">{second.caption}.</p>
            </div>

            <aside className="border-[var(--pv-rule)] lg:col-span-4 lg:border-l lg:pl-10">
              <Kicker>Masthead</Kicker>
              <dl className="mt-5 space-y-5 text-[14px]">
                <div>
                  <dt className="font-mono text-[10.5px] tracking-[0.18em] uppercase opacity-60">Director</dt>
                  <dd className="font-display mt-1 text-[21px]">{d.pi.name}</dd>
                </div>
                {postdocs.length > 0 && (
                  <div>
                    <dt className="font-mono text-[10.5px] tracking-[0.18em] uppercase opacity-60">Postdoctoral researchers</dt>
                    <dd className="mt-1 leading-relaxed">{postdocs.map((m) => m.name).join(", ")}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-mono text-[10.5px] tracking-[0.18em] uppercase opacity-60">Doctoral students</dt>
                  <dd className="mt-1 leading-relaxed">{phd.map((m) => m.name).join(", ")}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] tracking-[0.18em] uppercase opacity-60">Alumni</dt>
                  <dd className="mt-1 space-y-1 leading-snug">
                    {d.alumni.map((a) => (
                      <p key={a.id}>
                        {a.name} <span className="italic opacity-70">— {a.nowAt}</span>
                      </p>
                    ))}
                  </dd>
                </div>
              </dl>
              <Link href="/people" className="mt-6 inline-block font-mono text-[11px] tracking-[0.16em] uppercase underline underline-offset-4">
                The full group
              </Link>

              <div className="mt-10 border-t border-[var(--pv-rule)] pt-6">
                <Kicker>Essays</Kicker>
                <ul className="mt-3 space-y-3">
                  {d.blog.map((b) => (
                    <li key={b.id}>
                      <Link href={`/blog/${b.id}`} className="font-display text-[20px] leading-tight hover:underline">
                        {b.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>

        <footer className="mt-16">
          <Rule double />
          <p className="pt-4 text-center text-[13px] opacity-70">
            With support from {d.sponsors.map((s) => s.name).join(", ")} ·{" "}
            <Link href="/sponsors" className="underline underline-offset-4">Sponsors</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
