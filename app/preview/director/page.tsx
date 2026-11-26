import Image from "next/image";
import Link from "next/link";

import { RadarChart } from "@/components/research/radar-chart";
import { Counter, Face, More, Photo, shortDate } from "@/components/preview/parts";
import { withBasePath } from "@/lib/base-path";
import { getHomeData } from "@/lib/home/data";

// 02 · Director + data — the PI is the constant: a full-height portrait pinned on the left.
// The lab itself scrolls past on the right, figure by figure. On small screens the portrait
// becomes a cover image and everything stacks.

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border py-14 first:border-t-0 first:pt-0">
      <p className="font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">{kicker}</p>
      <h2 id={id} className="mt-2 text-[clamp(1.6rem,2.4vw,2.2rem)] leading-tight font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function DirectorPreview() {
  const d = getHomeData();
  const portrait = d.photos.find((p) => p.id === "1a1a2622")!;
  const strip = ["0y1a8613", "1a1a0056", "1a1a0222", "dsc01917", "cg1a9437-1", "1a1a9582"].map((id) => d.photos.find((p) => p.id === id)!);
  const maxTheme = Math.max(...d.themes.map((t) => t.count));

  return (
    <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[minmax(380px,40%)_1fr]">
      {/* ---------------- the pinned director ---------------- */}
      <aside className="relative bg-invert-bg text-invert-fg lg:sticky lg:top-[59px] lg:h-[calc(100vh-59px)]">
        <div className="relative h-[62vh] min-h-[360px] lg:absolute lg:inset-0 lg:h-auto">
          <Photo src={portrait.src} alt={d.pi.name} sizes="(min-width: 1024px) 40vw, 100vw" priority className="object-[50%_30%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>
        <div className="relative px-8 pb-10 sm:px-12 lg:absolute lg:inset-x-0 lg:bottom-0">
          <p className="font-mono text-[11px] tracking-[0.2em] text-white/60 uppercase">Director</p>
          <h1 className="mt-2 text-[clamp(2.4rem,4vw,3.6rem)] leading-none font-bold tracking-tight text-white">{d.pi.name}</h1>
          <p className="mt-3 max-w-[40ch] text-[15px] leading-snug text-white/80">{d.pi.title}</p>
          <ul className="mt-4 space-y-1 text-[13px] text-white/60">
            {d.pi.secondary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/people" className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black">
              Meet the group
            </Link>
            <a href="#about" className="rounded-full border border-white/30 px-5 py-2.5 text-[13px] font-semibold text-white">
              Biography
            </a>
          </div>
        </div>
      </aside>

      {/* ---------------- the lab, scrolling ---------------- */}
      <div className="px-6 py-14 sm:px-12 lg:px-16 lg:py-20">
        <section className="pb-14">
          <div className="flex items-center gap-3">
            {d.site.logo && <Image src={withBasePath(d.site.logo.light)} alt="" width={34} height={34} className="size-[34px] dark:hidden" />}
            {d.site.logo && <Image src={withBasePath(d.site.logo.dark)} alt="" width={34} height={34} className="hidden size-[34px] dark:block" />}
            <span className="font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">X-Lab · UT San Antonio</span>
          </div>
          <p className="mt-6 max-w-[18ch] text-[clamp(2.2rem,3.8vw,3.6rem)] leading-[1.04] font-bold tracking-tight text-foreground">
            {d.site.tagline}
          </p>
          <p className="mt-6 max-w-[60ch] text-[16px] leading-relaxed text-muted-foreground">{d.site.description}</p>

          <dl className="mt-12 grid grid-cols-2 border-t border-l border-border sm:grid-cols-3">
            {d.stats.map((s) => (
              <div key={s.key} className="border-r border-b border-border p-5">
                <dt className="text-[12.5px] text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-[clamp(2rem,3vw,2.8rem)] leading-none font-bold tracking-tight text-foreground">
                  <Counter value={s.n} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <Section id="d-research" kicker="01 · Research" title={`${d.totals.publications} papers across seven areas`}>
          <div className="grid items-center gap-10 xl:grid-cols-[1fr_1fr]">
            <RadarChart data={d.themes.map((t) => ({ id: t.id, label: t.label, value: t.count }))} title="Publications per area" />
            <ul className="space-y-3">
              {[...d.themes].sort((a, b) => b.count - a.count).map((t) => (
                <li key={t.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[14px] font-semibold text-foreground">{t.title}</span>
                    <span className="font-mono text-[12px] text-muted-foreground">{t.count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground" style={{ width: `${(t.count / maxTheme) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <More href="/research" className="mt-8">
            All research &amp; publications
          </More>
        </Section>

        <Section id="d-venues" kicker="02 · Venues" title={`Published at ${d.totals.venues} conferences and journals`}>
          <ol className="grid gap-x-10 gap-y-3 sm:grid-cols-2 [&>li]:min-w-0">
            {d.venues.slice(0, 10).map((v, i) => (
              <li key={v.id} className="flex items-baseline gap-4 border-b border-hairline pb-3">
                <span className="w-6 font-mono text-[11px] text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-foreground">{v.label}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{v.name}</span>
                </span>
                <span className="font-mono text-[18px] font-bold text-foreground">{v.value}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="d-people" kicker="03 · People" title="The group">
          <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 xl:grid-cols-5">
            {d.members.map((m) => (
              <div key={m.id} className="flex flex-col items-center text-center">
                <Face person={m} size={84} />
                <span className="mt-3 text-[13px] leading-tight font-semibold text-foreground">{m.name}</span>
                <span className="mt-0.5 font-mono text-[10.5px] text-text-faint uppercase">{m.role}</span>
              </div>
            ))}
          </div>
          {d.alumni.length > 0 && (
            <div className="mt-10 rounded-xl bg-bg-alt p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">Alumni</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {d.alumni.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <Face person={a} size={44} />
                    <span>
                      <span className="block text-[13px] font-semibold text-foreground">{a.name}</span>
                      <span className="block text-[12px] leading-snug text-muted-foreground">{a.nowAt}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <More href="/people" className="mt-8">
            Everyone in the lab
          </More>
        </Section>

        <Section id="d-life" kicker="04 · Life in the lab" title="Where the work happens">
          <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2 sm:-mx-12 sm:px-12 lg:-mx-16 lg:px-16">
            {strip.map((p) => (
              <figure key={p.id} className="relative aspect-[3/2] w-[78%] shrink-0 snap-start overflow-hidden rounded-xl sm:w-[46%]">
                <Photo src={p.src} alt={p.caption} sizes="40vw" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pt-10 pb-3 text-[12.5px] text-white">
                  {p.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section id="d-work" kicker="05 · Work" title="Projects & news">
          <div className="grid gap-12 xl:grid-cols-2">
            <ul className="space-y-6">
              {d.projects.map((p) => (
                <li key={p.id} className="flex gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-hairline bg-bg-alt">
                    {p.thumbnail && <Image src={withBasePath(p.thumbnail)} alt="" fill sizes="64px" className="object-contain p-1.5" />}
                  </div>
                  <div>
                    <Link href={`/projects#${p.id}`} className="text-[15px] font-bold text-foreground hover:underline">
                      {p.title}
                    </Link>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.tagline}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="space-y-5">
              {d.news.slice(0, 3).map((n) => (
                <li key={n.id} className="border-l-2 border-foreground pl-4">
                  <p className="font-mono text-[11px] text-text-faint uppercase">{shortDate(n.date)}</p>
                  <p className="mt-1 text-[15px] leading-snug font-semibold text-foreground">{n.title}</p>
                </li>
              ))}
              <li>
                <More href="/news">All news</More>
              </li>
            </ul>
          </div>
        </Section>

        <Section id="about" kicker="06 · About the director" title={`About ${d.pi.name}`}>
          <div className="max-w-[68ch] space-y-4 text-[15.5px] leading-relaxed text-muted-foreground">
            {d.pi.longBio.map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">Appointments</p>
              <ul className="mt-2 space-y-1 text-[13.5px] text-foreground">
                {d.pi.appointments.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">Honors</p>
              <ul className="mt-2 space-y-1 text-[13.5px] text-foreground">
                {d.pi.honors.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <section className="border-t border-border pt-10">
          <p className="font-mono text-[11px] tracking-[0.2em] text-text-faint uppercase">Supported by</p>
          <p className="mt-2 text-[15px] font-semibold text-foreground">
            {d.sponsors.map((s) => s.name).join(" · ")} — <Link href="/sponsors" className="underline">sponsors</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
