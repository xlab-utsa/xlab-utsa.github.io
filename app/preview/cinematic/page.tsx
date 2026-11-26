import Image from "next/image";
import Link from "next/link";

import { RadarChart } from "@/components/research/radar-chart";
import { Counter, Face, Photo, shortDate } from "@/components/preview/parts";
import { withBasePath } from "@/lib/base-path";
import { getHomeData } from "@/lib/home/data";

// 04 · Cinematic — always dark, full-bleed. A crossfading film of lab photos opens the page;
// after that, one idea per screen. The wrapper carries the `dark` class, so every shared
// component (charts included) renders in its dark-mode colours. Accent: the AI Institute's
// yellow, taken from the photos themselves.

const FILM = ["1a1a0056", "0y1a8613", "1a1a2622", "1a1a9582", "dsc01917", "1a1a0222"];
const SECONDS = 7;

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] tracking-[0.28em] text-[var(--pv-accent)] uppercase">{children}</p>;
}

export default function CinematicPreview() {
  const d = getHomeData();
  const film = FILM.map((id) => d.photos.find((p) => p.id === id)!);
  const group = d.photos.find((p) => p.id === "cg1a9437-1")!;
  const mosaic = ["0y1a0089", "1a1a0027", "cg1a9281", "1a1a0177", "0y1a8618", "1a1a0160"].map((id) => d.photos.find((p) => p.id === id)!);

  return (
    <div className="pv-amber dark bg-background text-foreground">
      {/* ---------------- the film ---------------- */}
      <section className="relative flex h-[calc(100svh-59px)] min-h-[560px] items-end overflow-hidden">
        <div className="absolute inset-0" style={{ ["--pv-cycle" as string]: `${film.length * SECONDS}s` }}>
          {film.map((p, i) => (
            <div key={p.id} className="pv-slide absolute inset-0" style={{ animationDelay: `${i * SECONDS - 2}s` }}>
              <Photo src={p.src} alt={p.caption} sizes="100vw" priority={i === 0} />
            </div>
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.9),rgba(0,0,0,0.45)_55%,rgba(0,0,0,0.2)),linear-gradient(to_right,rgba(0,0,0,0.5),transparent_60%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1600px] gap-10 px-6 pb-16 sm:px-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div className="pv-rise">
            <Kicker>X-Lab · UT San Antonio</Kicker>
            <h1 className="mt-5 max-w-[14ch] text-[clamp(3rem,7vw,6.5rem)] leading-[0.95] font-bold tracking-[-0.03em] text-white">
              {d.site.tagline}
            </h1>
            <p className="mt-6 max-w-[56ch] text-[17px] leading-relaxed text-white/75">{d.site.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/research" className="rounded-full bg-[var(--pv-accent)] px-6 py-3 text-[13.5px] font-bold text-[var(--pv-accent-ink)]">
                Explore the research
              </Link>
              <Link href="/people" className="rounded-full border border-white/30 px-6 py-3 text-[13.5px] font-semibold text-white backdrop-blur">
                Meet the lab
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-x-6 gap-y-6 border-t border-white/20 pt-6 lg:mb-2">
            {d.stats.map((s) => (
              <div key={s.key}>
                <dd className="text-[clamp(1.8rem,2.6vw,2.6rem)] leading-none font-bold text-white">
                  <Counter value={s.n} />
                </dd>
                <dt className="mt-1.5 text-[12px] leading-snug text-white/60">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------- one statement ---------------- */}
      <section className="mx-auto flex min-h-[80vh] max-w-[1200px] flex-col justify-center px-6 py-24 sm:px-12">
        <Kicker>What we do</Kicker>
        <p className="mt-6 text-[clamp(2rem,4.4vw,4.2rem)] leading-[1.08] font-bold tracking-tight">
          From <span className="text-[var(--pv-accent)]">accelerators</span> and compilers to the{" "}
          <span className="text-[var(--pv-accent)]">classroom</span>, the power grid and the factory floor —{" "}
          <span className="text-muted-foreground">scaling intelligence, and intelligence per joule.</span>
        </p>
      </section>

      {/* ---------------- research ---------------- */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-[1600px] items-center gap-16 px-6 py-24 sm:px-12 lg:grid-cols-2">
          <div>
            <Kicker>Research</Kicker>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,3.6rem)] leading-tight font-bold tracking-tight">
              {d.totals.publications} papers. Seven areas. {d.totals.venues} venues.
            </h2>
            <ul className="mt-10 divide-y divide-border border-y border-border">
              {d.venues.slice(0, 6).map((v, i) => (
                <li key={v.id} className="flex items-center gap-5 py-3.5">
                  <span className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="w-28 text-[17px] font-bold">{v.label}</span>
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-[var(--pv-accent)]" style={{ width: `${(v.value / d.venues[0].value) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-mono text-[15px]">{v.value}</span>
                </li>
              ))}
            </ul>
            <Link href="/research" className="mt-8 inline-block text-[14px] font-semibold text-[var(--pv-accent)] hover:underline">
              Every publication →
            </Link>
          </div>
          <div className="text-[var(--pv-accent)]">
            <RadarChart data={d.themes.map((t) => ({ id: t.id, label: t.label, value: t.count }))} title="Publications per research area" />
          </div>
        </div>
      </section>

      {/* ---------------- the director and the group ---------------- */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="absolute inset-0 opacity-30">
          <Photo src={group.src} alt="" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40" />
        </div>
        <div className="relative mx-auto grid max-w-[1600px] gap-14 px-6 py-24 sm:px-12 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="relative h-[420px] w-[320px] overflow-hidden rounded-2xl ring-1 ring-white/10">
            {d.pi.photo && <Photo src={d.pi.photo} alt={d.pi.name} sizes="320px" />}
          </div>
          <div>
            <Kicker>Led by</Kicker>
            <h2 className="mt-4 text-[clamp(2.4rem,4.4vw,4rem)] leading-none font-bold tracking-tight">{d.pi.name}</h2>
            <p className="mt-3 text-[16px] text-[var(--pv-accent)]">{d.pi.title}</p>
            <p className="mt-6 max-w-[62ch] text-[16px] leading-relaxed text-muted-foreground">{d.pi.longBio[0]}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <div className="flex -space-x-3">
                {d.members.map((m) => (
                  <Face key={m.id} person={m} size={52} className="ring-2 ring-background" />
                ))}
              </div>
              <Link href="/people" className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black">
                Meet all {d.members.length + 1} of us →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- work ---------------- */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1600px] px-6 py-24 sm:px-12">
          <div className="flex items-end justify-between gap-6">
            <div>
              <Kicker>Built here</Kicker>
              <h2 className="mt-4 text-[clamp(2rem,3.4vw,3rem)] font-bold tracking-tight">Open-source projects</h2>
            </div>
            <Link href="/projects" className="text-[14px] font-semibold text-[var(--pv-accent)] hover:underline">
              All projects →
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {d.projects.map((p) => (
              <Link key={p.id} href={`/projects#${p.id}`} className="group rounded-2xl border border-border bg-bg-alt p-6 transition-colors hover:border-[var(--pv-accent)]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white">
                  {p.thumbnail && <Image src={withBasePath(p.thumbnail)} alt="" fill sizes="30vw" className="object-contain p-6" />}
                </div>
                <h3 className="mt-5 text-[22px] font-bold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{p.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- mosaic ---------------- */}
      <section className="grid grid-cols-2 gap-1 md:grid-cols-3">
        {mosaic.map((p) => (
          <figure key={p.id} className="group relative aspect-[3/2] overflow-hidden">
            <Photo src={p.src} alt={p.caption} sizes="33vw" className="transition-transform duration-700 group-hover:scale-105" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-3 text-[12.5px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {p.caption}
            </figcaption>
          </figure>
        ))}
      </section>

      {/* ---------------- news + blog + sponsors ---------------- */}
      <section className="mx-auto grid max-w-[1600px] gap-16 px-6 py-24 sm:px-12 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <Kicker>News</Kicker>
          <ul className="mt-6 divide-y divide-border">
            {d.news.slice(0, 3).map((n) => (
              <li key={n.id} className="grid gap-2 py-6 sm:grid-cols-[120px_1fr]">
                <span className="font-mono text-[12px] text-muted-foreground uppercase">{shortDate(n.date)}</span>
                <span className="text-[20px] leading-snug font-semibold">{n.title}</span>
              </li>
            ))}
          </ul>
          <Link href="/news" className="text-[14px] font-semibold text-[var(--pv-accent)] hover:underline">
            All news →
          </Link>
        </div>
        <div className="space-y-12">
          <div>
            <Kicker>From the blog</Kicker>
            <ul className="mt-6 space-y-5">
              {d.blog.map((b) => (
                <li key={b.id}>
                  <Link href={`/blog/${b.id}`} className="text-[18px] leading-snug font-semibold hover:text-[var(--pv-accent)]">
                    {b.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-[13.5px] text-muted-foreground">{b.summary}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border pt-8">
            <Kicker>Supported by</Kicker>
            <p className="mt-3 text-[16px] font-semibold">{d.sponsors.map((s) => s.name).join(" · ")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
