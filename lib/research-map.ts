// Who works on what, and where it is published — computed from the content tree.
//
// SERVER/BUILD ONLY. Used by the People page's map and the home page's story section.
//   * links       — lab member → research area, weighted by papers they co-authored there
//                   (confirmed author links only; the PI is on nearly every paper, so he is
//                   left out and treated as the hub).
//   * venueLinks  — research area → venue, papers per pair, for the top `topVenues` venues.
//   * venueGroup  — each venue's dominant area: "eda" when design automation carries most
//                   of its papers, "other" otherwise.
import { getCurrentPeople, getPublications } from "@/lib/content";
import { isLabLead } from "@/lib/content/people";

export type VenueGroup = "eda" | "other";

export function getResearchMap(topVenues = 12) {
  const publications = getPublications();
  const lead = getCurrentPeople().find(isLabLead);

  const personThemes = new Map<string, Map<string, number>>();
  for (const p of publications) {
    for (const a of p.authors) {
      if (!a.personId || a.personId === lead?.id) continue;
      const m = personThemes.get(a.personId) ?? new Map<string, number>();
      for (const t of p.themeIds) m.set(t, (m.get(t) ?? 0) + 1);
      personThemes.set(a.personId, m);
    }
  }
  const links = [...personThemes.entries()].flatMap(([personId, m]) =>
    [...m.entries()].map(([themeId, weight]) => ({ personId, themeId, weight }))
  );

  const venueCounts = new Map<string, number>();
  const themeVenue = new Map<string, number>();
  for (const p of publications) {
    if (!p.venueId) continue;
    venueCounts.set(p.venueId, (venueCounts.get(p.venueId) ?? 0) + 1);
    for (const t of p.themeIds) themeVenue.set(`${t}|${p.venueId}`, (themeVenue.get(`${t}|${p.venueId}`) ?? 0) + 1);
  }
  const pairs = [...themeVenue.entries()].map(([k, weight]) => {
    const [themeId, venueId] = k.split("|");
    return { themeId, venueId, weight };
  });

  const top = new Set(
    [...venueCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topVenues)
      .map(([id]) => id)
  );
  const venueLinks = pairs.filter((l) => top.has(l.venueId));

  const best = new Map<string, { themeId: string; weight: number }>();
  for (const l of pairs) {
    const cur = best.get(l.venueId);
    if (!cur || l.weight > cur.weight) best.set(l.venueId, l);
  }
  const venueGroup = new Map<string, VenueGroup>(
    [...best.entries()].map(([venueId, b]) => [venueId, b.themeId === "eda" ? "eda" : "other"])
  );

  return { links, venueLinks, venueGroup };
}
