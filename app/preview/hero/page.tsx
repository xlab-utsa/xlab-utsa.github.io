import Image from "next/image";
import Link from "next/link";

import { AnimatedCounter } from "@/components/animated-counter";
import { getGalleryPhotos } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { getHomeData } from "@/lib/home/data";

// Hero ideas, side by side for comparison (not the live home page):
//   A — ideas 1–3: figures centred beside the headline; hero + gallery fill the first screen;
//       the gallery runs edge to edge with rounded photos and faded ends, no grey band.
//   B — all six: A, plus one serif accent in the headline, two buttons, a soft blue glow, and
//       the figures as one row under the text.

function SoftGallery() {
  const photos = getGalleryPhotos().filter((p) => publicFileExists(p.image));
  const track = [...photos, ...photos];
  return (
    <section
      aria-label="Lab photos"
      className="gallery-strip overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
    >
      <ul className="gallery-track flex w-max gap-4" style={{ ["--gallery-duration" as string]: `${photos.length * 6}s` }}>
        {track.map((p, i) => (
          <li key={`${p.id}-${i}`} aria-hidden={i >= photos.length ? true : undefined} className="shrink-0">
            <figure className="relative h-[clamp(170px,24vh,250px)] w-[clamp(250px,34vh,370px)] overflow-hidden rounded-2xl bg-muted">
              <Image src={withBasePath(p.image)} alt={p.caption ?? "X-Lab"} fill sizes="370px" className="object-cover" />
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-[59px] z-30 border-y border-neutral-800 bg-neutral-950 px-6 py-2 text-center font-mono text-[12px] tracking-[0.18em] text-white uppercase">
      {children}
    </div>
  );
}

export default function HeroIdeasPreview() {
  const d = getHomeData();
  const words = d.site.tagline.split(" ");
  const last = words.pop();

  return (
    <div>
      {/* ============================================================ A */}
      <Label>Version A · ideas 1–3 · balanced figures, first-screen fit, soft gallery</Label>
      <div className="flex min-h-[calc(100svh-59px-34px)] flex-col">
        <section className="mx-auto grid w-full max-w-[1500px] flex-1 items-center gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">X-Lab · UT San Antonio</p>
            <h1 className="mt-4 max-w-[18ch] text-[clamp(2.6rem,5vw,4.8rem)] leading-[1.02] font-bold tracking-tight text-foreground">
              {d.site.tagline}
            </h1>
            <p className="mt-5 max-w-[60ch] text-[18px] leading-relaxed text-muted-foreground">{d.site.description}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
            {d.stats.map((s) => (
              <div key={s.key} className="border-l-2 border-brand pl-4">
                <dd className="text-[clamp(1.9rem,2.6vw,2.6rem)] leading-none font-bold text-foreground">
                  <AnimatedCounter value={s.n} />
                </dd>
                <dt className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>
        <div className="pb-8">
          <SoftGallery />
        </div>
      </div>

      {/* ============================================================ B */}
      <Label>Version B · all six · plus serif accent, buttons, blue glow, figures in one row</Label>
      <div className="relative isolate flex min-h-[calc(100svh-59px-34px)] flex-col overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-48 left-1/2 -z-10 h-[560px] w-[1100px] -translate-x-1/2 rounded-full bg-brand opacity-[0.10] blur-[120px] dark:opacity-[0.16]"
        />
        <section className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col justify-center px-6 py-10 sm:px-10">
          <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">X-Lab · UT San Antonio</p>
          <h1 className="mt-4 max-w-[22ch] text-[clamp(2.8rem,5.6vw,5.4rem)] leading-[1.02] font-bold tracking-tight text-foreground">
            {words.join(" ")} <span className="font-display font-normal text-brand italic">{last}</span>
          </h1>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
            <p className="max-w-[62ch] text-[18px] leading-relaxed text-muted-foreground">{d.site.description}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/research" className="rounded-full bg-foreground px-6 py-3 text-[15px] font-semibold text-background transition-opacity hover:opacity-85">
                Explore the research
              </Link>
              <Link
                href="/people"
                className="rounded-full border border-border px-6 py-3 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Meet the people
              </Link>
            </div>
          </div>
          <dl className="mt-10 grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-6">
            {d.stats.map((s, i) => (
              <div key={s.key} className={`py-5 pr-4 lg:px-5 ${i > 0 ? "lg:border-l lg:border-border" : "lg:pl-0"}`}>
                <dd className="text-[clamp(1.9rem,2.6vw,2.6rem)] leading-none font-bold text-foreground">
                  <AnimatedCounter value={s.n} />
                </dd>
                <dt className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>
        <div className="pb-8">
          <SoftGallery />
        </div>
      </div>

      <p className="mx-auto max-w-[1500px] px-6 py-10 text-[14px] text-muted-foreground sm:px-10">
        End of the hero ideas. The live home page is unchanged — <Link href="/" className="underline">compare with it</Link>.
      </p>
    </div>
  );
}
