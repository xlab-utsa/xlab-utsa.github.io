"use client";

// Publication lookup by DOI, via Crossref.
//
// Crossref is used specifically because it needs NO account, NO API key, and has no trial
// clock — it cannot expire or start billing, which is the standing constraint on every
// external dependency in this project. Requests are anonymous; Crossref asks only that
// callers identify themselves in a mailto for the "polite pool", which costs nothing.
//
// Failure here is always soft: if the lookup fails the user just types the fields in.

const POLITE = "mailto:noreply@xlab-utsa.github.io";

interface CrossrefWork {
  DOI?: string;
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  "container-title"?: string[];
  issued?: { "date-parts"?: number[][] };
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  type?: string;
  URL?: string;
  event?: { name?: string; location?: string };
}

export interface DoiResult {
  title?: string;
  authors: { name: string }[];
  venue?: string;
  year?: number;
  volumeIssue?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  /** Best guess at the publication category, for pre-selecting the form. */
  suggestedCategory?: "journal" | "conference" | "book-chapter";
  location?: string;
}

/** Accepts a bare DOI, a doi.org URL, or anything containing a DOI. */
export function extractDoi(input: string): string | undefined {
  const match = input.match(/10\.\d{4,9}\/[^\s"<>]+/);
  return match?.[0].replace(/[.,;)]+$/, "");
}

export async function fetchByDoi(input: string): Promise<DoiResult> {
  const doi = extractDoi(input);
  if (!doi) throw new Error("That does not look like a DOI.");

  const res = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}?${new URLSearchParams({ mailto: POLITE })}`
  );
  if (res.status === 404) throw new Error("Crossref has no record of that DOI.");
  if (!res.ok) throw new Error(`Crossref lookup failed (${res.status}).`);

  const work = ((await res.json()) as { message: CrossrefWork }).message;

  const authors = (work.author ?? []).map((a) => ({
    name: a.name ?? [a.given, a.family].filter(Boolean).join(" "),
  }));

  const year = work.issued?.["date-parts"]?.[0]?.[0];
  const volumeIssue = [
    work.volume ? `Vol. ${work.volume}` : undefined,
    work.issue ? `No. ${work.issue}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");

  const type = work.type ?? "";
  const suggestedCategory =
    type.includes("proceedings") ? "conference" : type.includes("chapter") ? "book-chapter" : "journal";

  return {
    title: work.title?.[0],
    authors: authors.length ? authors : [],
    venue: work["container-title"]?.[0] ?? work.event?.name,
    year: typeof year === "number" ? year : undefined,
    volumeIssue: volumeIssue || undefined,
    doi,
    url: work.URL,
    publisher: work.publisher,
    suggestedCategory,
    location: work.event?.location,
  };
}
