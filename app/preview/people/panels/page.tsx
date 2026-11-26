import { getPeoplePreviewData, type PreviewPerson } from "@/lib/people-directory";
import { LinkIcons, PeoplePreviewBar, PersonPhoto } from "@/components/preview/people/nav";
import { cn } from "@/lib/utils";

// Option B · Panels — the live page's order and three-column PI block, set on soft panels.
// Left: about, then education as a timeline. Centre: a tall portrait with the name over it.
// Right: links as labelled buttons, appointments, honors as a row of figures. Each group is
// a panel of its own: the label and count on the left, member cards (with their research
// areas) on the right; alumni cards end in where they went.

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[12px] font-bold tracking-[0.18em] text-text-faint uppercase">{children}</p>;
}

function MemberCard({ p }: { p: PreviewPerson }) {
  const href = p.links.find((l) => l.key !== "email")?.href;
  const Name = href ? "a" : "span";
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-background transition-shadow hover:shadow-[0_16px_40px_-24px_rgb(0_0_0/0.4)]">
      <PersonPhoto name={p.name} photo={p.photo} sizes="(min-width: 1280px) 16vw, 45vw" className="aspect-[4/4.2] w-full" />
      <div className="flex flex-1 flex-col p-4">
        <Name
          {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-[17px] leading-tight font-bold tracking-tight text-foreground underline-offset-4 hover:underline"
        >
          {p.name}
        </Name>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{p.roleTitle.split(",")[0]}</p>
        {p.now ? (
          <p className="mt-3 rounded-xl bg-brand-soft-bg px-3 py-2 text-[13px] leading-snug text-brand-strong">
            <span aria-hidden="true">→ </span>
            {p.now.title}, <span className="font-bold">{p.now.where}</span>
          </p>
        ) : p.themes.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1">
            {p.themes.slice(0, 3).map((t) => (
              <li key={t.id} className="rounded-full border border-border px-2 py-0.5 text-[11.5px] font-semibold text-foreground">
                {t.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] text-text-faint">New to the lab</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <LinkIcons links={p.links} size={28} />
          {p.papers > 0 && <span className="font-mono text-[12px] whitespace-nowrap text-text-faint">{p.papers} paper{p.papers === 1 ? "" : "s"}</span>}
        </div>
      </div>
    </article>
  );
}

export default function PanelsPreview() {
  const d = getPeoplePreviewData();
  const pi = d.pi;
  const linkLabel = { email: "Email", scholar: "Scholar", website: "Website", linkedin: "LinkedIn", github: "GitHub" } as const;

  return (
    <div>
      <PeoplePreviewBar current="panels" />
      <div className="mx-auto max-w-[1600px] px-6 py-14 sm:px-10">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[clamp(2.6rem,4.6vw,4rem)] leading-none font-bold tracking-tight text-foreground">People</h1>
            <p className="mt-4 max-w-[70ch] text-[17px] leading-relaxed text-muted-foreground">
              The lab&apos;s principal investigator, its postdocs, visiting faculty and students — and the alumni who have gone on from here.
            </p>
          </div>
          <dl className="flex gap-8">
            {[
              [d.members.length + 1, "current members"],
              [d.alumni.length, "alumni"],
            ].map(([n, l]) => (
              <div key={l}>
                <dd className="text-[36px] leading-none font-bold text-foreground">{n}</dd>
                <dt className="mt-1 text-[13px] text-muted-foreground">{l}</dt>
              </div>
            ))}
          </dl>
        </header>

        {/* ================= the PI ================= */}
        <section aria-labelledby="pi-name" className="mt-10 rounded-[30px] bg-bg-alt p-6 sm:p-10">
          <p className="font-mono text-[12.5px] font-bold tracking-[0.2em] text-brand uppercase">Principal Investigator</p>
          <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_340px_1fr] lg:gap-12">
            {/* left: about + education timeline */}
            <div className="order-2 flex flex-col gap-8 lg:order-1">
              {pi.bio && (
                <div>
                  <Label>About</Label>
                  <p className="mt-2.5 text-[17px] leading-relaxed text-foreground">{pi.bio}</p>
                </div>
              )}
              {pi.education.length > 0 && (
                <div>
                  <Label>Education</Label>
                  <ol className="relative mt-4 space-y-5 border-l border-border pl-6">
                    {pi.education.map((e) => (
                      <li key={`${e.degree}-${e.institution}`} className="relative">
                        <span aria-hidden="true" className="absolute top-1.5 -left-[29.5px] size-2.5 rounded-full bg-brand ring-4 ring-bg-alt" />
                        <p className="font-mono text-[13px] text-brand-strong">{e.year}</p>
                        <p className="mt-0.5 text-[16px] leading-snug text-foreground">
                          <span className="font-semibold">{e.degree}</span>, {e.institution}
                        </p>
                        {e.note && <p className="mt-0.5 text-[13.5px] text-muted-foreground">{e.note}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* centre: portrait with the name over it */}
            <figure className="relative order-1 mx-auto w-full max-w-[340px] overflow-hidden rounded-[24px] lg:order-2">
              <PersonPhoto name={pi.name} photo={pi.photo} sizes="340px" priority className="aspect-[4/5] w-full" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-6 pt-20 pb-6 text-white">
                <h2 id="pi-name" className="text-[30px] leading-none font-bold tracking-tight">
                  {pi.name}
                </h2>
                <p className="mt-2 text-[14.5px] leading-snug text-white/85">{pi.title}</p>
              </figcaption>
            </figure>

            {/* right: links, appointments, honors */}
            <div className="order-3 flex flex-col gap-8">
              <div>
                <Label>Contact</Label>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {pi.links.map((l) => (
                    <li key={l.key}>
                      <a
                        href={l.href}
                        {...(l.key === "email" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-[14px] font-semibold text-foreground transition-colors hover:border-foreground"
                      >
                        {linkLabel[l.key]}
                        {l.key !== "email" && <span aria-hidden="true">↗</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Label>Appointments</Label>
                <ul className="mt-3 flex flex-col gap-2">
                  {pi.appointments.map((a) => (
                    <li key={`${a.role}-${a.where}`} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-[15.5px]">
                      <span className="font-semibold text-foreground">{a.role}</span>
                      <span className="shrink-0 font-mono text-[13px] text-muted-foreground">{a.where}</span>
                    </li>
                  ))}
                </ul>
                {pi.secondary.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[14px] text-muted-foreground">
                    {pi.secondary.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <Label>Honors</Label>
                <dl className="mt-4 grid grid-cols-5 gap-2">
                  {pi.honorCounts.map((h) => (
                    <div key={h.label} className="rounded-2xl bg-background px-2 py-3 text-center">
                      <dd className="text-[26px] leading-none font-bold text-foreground">{h.n}</dd>
                      <dt className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{h.label}</dt>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ================= the groups ================= */}
        {d.groups.map((g) => (
          <section
            key={g.key}
            aria-labelledby={`g-${g.key}`}
            className={cn("mt-8 grid gap-6 rounded-[30px] p-6 sm:p-10 lg:grid-cols-[220px_1fr] lg:gap-10", g.key === "alumni" ? "border border-border" : "bg-bg-alt")}
          >
            <div>
              <h2 id={`g-${g.key}`} className="text-[24px] leading-tight font-bold tracking-tight text-foreground">
                {g.label}
              </h2>
              <p className="mt-2 font-mono text-[13px] text-muted-foreground">
                {g.people.length} {g.people.length === 1 ? "person" : "people"}
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {g.people.map((p) => (
                <li key={p.id}>
                  <MemberCard p={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
