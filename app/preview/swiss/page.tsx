import Image from "next/image";
import Link from "next/link";

import { RadarChart } from "@/components/research/radar-chart";
import { Counter, Face, Photo, shortDate } from "@/components/preview/parts";
import { withBasePath } from "@/lib/base-path";
import { getHomeData } from "@/lib/home/data";

// 06 · Swiss index — International Typographic Style: a strict 12-column grid, hairline rules,
// flush-left type, generous white space. The home page is an index of the site: seven
// numbered rows that mirror the menu, each with one dense line and one figure.

function Row({
  n,
  name,
  href,
  line,
  children,
}: {
  n: string;
  name: string;
  href: string;
  line: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-12 gap-x-6 gap-y-6 border-t border-foreground py-10">
      <div className="col-span-12 md:col-span-3">
        <Link href={href} className="group block">
          <span className="font-display block text-[64px] leading-[0.8] text-foreground">{n}</span>
          <span className="mt-3 block text-[15px] font-bold tracking-tight text-foreground group-hover:underline">{name} →</span>
        </Link>
      </div>
      <p className="col-span-12 max-w-[42ch] text-[clamp(1.15rem,1.6vw,1.45rem)] leading-snug font-medium text-foreground md:col-span-4">{line}</p>
      <div className="col-span-12 md:col-span-5">{children}</div>
    </section>
  );
}

export default function SwissPreview() {
  const d = getHomeData();
  const location = d.photos.find((p) => p.id === "1a1a9582")!;
  const top = d.venues.slice(0, 5).map((v) => v.label).join(", ");

  return (
    <div className="mx-auto max-w-[1500px] px-6 pt-12 pb-10 sm:px-10">
      {/* ---------------- title block ---------------- */}
      <header className="grid grid-cols-12 gap-x-6 gap-y-8 pb-12">
        <h1 className="col-span-12 text-[clamp(5rem,16vw,15rem)] leading-[0.78] font-bold tracking-[-0.06em] text-foreground lg:col-span-8">
          X-Lab
        </h1>
        <div className="col-span-12 flex flex-col justify-end gap-4 lg:col-span-4">
          <p className="text-[clamp(1.3rem,1.9vw,1.7rem)] leading-tight font-bold tracking-tight text-foreground">{d.site.tagline}</p>
          <p className="text-[14.5px] leading-relaxed text-muted-foreground">{d.site.description}</p>
          <p className="font-mono text-[11px] tracking-[0.18em] text-text-faint uppercase">
            UT San Antonio · College of AI, Cyber and Computing
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 border-t border-foreground sm:grid-cols-3 lg:grid-cols-6">
        {d.stats.map((s) => (
          <div key={s.key} className="border-b border-hairline py-5 pr-4 lg:border-b-0">
            <dd className="text-[clamp(2.2rem,3.4vw,3.2rem)] leading-none font-bold tracking-tight text-foreground">
              <Counter value={s.n} />
            </dd>
            <dt className="mt-2 font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">{s.label}</dt>
          </div>
        ))}
      </dl>

      {/* ---------------- the index ---------------- */}
      <div className="mt-10">
        <Row
          n="01"
          name="Research & Publications"
          href="/research"
          line={
            <>
              {d.totals.publications} works in seven areas, led by AI algorithms and electronic design automation, published most often at {top}.
            </>
          }
        >
          <RadarChart data={d.themes.map((t) => ({ id: t.id, label: t.label, value: t.count }))} title="Publications per research area" />
        </Row>

        <Row n="02" name="Projects" href="/projects" line={<>Open-source systems for evaluating, modelling and accelerating AI — {d.projects.map((p) => p.title).join(", ")}.</>}>
          <div className="grid grid-cols-3 gap-4">
            {d.projects.map((p) => (
              <Link key={p.id} href={`/projects#${p.id}`} className="group">
                <div className="relative aspect-square border border-hairline bg-white">
                  {p.thumbnail && <Image src={withBasePath(p.thumbnail)} alt="" fill sizes="15vw" className="object-contain p-3" />}
                </div>
                <p className="mt-2 text-[13px] font-bold text-foreground group-hover:underline">{p.title}</p>
              </Link>
            ))}
          </div>
        </Row>

        <Row
          n="03"
          name="People"
          href="/people"
          line={
            <>
              {d.pi.name} ({d.pi.title}) leads {d.members.length} researchers; alumni have gone on to{" "}
              {d.alumni.map((a) => a.nowAt?.split(", ").slice(1).join(", ")).filter(Boolean).join(", ")}.
            </>
          }
        >
          <div className="flex gap-5">
            <div className="relative h-[150px] w-[120px] shrink-0 overflow-hidden bg-muted">
              {d.pi.photo && <Photo src={d.pi.photo} alt={d.pi.name} sizes="120px" className="grayscale" />}
            </div>
            <div className="grid grid-cols-4 content-start gap-2">
              {d.members.map((m) => (
                <Face key={m.id} person={m} size={46} className="rounded-none grayscale" />
              ))}
            </div>
          </div>
        </Row>

        <Row n="04" name="News" href="/news" line={<>{d.news[0]?.title}.</>}>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {d.news.slice(0, 3).map((n) => (
              <li key={n.id} className="grid grid-cols-[90px_1fr] gap-3 py-2.5 text-[13.5px]">
                <span className="font-mono text-[11px] text-text-faint uppercase">{shortDate(n.date)}</span>
                <span className="text-foreground">{n.title}</span>
              </li>
            ))}
          </ul>
        </Row>

        <Row n="05" name="Location & Lab Culture" href="/lab" line={<>One UTSA Circle, San Antonio, Texas — where the lab is, and what working in it is like.</>}>
          <figure className="relative aspect-[16/7] overflow-hidden bg-muted">
            <Photo src={location.src} alt={location.caption} sizes="40vw" className="grayscale" />
          </figure>
        </Row>

        <Row n="06" name="Blog" href="/blog" line={<>Notes from the lab on large language models and where AI is heading.</>}>
          <ul className="space-y-2">
            {d.blog.map((b) => (
              <li key={b.id}>
                <Link href={`/blog/${b.id}`} className="text-[15px] font-bold text-foreground hover:underline">
                  {b.title}
                </Link>
                <span className="ml-2 font-mono text-[11px] text-text-faint uppercase">{shortDate(b.date)}</span>
              </li>
            ))}
          </ul>
        </Row>

        <Row n="07" name="Sponsors" href="/sponsors" line={<>Supported by {d.sponsors.map((s) => s.name).join(", ")}.</>}>
          <div className="flex h-full items-center gap-8 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase">
            {d.sponsors.map((s) => (
              <span key={s.id}>{s.name}</span>
            ))}
          </div>
        </Row>
        <div className="border-t border-foreground" />
      </div>
    </div>
  );
}
