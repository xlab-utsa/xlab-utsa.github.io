import Image from "next/image";
import Link from "next/link";

import { WhoWorksOnWhat as Constellation } from "@/components/people/who-works-on-what";
import { Counter, More, Photo, shortDate } from "@/components/preview/parts";
import { withBasePath } from "@/lib/base-path";
import { getHomeData } from "@/lib/home/data";

// 05 · Constellation — the lab as a connected system. The centrepiece is an interactive map
// of who works on what and where it is published, drawn from the real author links; around
// it, a compact intro, the director, and the latest from the lab. Accent: the lab's blue.

export default function ConstellationPreview() {
  const d = getHomeData();
  const venues = d.venues.slice(0, 12);
  const people = d.members.filter((m) => d.links.some((l) => l.personId === m.id));
  const unlinked = d.members.length - people.length;
  const strip = ["0y1a8613", "1a1a0222", "1a1a0056", "dsc01917"].map((id) => d.photos.find((p) => p.id === id)!);

  return (
    <div className="pv-blue">
      {/* ---------------- intro ---------------- */}
      <section className="mx-auto grid max-w-[1500px] gap-10 px-6 pt-16 pb-8 sm:px-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-[var(--pv-accent)] uppercase">X-Lab · UT San Antonio</p>
          <h1 className="mt-4 max-w-[18ch] text-[clamp(2.6rem,5vw,4.6rem)] leading-[1.02] font-bold tracking-tight text-foreground">
            {d.site.tagline}
          </h1>
          <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-muted-foreground">{d.site.description}</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-5">
          {d.stats.map((s) => (
            <div key={s.key} className="border-l-2 border-[var(--pv-accent)] pl-3">
              <dd className="text-[clamp(1.7rem,2.4vw,2.3rem)] leading-none font-bold text-foreground">
                <Counter value={s.n} />
              </dd>
              <dt className="mt-1 text-[12px] leading-snug text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------- the map ---------------- */}
      <section aria-labelledby="map-heading" className="border-y border-border bg-bg-alt">
        <div className="mx-auto max-w-[1500px] px-6 py-12 sm:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="map-heading" className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold tracking-tight text-foreground">
              Who works on what — and where it is published
            </h2>
            <p className="text-[13px] text-muted-foreground">Hover or tab to a name, an area or a venue to follow its connections.</p>
          </div>
          <div className="mt-6">
            <Constellation
              people={people.map((p) => ({ id: p.id, label: p.name, sub: p.role, photo: p.photo }))}
              themes={d.themes.map((t) => ({ id: t.id, label: t.label, value: t.count }))}
              venues={venues.map((v) => ({ id: v.id, label: v.label, value: v.value }))}
              links={d.links.filter((l) => people.some((p) => p.id === l.personId))}
              venueLinks={d.venueLinks}
            />
          </div>
          <p className="mt-4 text-[12px] text-text-faint">
            Curves are drawn from co-authored papers; thicker means more papers. Jinjun Xiong is on nearly every paper, so he is
            the hub rather than a node{unlinked > 0 ? `; ${unlinked} newer member${unlinked === 1 ? " has" : "s have"} no linked papers yet` : ""}.{" "}
            <Link href="/research" className="underline">All {d.totals.publications} publications</Link>
          </p>
        </div>
      </section>

      {/* ---------------- director + latest ---------------- */}
      <section className="mx-auto grid max-w-[1500px] gap-14 px-6 py-16 sm:px-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="relative h-[260px] w-[210px] shrink-0 overflow-hidden rounded-2xl">
            {d.pi.photo && <Photo src={d.pi.photo} alt={d.pi.name} sizes="210px" />}
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.22em] text-[var(--pv-accent)] uppercase">At the centre</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{d.pi.name}</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">{d.pi.title}</p>
            <p className="mt-4 text-[14.5px] leading-relaxed text-muted-foreground">{d.pi.longBio[1]}</p>
            <More href="/people" className="mt-5">
              The whole group, and alumni
            </More>
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] tracking-[0.22em] text-text-faint uppercase">News</p>
            <ul className="mt-4 space-y-4">
              {d.news.slice(0, 3).map((n) => (
                <li key={n.id}>
                  <p className="font-mono text-[10.5px] text-text-faint uppercase">{shortDate(n.date)}</p>
                  <p className="mt-0.5 text-[14.5px] leading-snug font-semibold text-foreground">{n.title}</p>
                </li>
              ))}
            </ul>
            <More href="/news" className="mt-4">
              All news
            </More>
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.22em] text-text-faint uppercase">Projects</p>
            <ul className="mt-4 space-y-4">
              {d.projects.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-hairline bg-white">
                    {p.thumbnail && <Image src={withBasePath(p.thumbnail)} alt="" fill sizes="44px" className="object-contain p-1" />}
                  </span>
                  <Link href={`/projects#${p.id}`} className="text-[14.5px] font-semibold text-foreground hover:underline">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
            <More href="/projects" className="mt-4">
              All projects
            </More>
          </div>
        </div>
      </section>

      {/* ---------------- photos + blog + sponsors ---------------- */}
      <section className="grid grid-cols-2 gap-1 lg:grid-cols-4">
        {strip.map((p) => (
          <figure key={p.id} className="relative aspect-[4/3] overflow-hidden">
            <Photo src={p.src} alt={p.caption} sizes="25vw" />
          </figure>
        ))}
      </section>
      <section className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-6 px-6 py-10 sm:px-10">
        <p className="text-[14px] text-muted-foreground">
          From the blog:{" "}
          {d.blog.map((b, i) => (
            <span key={b.id}>
              <Link href={`/blog/${b.id}`} className="font-semibold text-foreground hover:underline">
                {b.title}
              </Link>
              {i < d.blog.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
        <p className="text-[14px] text-muted-foreground">
          Supported by <span className="font-semibold text-foreground">{d.sponsors.map((s) => s.name).join(", ")}</span>
        </p>
      </section>
    </div>
  );
}
