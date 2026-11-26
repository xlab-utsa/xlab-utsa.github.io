import Image from "next/image";
import Link from "next/link";

import { RadarChart } from "@/components/research/radar-chart";
import { VenueBars } from "@/components/research/venue-bars";
import { Counter, Face, More, Photo, shortDate } from "@/components/preview/parts";
import { withBasePath } from "@/lib/base-path";
import { getHomeData } from "@/lib/home/data";
import { cn } from "@/lib/utils";

// 01 · Bento — the whole home page as one grid of tiles, sized by importance. Everything is
// visible in the first two screens; each tile links through to its page.

function Tile({ className, children, dark }: { className?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6",
        dark ? "border-transparent bg-invert-bg text-invert-fg" : "border-hairline bg-bg-alt",
        className
      )}
    >
      {children}
    </div>
  );
}

function Label({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={cn("font-mono text-[10.5px] font-bold tracking-[0.18em] uppercase", dark ? "text-invert-fg/60" : "text-text-faint")}>
      {children}
    </p>
  );
}

const SLIDES = ["1a1a0056", "0y1a8613", "1a1a9582", "cg1a9437-1", "1a1a0222"];

export default function BentoPreview() {
  const d = getHomeData();
  const slides = SLIDES.map((id) => d.photos.find((p) => p.id === id)!).filter(Boolean);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
      <div className="grid auto-rows-[minmax(0,auto)] grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
        {/* statement */}
        <Tile dark className="flex min-h-[420px] flex-col justify-between md:col-span-6 lg:col-span-7 lg:p-10">
          <div className="flex items-center gap-3">
            {d.site.logo && (
              <Image src={withBasePath(d.site.logo.dark)} alt="" width={40} height={40} className="size-10 dark:hidden" />
            )}
            {d.site.logo && (
              <Image src={withBasePath(d.site.logo.light)} alt="" width={40} height={40} className="hidden size-10 dark:block" />
            )}
            <Label dark>X-Lab · UT San Antonio</Label>
          </div>
          <div>
            <h1 className="max-w-[16ch] text-[clamp(2.4rem,4.6vw,4.4rem)] leading-[1.02] font-bold tracking-tight">
              {d.site.tagline}
            </h1>
            <p className="mt-5 max-w-[58ch] text-[15.5px] leading-relaxed text-invert-fg/70">{d.site.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/research" className="rounded-full bg-invert-fg px-5 py-2.5 text-[13px] font-semibold text-invert-bg">
              Our research
            </Link>
            <Link href="/people" className="rounded-full border border-invert-fg/25 px-5 py-2.5 text-[13px] font-semibold">
              Meet the lab
            </Link>
          </div>
        </Tile>

        {/* photos */}
        <Tile className="min-h-[420px] p-0 md:col-span-6 lg:col-span-5">
          <div className="absolute inset-0" style={{ ["--pv-cycle" as string]: `${slides.length * 6}s` }}>
            {slides.map((p, i) => (
              <div key={p.id} className="pv-slide absolute inset-0" style={{ animationDelay: `${i * 6 - 2}s` }}>
                <Photo src={p.src} alt={p.caption} sizes="(min-width: 1024px) 40vw, 100vw" priority={i === 0} />
                <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-6 pt-14 pb-5 text-[13px] text-white">
                  {p.caption}
                </p>
              </div>
            ))}
          </div>
          <span className="absolute top-4 right-4 rounded-full bg-black/60 px-3 py-1 font-mono text-[10.5px] text-white">
            Life in the lab
          </span>
        </Tile>

        {/* stats */}
        {d.stats.map((s, i) => (
          <Tile key={s.key} className={cn("md:col-span-2 lg:col-span-2", i === 0 && "bg-brand-soft-bg border-brand-soft-border")}>
            <p className={cn("text-[clamp(2rem,3vw,2.75rem)] leading-none font-bold tracking-tight", i === 0 ? "text-brand-strong" : "text-foreground")}>
              <Counter value={s.n} />
            </p>
            <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{s.label}</p>
          </Tile>
        ))}

        {/* PI */}
        <Tile className="flex flex-col gap-5 md:col-span-6 lg:col-span-4">
          <Label>Principal investigator</Label>
          <div className="flex items-start gap-4">
            <div className="relative h-[132px] w-[106px] shrink-0 overflow-hidden rounded-xl bg-muted">
              {d.pi.photo && <Photo src={d.pi.photo} alt={d.pi.name} sizes="120px" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{d.pi.name}</h2>
              <p className="mt-1 text-[13px] leading-snug text-brand-strong">{d.pi.title}</p>
              <ul className="mt-3 space-y-1 text-[12.5px] text-muted-foreground">
                {d.pi.honors.slice(0, 3).map((h) => (
                  <li key={h}>· {h}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-[14px] leading-relaxed text-muted-foreground">{d.pi.longBio[0]}</p>
          <More href="/people">Meet the group</More>
        </Tile>

        {/* radar */}
        <Tile className="md:col-span-3 lg:col-span-4">
          <div className="flex items-baseline justify-between">
            <Label>Research areas</Label>
            <More href="/research">{d.totals.publications} papers</More>
          </div>
          <div className="mt-2">
            <RadarChart data={d.themes.map((t) => ({ id: t.id, label: t.label, value: t.count }))} title="Publications per area" />
          </div>
        </Tile>

        {/* venues */}
        <Tile className="md:col-span-3 lg:col-span-4">
          <Label>Where we publish</Label>
          <div className="mt-5">
            <VenueBars data={d.venues.slice(0, 8)} title={`Top venues of ${d.totals.venues}`} />
          </div>
        </Tile>

        {/* people */}
        <Tile className="flex flex-col justify-between gap-6 md:col-span-6 lg:col-span-8">
          <div className="flex items-baseline justify-between">
            <Label>The group</Label>
            <More href="/people">Everyone</More>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-5">
            {d.members.map((m) => (
              <div key={m.id} className="flex w-[84px] flex-col items-center gap-2 text-center">
                <Face person={m} size={64} />
                <span className="text-[12px] leading-tight font-semibold text-foreground">{m.name}</span>
                <span className="-mt-1 font-mono text-[10px] text-text-faint uppercase">{m.role}</span>
              </div>
            ))}
          </div>
          {d.alumni.length > 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              Alumni now at {d.alumni.map((a) => a.nowAt?.split(", ").slice(1).join(", ")).filter(Boolean).join(" · ")}
            </p>
          )}
        </Tile>

        {/* news */}
        <Tile dark className="flex flex-col gap-4 md:col-span-6 lg:col-span-4">
          <div className="flex items-baseline justify-between">
            <Label dark>Latest news</Label>
            <Link href="/news" className="text-[13px] font-semibold hover:underline">
              All →
            </Link>
          </div>
          <ul className="space-y-4">
            {d.news.slice(0, 3).map((n) => (
              <li key={n.id} className="border-t border-invert-fg/15 pt-3">
                <p className="font-mono text-[10.5px] text-invert-fg/50 uppercase">{shortDate(n.date)}</p>
                <p className="mt-1 text-[14.5px] leading-snug">{n.title}</p>
              </li>
            ))}
          </ul>
        </Tile>

        {/* projects */}
        <Tile className="md:col-span-6 lg:col-span-8">
          <div className="flex items-baseline justify-between">
            <Label>Projects</Label>
            <More href="/projects">All projects</More>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {d.projects.slice(0, 3).map((p) => (
              <Link key={p.id} href={`/projects#${p.id}`} className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-hairline bg-background">
                  {p.thumbnail && (
                    <Image src={withBasePath(p.thumbnail)} alt="" fill sizes="25vw" className="object-contain p-4 transition-transform group-hover:scale-105" />
                  )}
                </div>
                <p className="mt-3 text-[15px] font-bold tracking-tight text-foreground">{p.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">{p.tagline}</p>
              </Link>
            ))}
          </div>
        </Tile>

        {/* blog + sponsors */}
        <div className="grid gap-3 md:col-span-6 lg:col-span-4">
          <Tile>
            <div className="flex items-baseline justify-between">
              <Label>From the blog</Label>
              <More href="/blog">Read</More>
            </div>
            <ul className="mt-4 space-y-3">
              {d.blog.slice(0, 2).map((b) => (
                <li key={b.id}>
                  <Link href={`/blog/${b.id}`} className="text-[14.5px] leading-snug font-semibold text-foreground hover:underline">
                    {b.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Tile>
          <Tile className="flex items-center justify-between gap-4">
            <div>
              <Label>Supported by</Label>
              <p className="mt-2 text-[14px] font-semibold text-foreground">{d.sponsors.map((s) => s.name).join(" · ")}</p>
            </div>
            <More href="/sponsors">Sponsors</More>
          </Tile>
        </div>
      </div>
    </div>
  );
}
