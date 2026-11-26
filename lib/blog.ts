import type { Post } from "@/lib/content";

/** Minutes to read a post's body, at about 220 words a minute (never less than one). */
export function readingMinutes(post: Post): number {
  const words = (post.body ?? "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
