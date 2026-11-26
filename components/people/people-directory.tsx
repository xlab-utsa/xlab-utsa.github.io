import Image from "next/image";
import Link from "next/link";

import { LinkIcons, PersonPhoto } from "@/components/people/person-parts";
import { getAllPeople } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { isLabLead } from "@/lib/content/people";
import { getPeopleDirectory, type PreviewPerson } from "@/lib/people-directory";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// The People page (SPEC.md §5), option A "Refined" from /preview/people: the PI's
// three-column block (title, about and education | framed photo, name and links |
// appointments and honors as figures), then each group as a labelled row of tiles. Which
// group a person lands in is decided by lib/content/people.ts from their labRoles; each
// tile's paper count and areas come from confirmed author links (lib/people-directory.ts).

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[12px] font-bold tracking-[0.18em] text-text-faint uppercase", className)}>{children}</p>;
}

function Tile({ p }: { p: PreviewPerson }) {
  const alumni = !!p.now;
  const href = p.links.find((l) => l.key !== "email")?.href;
  const inner = (
    <>
      <PersonPhoto
        name={p.name}
        photo={p.photo}
        sizes="(min-width: 1024px) 15vw, 40vw"
        className={cn(
          "aspect-square w-full transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none",
          alumni ? "rounded-full" : "rounded-2xl"
        )}
      />
      <p className="mt-4 text-[17px] leading-tight font-bold tracking-tight text-foreground group-hover:underline">{p.name}</p>
      <p className="mt-1 font-mono text-[11.5px] tracking-[0.12em] text-brand-strong uppercase">{alumni ? `Former ${p.role}` : p.role}</p>
      {p.now && (
        <p className="mt-2 text-[13.5px] leading-snug text-muted-foreground">
          Now: {p.now.title}, <span className="font-semibold text-foreground">{p.now.where}</span>
        </p>
      )}
    </>
  );
  return (
    <div className="flex flex-col">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
          {inner}
        </a>
      ) : (
        <div className="group">{inner}</div>
      )}
      <LinkIcons links={p.links} size={30} className="mt-3" />
    </div>
  );
}

export function PeopleDirectory() {
  const d = getPeopleDirectory();
  const pi = d.pi;

  return (
    <div>
    {/* ================= the PI ================= */}
    <section aria-labelledby="pi-name">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[12.5px] font-bold tracking-[0.2em] text-brand uppercase">Principal Investigator</span>
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-brand/50 to-transparent" />
      </div>

      <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_320px_1fr] lg:gap-14">
        {/* left: title, about, education */}
        <div className="order-2 flex flex-col gap-8 lg:order-1 lg:text-right">
          <div className="lg:ml-auto">
            <p className="text-[19px] leading-snug font-semibold text-brand-strong">{pi.title}</p>
            <span aria-hidden="true" className="mt-3 block h-0.5 w-10 bg-brand lg:ml-auto" />
          </div>
          {pi.bio && (
            <div>
              <Label>About</Label>
              <p className="mt-2.5 text-[17px] leading-relaxed text-muted-foreground">{pi.bio}</p>
            </div>
          )}
          {pi.education.length > 0 && (
            <div>
              <Label>Education</Label>
              <ul className="mt-3 space-y-2.5">
                {pi.education.map((e) => (
                  <li key={`${e.degree}-${e.institution}`} className="text-[16px] leading-snug">
                    <span className="font-semibold text-foreground">{e.degree}</span>
                    <span className="text-muted-foreground">, {e.institution}</span>
                    {e.year ? <span className="ml-2 font-mono text-[13px] text-text-faint">{e.year}</span> : null}
                    {e.note ? <span className="block text-[13.5px] text-brand-strong">{e.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* centre: photo, name, links */}
        <div className="order-1 flex flex-col items-center text-center lg:order-2">
          <div className="relative p-2.5">
            <span aria-hidden="true" className="absolute top-0 right-0 h-10 w-10 rounded-tr-[26px] border-t-2 border-r-2 border-brand" />
            <span aria-hidden="true" className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[26px] border-b-2 border-l-2 border-brand" />
            <PersonPhoto name={pi.name} photo={pi.photo} sizes="300px" priority className="h-[375px] w-[300px] rounded-[20px] shadow-[0_24px_60px_-30px_rgb(0_0_0/0.45)]" />
          </div>
          <h2 id="pi-name" className="mt-6 text-[34px] leading-none font-bold tracking-tight text-foreground">
            {pi.name}
          </h2>
          <ul className="mt-2 space-y-0.5 text-[14px] text-muted-foreground">
            {pi.secondary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <LinkIcons links={pi.links} size={40} className="mt-5 justify-center" />
        </div>

        {/* right: appointments, honors */}
        <div className="order-3 flex flex-col gap-9">
          <div>
            <Label>Appointments</Label>
            <ul className="mt-3 space-y-2.5">
              {pi.appointments.map((a) => (
                <li key={`${a.role}-${a.where}`} className="border-l-2 border-brand pl-3.5 text-[16px] leading-snug">
                  <span className="font-semibold text-foreground">{a.role}</span>
                  <span className="text-muted-foreground">, {a.where}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Honors</Label>
            <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5">
              {pi.honorCounts.map((h) => (
                <div key={h.label}>
                  <dd className="text-[34px] leading-none font-bold tracking-tight text-foreground">{h.n}</dd>
                  <dt className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{h.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>

    {/* ================= the groups ================= */}
    {d.groups.map((g) => {
      const alumni = g.key === "alumni";
      return (
        <section key={g.key} aria-labelledby={`g-${g.key}`} className="mt-20">
          <div className="flex items-center gap-4">
            <h2
              id={`g-${g.key}`}
              className={cn(
                "rounded-full px-4 py-1.5 font-mono text-[12.5px] font-bold tracking-[0.16em] uppercase",
                alumni ? "border border-border text-muted-foreground" : "bg-foreground text-background"
              )}
            >
              {g.label}
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
            <span className="font-mono text-[13px] text-muted-foreground">
              {g.people.length} {g.people.length === 1 ? "person" : "people"}
            </span>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {g.people.map((p) => (
              <li key={p.id}>
                <Tile p={p} />
              </li>
            ))}
          </ul>
        </section>
      );
    })}
    </div>
  );
}

/**
 * The homepage's PI block: photo on the left, biography on the right, and the way through
 * to the group (2026-11-23 meeting). Everything else about the PI lives on /people.
 */
export function PiSummary() {
  const pi = getAllPeople().find(isLabLead);
  if (!pi) return null;
  const hasPhoto = publicFileExists(pi.photo);

  return (
    <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[240px_1fr]">
      <div className="border border-border bg-background p-2 justify-self-center md:justify-self-start">
        {hasPhoto && pi.photo ? (
          <Image
            src={withBasePath(pi.photo!)}
            alt={pi.name}
            width={224}
            height={280}
            className="block h-[280px] w-[224px] object-cover"
          />
        ) : (
          <div className="flex h-[280px] w-[224px] items-center justify-center bg-muted font-mono text-2xl text-muted-foreground">
            {initials(pi.name)}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-2xl font-bold tracking-tight text-foreground">{pi.name}</span>
        <span className="font-mono text-[11px] font-bold tracking-wider text-brand-strong uppercase">
          {pi.roleTitle}
        </span>
        {pi.bio && (
          <p className="max-w-[75ch] text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {pi.bio.trim()}
          </p>
        )}
        <Link
          href="/people"
          className="mt-2 inline-flex w-fit items-center gap-2 border border-foreground bg-invert-bg px-4 py-2 font-mono text-[12px] font-bold tracking-wider text-invert-fg uppercase transition-opacity hover:opacity-85"
        >
          Meet the group →
        </Link>
      </div>
    </div>
  );
}
