// Link suggestions between people and their work, in BOTH directions (SPEC.md §9.2).
//
//   * Given a person — which unlinked author slots, and which projects, are probably theirs?
//   * Given a work   — which lab member is each author / contributor?
//
// Built on lib/content/matching.ts and the same rule that runs through it: everything here
// SUGGESTS, nothing DECIDES. Every suggestion carries a confidence and the list of other
// people it could also be, so the UI can refuse to pre-tick anything ambiguous.
//
// Each relation is stored on the work (authors[].personId, contributors[], authorIds[]); the
// "my papers" view is always computed. Posts carry no author *strings* to match against, so
// there is nothing to suggest for them from a name — they are linked by hand.
//
// CLIENT-SAFE: pure functions over plain records. Used by Studio, the validator and scripts.
import { matchAuthorToPeople, parseAuthorName, type MatchConfidence } from "./matching";

export interface PersonForMatch {
  id: string;
  name: string;
  aliases?: string[];
}

interface AuthorLike {
  name: string;
  personId?: string;
}

interface PublicationLike {
  id: string;
  title: string;
  year?: number;
  authors: AuthorLike[];
}

interface ProjectLike {
  id: string;
  title: string;
  publicationIds?: string[];
  contributors?: string[];
}

/** exact > alias > initial. An alias is a spelling the person confirmed, so it outranks an initial. */
export type LinkConfidence = MatchConfidence | "alias";
const RANK: Record<LinkConfidence, number> = { exact: 3, alias: 2, initial: 1 };

export interface PersonCandidate {
  personId: string;
  personName: string;
  confidence: LinkConfidence;
}

function normalize(s: string): string {
  return parseAuthorName(s).clean.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Every lab member an author string could refer to, strongest first. A person's aliases are
 * tried alongside their name: an author string identical to an alias is an "alias" match;
 * otherwise each alias goes through the same exact/initial matcher as the name.
 */
export function candidatesForAuthor(raw: string, people: PersonForMatch[]): PersonCandidate[] {
  const best = new Map<string, PersonCandidate>();
  const offer = (c: PersonCandidate) => {
    const cur = best.get(c.personId);
    if (!cur || RANK[c.confidence] > RANK[cur.confidence]) best.set(c.personId, c);
  };
  const key = normalize(raw);

  for (const person of people) {
    for (const spelling of [person.name, ...(person.aliases ?? [])]) {
      const isAlias = spelling !== person.name;
      if (isAlias && normalize(spelling) === key) {
        offer({ personId: person.id, personName: person.name, confidence: "alias" });
        continue;
      }
      const { candidates } = matchAuthorToPeople(raw, [{ id: person.id, name: spelling }]);
      for (const c of candidates) offer({ personId: person.id, personName: person.name, confidence: c.confidence });
    }
  }
  return [...best.values()].sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || a.personName.localeCompare(b.personName));
}

/**
 * The one person to pre-select, or undefined when a human must choose: a single candidate,
 * or one candidate strictly stronger than all others. An initials-only match is never
 * pre-selected when anyone else shares the surname and initial.
 */
export function preselect(candidates: PersonCandidate[]): PersonCandidate | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const [first, second] = candidates;
  return RANK[first.confidence] > RANK[second.confidence] && first.confidence !== "initial" ? first : undefined;
}

// --- person → work ------------------------------------------------------------------

export interface AuthorSlotSuggestion {
  publicationId: string;
  title: string;
  year?: number;
  authorIndex: number;
  authorName: string;
  confidence: LinkConfidence;
  /** Other lab members the same string could mean. Non-empty → never pre-tick. */
  alsoCouldBe: string[];
}

/**
 * Unlinked author slots that probably belong to `person`. A paper already linked to them in
 * another slot is skipped; so is a slot whose string some OTHER member matches more
 * strongly than this person does.
 */
export function suggestPublicationsForPerson(
  person: PersonForMatch,
  publications: PublicationLike[],
  people: PersonForMatch[]
): AuthorSlotSuggestion[] {
  const everyone = people.some((p) => p.id === person.id) ? people : [...people, person];
  const out: AuthorSlotSuggestion[] = [];

  for (const pub of publications) {
    if (pub.authors.some((a) => a.personId === person.id)) continue;
    let best: AuthorSlotSuggestion | undefined;
    pub.authors.forEach((author, authorIndex) => {
      if (author.personId) return;
      const candidates = candidatesForAuthor(author.name, everyone);
      const mine = candidates.find((c) => c.personId === person.id);
      if (!mine) return;
      const stronger = candidates.some((c) => c.personId !== person.id && RANK[c.confidence] > RANK[mine.confidence]);
      if (stronger) return;
      const suggestion: AuthorSlotSuggestion = {
        publicationId: pub.id,
        title: pub.title,
        year: pub.year,
        authorIndex,
        authorName: author.name,
        confidence: mine.confidence,
        alsoCouldBe: candidates.filter((c) => c.personId !== person.id).map((c) => c.personName),
      };
      if (!best || RANK[suggestion.confidence] > RANK[best.confidence]) best = suggestion;
    });
    if (best) out.push(best);
  }
  return out.sort(
    (a, b) => RANK[b.confidence] - RANK[a.confidence] || a.alsoCouldBe.length - b.alsoCouldBe.length || (b.year ?? 0) - (a.year ?? 0)
  );
}

export interface ProjectSuggestion {
  projectId: string;
  title: string;
  /** The linked publications that connect this person to the project. */
  viaPublicationIds: string[];
}

/** Projects whose linked papers list the person as an author, but which don't list them as a contributor. */
export function suggestProjectsForPerson(
  personId: string,
  projects: ProjectLike[],
  publications: PublicationLike[]
): ProjectSuggestion[] {
  const authored = new Set(publications.filter((p) => p.authors.some((a) => a.personId === personId)).map((p) => p.id));
  return projects
    .filter((proj) => !(proj.contributors ?? []).includes(personId))
    .map((proj) => ({
      projectId: proj.id,
      title: proj.title,
      viaPublicationIds: (proj.publicationIds ?? []).filter((id) => authored.has(id)),
    }))
    .filter((s) => s.viaPublicationIds.length > 0);
}

// --- work → person ------------------------------------------------------------------

export interface AuthorLinkSuggestion {
  authorIndex: number;
  authorName: string;
  candidates: PersonCandidate[];
  /** Safe to pre-select (see preselect()). */
  suggested?: PersonCandidate;
}

/** For each unlinked author of a work, the lab members it could be. Slots with no candidate are omitted. */
export function suggestPeopleForAuthors(authors: AuthorLike[], people: PersonForMatch[]): AuthorLinkSuggestion[] {
  const out: AuthorLinkSuggestion[] = [];
  authors.forEach((author, authorIndex) => {
    if (author.personId || !author.name?.trim()) return;
    const candidates = candidatesForAuthor(author.name, people);
    if (candidates.length) out.push({ authorIndex, authorName: author.name, candidates, suggested: preselect(candidates) });
  });
  return out;
}

/** Lab members who authored a project's linked papers but are not yet its contributors. */
export function suggestContributorsForProject(
  project: ProjectLike,
  publications: PublicationLike[],
  people: PersonForMatch[]
): { personId: string; personName: string; viaPublicationIds: string[] }[] {
  const linked = new Set(project.publicationIds ?? []);
  const already = new Set(project.contributors ?? []);
  const via = new Map<string, string[]>();
  for (const pub of publications) {
    if (!linked.has(pub.id)) continue;
    for (const a of pub.authors) {
      if (a.personId && !already.has(a.personId)) via.set(a.personId, [...(via.get(a.personId) ?? []), pub.id]);
    }
  }
  return [...via.entries()]
    .map(([personId, ids]) => ({ personId, personName: people.find((p) => p.id === personId)?.name ?? personId, viaPublicationIds: ids }))
    .sort((a, b) => b.viaPublicationIds.length - a.viaPublicationIds.length || a.personName.localeCompare(b.personName));
}

// --- integrity (used by the validator, §9.4) -----------------------------------------

/** Does this author string plausibly name this person (by name or alias)? */
export function authorFitsPerson(raw: string, person: PersonForMatch): boolean {
  return candidatesForAuthor(raw, [person]).length > 0;
}
