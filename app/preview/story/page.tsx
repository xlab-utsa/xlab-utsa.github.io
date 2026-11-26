import Image from "next/image";
import Link from "next/link";

import { Counter, Face, More, Photo, shortDate } from "@/components/preview/parts";
import { RevealBars, ScrollProgress, StoryResearch } from "@/components/preview/story";
import { withBasePath } from "@/lib/base-path";
import { getHomeData } from "@/lib/home/data";

// 07 · Story scroll — the lab told in chapters. The research chapter is scrollytelling: each
// area takes the stage in turn while a pinned radar highlights it. Then the venues grow into
// a chart, the people, the lab in pictures, and what is new. Accent: the lab's blue.

function Chapter({ n, title, children }: { n: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="max-w-[60ch]">
      <p className="font-mono text-[11px] tracking-[0.24em] text-[var(--pv-accent)] uppercase">Chapter {n}</p>
      <h2 className="mt-3 text-[clamp(2.2rem,4.4vw,4rem)] leading-[1.02] font-bold tracking-tight text-foreground">{title}</h2>
      {children && <div className="mt-5 text-[17px] leading-relaxed text-muted-foreground">{children}</div>}
    </header>
  );
}

export default function StoryPreview() {
  const d = getHomeData();
  const themes = [...d.themes].sort((a, b) => b.count - a.count);
  const opening = d.photos.find((p) => p.id === "1a1a0027")!;
  const pictures = ["0y1a8613", "1a1a0056", "dsc01917", "1a1a0222", "cg1a9437-1", "1a1a9640"].map((id) => d.photos.find((p) => p.id === id)!);

  return (
    <div className="pv-blue">
      <ScrollProgress />

      {/* ---------------- opening ---------------- */}
      <section className="mx-auto grid min-h-[calc(100svh-59px)] max-w-[1500px] items-center gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="pv-rise">
          <p className="font-mono text-[11px] tracking-[0.24em] text-[var(--pv-accent)] uppercase">X-Lab · UT San Antonio</p>
          <h1 className="mt-5 text-[clamp(3rem,6.4vw,6rem)] leading-[0.98] font-bold tracking-[-0.03em] text-foreground">{d.site.tagline}</h1>
          <p className="mt-6 max-w-[56ch] text-[17px] leading-relaxed text-muted-foreground">{d.site.description}</p>
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            {d.stats.slice(0, 4).map((s) => (
              <div key={s.key}>
                <dd className="text-[34px] leading-none font-bold text-foreground">
                  <Counter value={s.n} />
                </dd>
                <dt className="mt-1 text-[12.5px] text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-12 font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">Scroll — the lab in five chapters ↓</p>
        </div>
        <figure className="relative aspect-[4/5] overflow-hidden rounded-[28px]">
          <Photo src={opening.src} alt={opening.caption} sizes="(min-width: 1024px) 40vw, 100vw" priority />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-6 pt-16 pb-5 text-[13px] text-white">
            {opening.caption}
          </figcaption>
        </figure>
      </section>

      {/* ---------------- chapter 1: research ---------------- */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1500px] px-6 pt-24 sm:px-10">
          <Chapter n="1" title={`${d.totals.publications} papers, seven areas`}>
            From electronic design automation to AI in the classroom. Scroll through each area; the chart follows.
          </Chapter>
          <StoryResearch themes={themes} />
        </div>
      </section>

      {/* ---------------- chapter 2: venues ---------------- */}
      <section className="border-t border-border bg-bg-alt">
        <div className="mx-auto grid max-w-[1500px] items-center gap-16 px-6 py-28 sm:px-10 lg:grid-cols-[1fr_1.2fr]">
          <Chapter n="2" title={`Published at ${d.totals.venues} venues`}>
            The design-automation flagships — ICCAD, DAC, ASP-DAC and IEEE TCAD — carry the most, alongside NeurIPS, AIED and ASHA as the
            lab&apos;s work reached machine learning and education.
          </Chapter>
          <RevealBars data={d.venues.slice(0, 10)} />
        </div>
      </section>

      {/* ---------------- chapter 3: people ---------------- */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1500px] px-6 py-28 sm:px-10">
          <Chapter n="3" title="The people" />
          <div className="mt-14 grid gap-14 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-col gap-5 sm:flex-row lg:flex-col">
              <div className="relative h-[340px] w-[270px] shrink-0 overflow-hidden rounded-[24px]">
                {d.pi.photo && <Photo src={d.pi.photo} alt={d.pi.name} sizes="270px" />}
              </div>
              <div className="max-w-[270px]">
                <p className="text-2xl font-bold tracking-tight text-foreground">{d.pi.name}</p>
                <p className="mt-1 text-[14px] leading-snug text-[var(--pv-accent)]">{d.pi.title}</p>
              </div>
            </div>
            <div>
              <p className="max-w-[64ch] text-[17px] leading-relaxed text-muted-foreground">{d.pi.longBio[0]}</p>
              <div className="mt-10 grid grid-cols-3 gap-6 sm:grid-cols-4 xl:grid-cols-8">
                {d.members.map((m) => (
                  <div key={m.id} className="flex flex-col items-center text-center">
                    <Face person={m} size={76} />
                    <span className="mt-2 text-[12.5px] leading-tight font-semibold text-foreground">{m.name}</span>
                    <span className="font-mono text-[10px] text-text-faint uppercase">{m.role}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 border-t border-border pt-6">
                <p className="font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">Where alumni went</p>
                <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
                  {d.alumni.map((a) => (
                    <li key={a.id}>
                      <span className="font-semibold text-foreground">{a.name}</span>{" "}
                      <span className="text-muted-foreground">— {a.nowAt}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <More href="/people" className="mt-8">
                Meet everyone
              </More>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- chapter 4: pictures ---------------- */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1500px] px-6 pt-28 sm:px-10">
          <Chapter n="4" title="In the lab" />
        </div>
        <div className="mx-auto mt-12 grid max-w-[1500px] grid-cols-2 gap-3 px-6 pb-28 sm:px-10 lg:grid-cols-6 lg:grid-rows-2">
          {pictures.map((p, i) => (
            <figure key={p.id} className={`group relative overflow-hidden rounded-2xl ${i === 0 ? "aspect-[4/3] lg:col-span-3 lg:row-span-2 lg:aspect-auto" : "aspect-[4/3] lg:col-span-1"} ${i === 1 ? "lg:col-span-2" : ""} ${i === 4 ? "lg:col-span-2" : ""}`}>
              <Photo src={p.src} alt={p.caption} sizes="40vw" className="transition-transform duration-700 group-hover:scale-105" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pt-10 pb-3 text-[12px] text-white">
                {p.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ---------------- chapter 5: now ---------------- */}
      <section className="border-t border-border bg-invert-bg text-invert-fg">
        <div className="mx-auto max-w-[1500px] px-6 py-28 sm:px-10">
          <p className="font-mono text-[11px] tracking-[0.24em] text-[var(--pv-accent)] uppercase">Chapter 5</p>
          <h2 className="mt-3 text-[clamp(2.2rem,4.4vw,4rem)] leading-tight font-bold tracking-tight">What&apos;s new</h2>
          <div className="mt-14 grid gap-14 lg:grid-cols-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-invert-fg/50 uppercase">News</p>
              <ul className="mt-4 space-y-5">
                {d.news.slice(0, 3).map((n) => (
                  <li key={n.id}>
                    <p className="font-mono text-[10.5px] text-invert-fg/50 uppercase">{shortDate(n.date)}</p>
                    <p className="mt-1 text-[16px] leading-snug font-semibold">{n.title}</p>
                  </li>
                ))}
              </ul>
              <Link href="/news" className="mt-5 inline-block text-[14px] font-semibold underline-offset-4 hover:underline">
                All news →
              </Link>
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-invert-fg/50 uppercase">Projects</p>
              <ul className="mt-4 space-y-4">
                {d.projects.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white">
                      {p.thumbnail && <Image src={withBasePath(p.thumbnail)} alt="" fill sizes="48px" className="object-contain p-1" />}
                    </span>
                    <span>
                      <Link href={`/projects#${p.id}`} className="text-[16px] font-semibold hover:underline">
                        {p.title}
                      </Link>
                      <span className="block line-clamp-1 text-[12.5px] text-invert-fg/60">{p.tagline}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-invert-fg/50 uppercase">From the blog</p>
              <ul className="mt-4 space-y-4">
                {d.blog.map((b) => (
                  <li key={b.id}>
                    <Link href={`/blog/${b.id}`} className="text-[16px] leading-snug font-semibold hover:underline">
                      {b.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-10 font-mono text-[11px] tracking-[0.2em] text-invert-fg/50 uppercase">Supported by</p>
              <p className="mt-2 text-[15px] font-semibold">{d.sponsors.map((s) => s.name).join(" · ")}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
