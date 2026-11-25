import Image from "next/image";
import Link from "next/link";

import { PersonLinkIcons } from "@/components/person-link-icons";
import { TeamCard } from "@/components/team-card";
import { getAllPeople, getRecognitionsByPerson, type Person } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { isLabLead, PEOPLE_GROUPS, peopleGroup } from "@/lib/content/people";
import {
  getAffiliationInstitutionLabel,
  sortPeople,
  summarizeRecognitions,
} from "@/lib/team";

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
                    {affiliations.map((a, i) => (
                      <span
                        key={i}
                        className="border-l-2 border-hairline pl-2 text-[13px] leading-snug text-foreground"
                      >
                        {a.roleTitle}, {getAffiliationInstitutionLabel(a)}
                      </span>
                    ))}
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

// The People page (SPEC.md §5): the PI's full profile, then four groups. Which group a
// person lands in is decided by lib/content/people.ts from their labRoles — never here.
export function PeopleDirectory() {
  const people = sortPeople(getAllPeople());
  const pi = people.find(isLabLead);
  const groups = PEOPLE_GROUPS.map((group) => ({
    ...group,
    people: people.filter((p) => p.id !== pi?.id && peopleGroup(p) === group.key),
  })).filter((group) => group.people.length > 0);

  return (
    <div className="flex flex-col gap-12">
      {pi && <PiLayer pi={pi} />}

      {groups.map((group) => {
        const alumni = group.key === "alumni";
        return (
          <section
            key={group.key}
            aria-labelledby={`group-${group.key}`}
            className={alumni ? "flex flex-col gap-5 border-l border-hairline pl-8" : "flex flex-col gap-5 border-l border-border pl-8"}
          >
            <div className="flex items-center gap-3.5">
              <h2
                id={`group-${group.key}`}
                className={
                  alumni
                    ? "border border-border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest text-muted-foreground uppercase"
                    : "border border-foreground px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest text-foreground uppercase"
                }
              >
                {group.label}
              </h2>
              <span aria-hidden="true" className={alumni ? "h-px flex-1 bg-hairline" : "h-px flex-1 bg-border"} />
              <span className="font-mono text-[11.5px] text-muted-foreground">
                {group.people.length} {group.people.length === 1 ? "person" : "people"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {group.people.map((person) => (
                <TeamCard key={person.id} person={person} variant={alumni ? "alumni" : "tile"} />
              ))}
            </div>
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
