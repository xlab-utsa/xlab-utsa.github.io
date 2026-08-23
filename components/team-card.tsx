import Image from "next/image";

import { PersonLinkIcons } from "@/components/person-link-icons";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import type { Person } from "@/lib/content";
import { cn } from "@/lib/utils";
import { personTypeShortLabel, resolvePersonRedirectUrl } from "@/lib/team";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type TeamCardVariant = "mini" | "tile" | "alumni";

/** Single source of truth for card sizing — tweak widths/text here only. */
const VARIANT = {
  mini: {
    root: "w-[72px] shrink-0 gap-1.5",
    link: "gap-1.5",
    name: "text-[10px] font-semibold",
    role: "text-[8px]",
    initials: "text-[10px]",
    icons: null,
  },
  tile: {
    root: "mx-auto w-full max-w-48 gap-1.5",
    link: "gap-1.5",
    name: "text-[13px] font-bold",
    role: "text-[9px]",
    initials: "text-[11px]",
    icons: "default" as const,
  },
  alumni: {
    root: "mx-auto w-full max-w-[88px] gap-1.5",
    link: "gap-1.5",
    name: "text-[11px] font-semibold",
    role: "text-[8.5px]",
    initials: "text-[10px]",
    icons: "sm" as const,
  },
} satisfies Record<
  TeamCardVariant,
  {
    root: string;
    link: string;
    name: string;
    role: string;
    initials: string;
    icons: "default" | "sm" | null;
  }
>;

// Photo+name+role is one link (the resolved redirect, SPEC.md decision #4); the icon
// row below it is a SIBLING, not nested inside that <a>, so the individual icons stay
// independently clickable without invalid nested-anchor HTML. Icon row is skipped for
// "mini" (the hero band's 74px tiles have no room for 6 icons).
export function TeamCard({
  person,
  variant = "tile",
}: {
  person: Person;
  variant?: TeamCardVariant;
}) {
  const redirectUrl = resolvePersonRedirectUrl(person);
  const hasPhoto = publicFileExists(person.photo);
  const roleLabel = personTypeShortLabel(person.personType);
  const style = VARIANT[variant];
  const circular = variant === "alumni";

  return (
    <div className={cn("flex flex-col", style.root)}>
      <a
        href={redirectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("group flex flex-col", style.link)}
      >
        <div
          className={cn(
            "relative aspect-square w-full overflow-hidden border border-border bg-muted transition-opacity group-hover:opacity-80",
            circular && "rounded-full"
          )}
        >
          {hasPhoto && person.photo ? (
            <Image
              src={withBasePath(person.photo!)}
              alt={person.name}
              fill
              sizes="(min-width: 512px) 10vw, 20vw"
              className="object-cover"
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center font-mono font-semibold text-muted-foreground",
                style.initials
              )}
              aria-hidden="true"
            >
              {initials(person.name)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={cn(style.name, "leading-tight text-foreground")}>
            {person.name}
          </span>
          <span
            className={cn(
              style.role,
              "font-mono tracking-wide text-text-faint uppercase"
            )}
          >
            {roleLabel}
          </span>
        </div>
      </a>
      {style.icons && <PersonLinkIcons person={person} size={style.icons} />}
    </div>
  );
}
