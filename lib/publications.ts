// /publications page helpers: tab order/labels, and the per-category secondary line
// (patent metadata / journal volume-issue / book-chapter details) that doesn't fit
// the fields common to every category. Common fields (title, authors, venue, year,
// location for conference/workshop, note, doi/url/pdfUrl) render directly in
// components/publication-entry.tsx.
import type { Publication, PublicationCategory } from "@/lib/content";

export const PUBLICATION_CATEGORIES: {
  key: PublicationCategory;
  label: string;
}[] = [
  { key: "patent", label: "Patents" },
  { key: "journal", label: "Journals" },
  { key: "conference", label: "Conferences" },
  { key: "workshop", label: "Workshops" },
  { key: "invited-paper", label: "Invited Papers" },
  { key: "book-chapter", label: "Book Chapters" },
];

export function getCategoryMetaLine(pub: Publication): string | undefined {
  switch (pub.category) {
    case "patent": {
      const parts: string[] = [];
      if (pub.patentNo) parts.push(`Patent No. ${pub.patentNo}`);
      else if (pub.docketNo) parts.push(`Docket No. ${pub.docketNo}`);
      else if (pub.applicationNo) parts.push(`Application No. ${pub.applicationNo}`);
      if (pub.jurisdiction) parts.push(pub.jurisdiction);
      if (pub.issuedDate) parts.push(`Issued ${pub.issuedDate}`);
      else if (pub.filedDate) parts.push(`Filed ${pub.filedDate}`);
      return parts.length ? parts.join(" · ") : undefined;
    }
    case "journal":
      return pub.volumeIssue;
    case "book-chapter": {
      if (!pub.book) return undefined;
      let line = `In: ${pub.book}`;
      if (pub.editors) line += `, edited by ${pub.editors}`;
      if (pub.publisher) line += ` (${pub.publisher})`;
      if (pub.onlineIsbn) line += ` · ISBN ${pub.onlineIsbn}`;
      return line;
    }
    default:
      return undefined;
  }
}
