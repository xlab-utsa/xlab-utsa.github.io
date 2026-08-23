import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// `new Date("2026-03-01")` parses as UTC midnight, then toLocaleDateString renders it
// in the local timezone — in any timezone behind UTC that rolls back to the previous
// day (Feb 28 instead of Mar 1). Appending a local-time component avoids the UTC
// interpretation entirely. Post.date is always a plain "YYYY-MM-DD" string.
export function formatPostDate(
  isoDate: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", options);
}
