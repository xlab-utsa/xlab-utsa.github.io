// Reading what a pending submission is about, from the PR body the Worker writes.
//
// The Worker records every submission's file list as a markdown bullet list
// ("Files changed:\n- `content/people/jane-doe.yaml`") in the pull request body. That is
// the only place the information lives without a database, and it is enough to answer the
// one question several screens need: "is there already a change waiting for this file?".
// Without that answer a member sees "Create my profile" again while their profile is
// awaiting review, and an admin can open a second roster PR that conflicts with the first.
"use client";

import type { QueueItem } from "./api";

/** Repo paths a submission touches, parsed from its PR body. */
export function filesChangedIn(item: Pick<QueueItem, "body">): string[] {
  const out: string[] = [];
  for (const match of item.body.matchAll(/^- `([^`\n]+)`/gm)) out.push(match[1]);
  return out;
}

/** The open submission (if any) that touches `path`. Oldest first, so it is the one that will be reviewed first. */
export function pendingFor<T extends Pick<QueueItem, "body" | "createdAt">>(
  queue: T[],
  path: string
): T | undefined {
  return [...queue]
    .filter((item) => filesChangedIn(item).includes(path))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

/** "2 hours ago"-style wording for a submission timestamp; falls back to the date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
