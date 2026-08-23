import Image from "next/image";
import Link from "next/link";

import { TeamCard } from "@/components/team-card";
import { getCurrentPeople } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { personTypeShortLabel, sortPeople } from "@/lib/team";

// Live "lab, today" preview band: satellite member tiles flanking the PI.
//
// The mockup drew a fixed 4-col x 2-row grid per side (8 tiles/side, 16 total) because the
// lab happened to have exactly 16 non-PI members when it was designed. Membership is not a
// constant — people join and graduate — so the split is computed instead of hardcoded:
// take up to MAX_TILES and divide evenly, so an odd count leans left and a small lab
// renders a short band rather than a half-empty one.
const MAX_TILES = 16;

export function HeroTeamPreview() {
  const current = getCurrentPeople();
  const pi = current.find((p) => p.personType === "lab-lead");
  if (!pi) return null;

  const others = sortPeople(current.filter((p) => p.id !== pi.id)).slice(0, MAX_TILES);
  if (others.length === 0) return null;

  const split = Math.ceil(others.length / 2);
  const left = others.slice(0, split);
  const right = others.slice(split);

  return (
    <div className="border-t border-border bg-bg-alt px-6 py-5 sm:px-10">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between pb-3">
        <span className="font-mono text-[11px] font-bold tracking-widest text-text-faint uppercase">
          The lab, today
        </span>
        <Link
          href="/#team"
          className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          Full roster ›
        </Link>
      </div>
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-y-2 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-12 xl:gap-x-16">
        <div className="grid grid-cols-4 place-items-center gap-y-7">
          {left.map((person) => (
            <TeamCard key={person.id} person={person} variant="mini" />
          ))}
        </div>

        <div className="flex flex-col items-center justify-self-center px-1">
          <div className="border border-border bg-background p-1.5">
            {publicFileExists(pi.photo) && pi.photo ? (
              <Image
                src={withBasePath(pi.photo!)}
                alt={pi.name}
                width={120}
                height={120}
                className="block h-[120px] w-[120px] object-cover"
              />
            ) : (
              <div className="flex h-[120px] w-[120px] items-center justify-center bg-muted font-mono text-sm text-muted-foreground">
                {pi.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-col items-center gap-0.5 text-center">
            <span className="text-sm font-bold text-foreground">{pi.name}</span>
            <span className="font-mono text-[9.5px] tracking-widest text-brand uppercase">
              {personTypeShortLabel(pi.personType)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 place-items-center gap-x-4 gap-y-7">
          {right.map((person) => (
            <TeamCard key={person.id} person={person} variant="mini" />
          ))}
        </div>
      </div>
    </div>
  );
}
