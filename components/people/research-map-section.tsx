import Link from "next/link";

import { WhoWorksOnWhat } from "@/components/people/who-works-on-what";
import { getAllVenues, getCurrentPeople, getPublications, getPublicationsByTheme, getResearchThemes } from "@/lib/content";
import { isLabLead, LAB_ROLE_SHORT_LABELS, primaryRole } from "@/lib/content/people";
import { shortThemeLabel } from "@/lib/home/data";
import { getResearchMap } from "@/lib/research-map";
import { sortPeople } from "@/lib/team";

// The People page's map of who works on what, and where it is published (SERVER/BUILD ONLY).
// Members appear once they have at least one confirmed author link.
export function ResearchMapSection() {
  const { links, venueLinks } = getResearchMap(12);
  const current = getCurrentPeople();
  const lead = current.find(isLabLead);
  const members = sortPeople(current.filter((p) => p.id !== lead?.id));
  const people = members.filter((m) => links.some((l) => l.personId === m.id));
  const unlinked = members.length - people.length;
  if (people.length === 0) return null;

  const venueIds = new Set(venueLinks.map((l) => l.venueId));
  const counts = new Map<string, number>();
  for (const p of getPublications()) if (p.venueId && venueIds.has(p.venueId)) counts.set(p.venueId, (counts.get(p.venueId) ?? 0) + 1);
  const venues = getAllVenues()
    .filter((v) => counts.has(v.id))
    .map((v) => ({ id: v.id, label: v.shortName, value: counts.get(v.id)! }))
    .sort((a, b) => b.value - a.value);

  return (
    <section aria-labelledby="map-heading" className="rounded-[24px] border border-border bg-bg-alt px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="map-heading" className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold tracking-tight text-foreground">
          Who works on what — and where it is published
        </h2>
        <p className="text-[13px] text-muted-foreground">Hover or tab to a name, an area or a venue to follow its connections.</p>
      </div>
      <div className="mt-6">
        <WhoWorksOnWhat
          people={people.map((p) => {
            const role = primaryRole(p)?.role;
            return { id: p.id, label: p.name, sub: role ? LAB_ROLE_SHORT_LABELS[role] : undefined, photo: p.photo };
          })}
          themes={getResearchThemes().map((t) => ({ id: t.id, label: shortThemeLabel(t.title), value: getPublicationsByTheme(t.id).length }))}
          venues={venues}
          links={links.filter((l) => people.some((p) => p.id === l.personId))}
          venueLinks={venueLinks}
        />
      </div>
      <p className="mt-4 text-[12px] text-text-faint">
        Curves are drawn from co-authored papers; thicker means more papers.{lead ? ` ${lead.name} is on nearly every paper, so he is the hub rather than a node` : ""}
        {unlinked > 0 ? `; ${unlinked} newer member${unlinked === 1 ? " has" : "s have"} no linked papers yet` : ""}.{" "}
        <Link href="/research" className="underline">
          All publications
        </Link>
      </p>
    </section>
  );
}
