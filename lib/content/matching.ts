// Fuzzy text matching for the two comparisons this content set actually needs: recognising
// the same human behind two different author strings, and recognising the same paper behind
// two different titles.
//
// Deliberately conservative. Everything here SUGGESTS; nothing here decides. A match is
// offered to a person to confirm, or shown to a reviewer as context — it is never applied
// automatically and never fails a build on its own. The cost of a false positive (two
// distinct researchers merged into one) is far higher than the cost of a missed match.
//
// CLIENT-SAFE: pure functions, no fs, no node builtins.

/** Strip accents and case so "Müller" and "Muller" compare equal. */
function fold(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Surname particles that belong with the family name rather than being given names.
 * "Ludwig van Beethoven" has surname "van Beethoven", not "Beethoven".
 */
const PARTICLES = new Set([
  "van", "von", "de", "del", "della", "di", "da", "dos", "das", "du", "la", "le",
  "el", "al", "bin", "ibn", "ter", "ten", "op", "st",
]);

export interface ParsedName {
  /** The input with markers and honorifics removed, whitespace collapsed. */
  clean: string;
  given: string[];
  surname: string;
  /** True when the string carried "et al." — it stands for more people than it names. */
  hadEtAl: boolean;
}

/**
 * Pull an author string apart into given names and a surname.
 *
 * Handles the shapes that actually occur in this data: "J. Xiong", "Jinjun Xiong",
 * "Xiong, Jinjun", "J. Xiong et al.", and footnote markers left over from scraping.
 */
export function parseAuthorName(raw: string): ParsedName {
  let s = raw.normalize("NFKC").trim();

  const hadEtAl = /\bet\.?\s*al\.?/i.test(s);
  s = s.replace(/\bet\.?\s*al\.?/gi, " ");

  // Footnote markers, affiliation superscripts, and parentheticals from the scrape.
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/[*†‡§¶#^~]/g, " ");
  s = s.replace(/[¹²³⁰-₟]/g, " ");
  s = s.replace(/\b\d+\b/g, " ");
  s = s.replace(/^(?:dr|prof|professor|mr|ms|mrs)\.?\s+/i, "");
  s = s.replace(/\s*,\s*(?:phd|ph\.d\.?|md|jr\.?|sr\.?|iii|ii|iv)\s*$/i, "");
  s = s.replace(/\s+/g, " ").trim().replace(/^[,.;]+|[,.;]+$/g, "").trim();

  const clean = s;

  // "Xiong, Jinjun" — surname first. A single comma with content either side.
  const commaParts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  let tokens: string[];
  if (commaParts.length === 2) {
    tokens = [...commaParts[1].split(/\s+/), ...commaParts[0].split(/\s+/)].filter(Boolean);
  } else {
    tokens = clean.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  }

  if (tokens.length === 0) return { clean, given: [], surname: "", hadEtAl };
  if (tokens.length === 1) return { clean, given: [], surname: tokens[0], hadEtAl };

  let surnameStart = tokens.length - 1;
  while (surnameStart > 1 && PARTICLES.has(fold(tokens[surnameStart - 1]))) surnameStart -= 1;

  return {
    clean,
    given: tokens.slice(0, surnameStart),
    surname: tokens.slice(surnameStart).join(" "),
    hadEtAl,
  };
}

/**
 * A key that collapses spelling variants of the same author string so occurrences can be
 * counted together: "J. Xiong", "J Xiong", and "J. Xiong et al." all share one key.
 */
export function authorKey(raw: string): string {
  const { given, surname } = parseAuthorName(raw);
  const initials = given.map((g) => fold(g).replace(/[^a-z]/g, "").slice(0, 1)).filter(Boolean);
  return `${fold(surname).replace(/[^a-z ]/g, "")}|${initials.join("")}`;
}

export type MatchConfidence = "exact" | "initial";

export interface PersonLike {
  id: string;
  name: string;
}

export interface AuthorMatch {
  personId: string;
  personName: string;
  confidence: MatchConfidence;
}

export interface MatchResult {
  /** The single best candidate, when exactly one person matches. */
  match?: AuthorMatch;
  /** Every person the string could refer to. More than one means a human must choose. */
  candidates: AuthorMatch[];
}

/**
 * Find the lab member an author string refers to.
 *
 *   "exact"   — surname matches and a full given name matches ("Jinjun Xiong").
 *   "initial" — surname matches and only the first initial agrees ("J. Xiong"). This is the
 *               common case in citation strings and is genuinely ambiguous: it is offered as
 *               a suggestion for a person to confirm, never applied on its own.
 *
 * When more than one person matches, `match` is left undefined — an ambiguous author string
 * is precisely the case a machine must not resolve.
 */
export function matchAuthorToPeople(raw: string, people: PersonLike[]): MatchResult {
  const { given, surname } = parseAuthorName(raw);
  if (!surname) return { candidates: [] };
  const foldedSurname = fold(surname);
  const givenFolded = given.map(fold).filter(Boolean);

  const candidates: AuthorMatch[] = [];
  for (const person of people) {
    const parsed = parseAuthorName(person.name);
    if (fold(parsed.surname) !== foldedSurname) continue;

    const personGiven = parsed.given.map(fold).filter(Boolean);
    if (personGiven.length === 0 || givenFolded.length === 0) {
      // One side is a bare surname. Too weak to call a match on its own.
      continue;
    }

    const strip = (t: string) => t.replace(/\./g, "");
    const full = givenFolded.some((g) =>
      personGiven.some((p) => strip(g).length > 1 && strip(g) === strip(p))
    );
    if (full) {
      candidates.push({ personId: person.id, personName: person.name, confidence: "exact" });
      continue;
    }
    const initial = strip(givenFolded[0])[0] === strip(personGiven[0])[0];
    if (initial) {
      candidates.push({ personId: person.id, personName: person.name, confidence: "initial" });
    }
  }

  const exact = candidates.filter((c) => c.confidence === "exact");
  // One exact match wins outright; otherwise a single candidate of any strength is the match.
  if (exact.length === 1) return { match: exact[0], candidates };
  if (candidates.length === 1) return { match: candidates[0], candidates };
  return { candidates };
}

/**
 * Reduce a publication title to a comparison key: case, punctuation, and whitespace removed.
 *
 * Used to spot the same paper submitted twice — the most likely real corruption once several
 * members add their own co-authored papers independently. Two records with the same key are
 * flagged for a human; they are never merged automatically.
 */
export function titleKey(title: string): string {
  return fold(title)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
