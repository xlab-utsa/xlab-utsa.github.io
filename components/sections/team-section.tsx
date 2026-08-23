import Image from "next/image";

import { PersonLinkIcons } from "@/components/person-link-icons";
import { TeamCard } from "@/components/team-card";
import {
  getAlumniPeople,
  getCurrentPeople,
  getInstitutionById,
  getRecognitionsByPerson,
  type Person,
} from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { sortPeople, summarizeRecognitions } from "@/lib/team";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// The PI is the only person who gets this richer treatment — real fields only:
// `bio` (replaces the mockup's invented "Before academia" placeholder paragraph),
// `profile.education`, `affiliations` as "Appointments", and Recognition data
// (previously unused anywhere on the site) summarized as "Honors".
function PiLayer({ pi }: { pi: Person }) {
  const hasPhoto = publicFileExists(pi.photo);
  const education = pi.profile?.education ?? [];
  const affiliations = pi.affiliations ?? [];
  const honors = summarizeRecognitions(getRecognitionsByPerson(pi.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <span className="bg-brand px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-brand-foreground uppercase">
          Principal Investigator
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-brand/35" />
      </div>

      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_260px_1fr]">
        <div className="flex flex-col gap-3 lg:text-right">
          <div className="flex flex-col gap-1.5 lg:items-end">
            <span className="font-mono text-[11px] font-bold tracking-wider text-brand-strong uppercase">
              {pi.roleTitle}
            </span>
            <span aria-hidden="true" className="h-0.5 w-7 bg-brand" />
          </div>
          {pi.bio && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
                About
              </span>
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                {pi.bio}
              </p>
            </div>
          )}
          {education.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
                Education
              </span>
              <div className="flex flex-col gap-1">
                {education.map((ed, i) => (
                  <span
                    key={i}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {ed.degree}, {ed.institution}
                    {ed.year ? `, ${ed.year}` : ""}
                    {ed.note ? ` — ${ed.note}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="relative border border-border bg-background p-2">
            {hasPhoto && pi.photo ? (
              <Image
                src={withBasePath(pi.photo!)}
                alt={pi.name}
                width={240}
                height={300}
                className="block h-[300px] w-[240px] object-cover"
              />
            ) : (
              <div className="flex h-[300px] w-[240px] items-center justify-center bg-muted font-mono text-2xl text-muted-foreground">
                {initials(pi.name)}
              </div>
            )}
            <span
              aria-hidden="true"
              className="absolute -bottom-px -left-px h-6 w-6 border-b-2 border-l-2 border-brand"
            />
            <span
              aria-hidden="true"
              className="absolute -top-px -right-px h-6 w-6 border-t-2 border-r-2 border-brand"
            />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {pi.name}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
              Contact
            </span>
            <PersonLinkIcons person={pi} />
          </div>
          {(affiliations.length > 0 || honors.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {affiliations.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
                    Appointments
                  </span>
                  <div className="flex flex-col gap-1">
                    {affiliations.map((a, i) => {
                      const institution = getInstitutionById(a.institutionId);
                      return (
                        <span
                          key={i}
                          className="border-l-2 border-hairline pl-2 text-[13px] leading-snug text-foreground"
                        >
                          {a.roleTitle},{" "}
                          {institution?.shortName ?? institution?.name ?? a.institutionId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {honors.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
                    Honors
                  </span>
                  <div className="flex flex-col gap-1">
                    {honors.map((line) => (
                      <span
                        key={line}
                        className="text-[13px] leading-snug text-muted-foreground"
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Three layers: the PI, the current lab (one flat grid, no personType sub-headers —
// matches the mockup's own layout), and alumni (hidden entirely while empty, true of
// all 17 people today — nobody has labTenure.leftYear set yet).
export function TeamSection() {
  const current = getCurrentPeople();
  const pi = current.find((p) => p.personType === "lab-lead");
  const rest = sortPeople(current.filter((p) => p.id !== pi?.id));
  const alumni = sortPeople(getAlumniPeople());

  return (
    <section
      id="team"
      aria-labelledby="team-heading"
      className="scroll-mt-16 border-b border-border"
    >
      <div className="mx-auto max-w-[1600px] px-6 py-12 sm:px-10">
        <div className="mb-8 flex items-baseline gap-3">
          <h2
            id="team-heading"
            className="font-mono text-[15px] font-bold tracking-widest text-foreground uppercase"
          >
            People
          </h2>
          <span className="text-[13.5px] text-muted-foreground">
            Three layers: the PI, the lab, the alumni network
          </span>
        </div>

        {pi && <PiLayer pi={pi} />}

        {rest.length > 0 && (
          <div className="mt-11 flex flex-col gap-5 border-l border-border pl-8">
            <div className="flex items-center gap-3.5">
              <span className="border border-foreground px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest text-foreground uppercase">
                Current members
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
              <span className="font-mono text-[11.5px] text-muted-foreground">
                {rest.length} {rest.length === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {rest.map((person) => (
                <TeamCard key={person.id} person={person} variant="tile" />
              ))}
            </div>
          </div>
        )}

        {alumni.length > 0 && (
          <div className="mt-10 flex flex-col gap-4 border-l border-hairline pl-16">
            <div className="flex items-center gap-3.5">
              <span className="border border-border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Alumni
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
            </div>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {alumni.map((person) => (
                <TeamCard key={person.id} person={person} variant="alumni" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
