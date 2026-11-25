"use client";

// "These papers look like yours" (SPEC.md §9.2–§9.3).
//
// Shown on a member's home page — including before their profile is approved, using the name
// on their roster entry. Suggestions come from lib/content/suggestions.ts. Nothing is linked
// until the member ticks it; ambiguous matches (an initial another member shares) are listed
// but never pre-ticked. Ticked papers go out as ONE submission in which each file differs
// from the live one by a single inserted `personId:` line — the only edit the Worker lets a
// member make to a paper that does not name them yet. Review still applies.
import { useMemo, useState } from "react";
import { suggestPublicationsForPerson, type AuthorSlotSuggestion } from "@/lib/content/suggestions";
import { api, type Identity, type QueueItem, type Snapshot } from "@/lib/studio/api";
import { entityByKey, filePathFor } from "@/lib/studio/entities";
import { insertSelfLink } from "@/lib/studio/self-link";
import { pendingFor } from "@/lib/studio/submissions";
import { ActionButton, Notice } from "./notice";

const CONFIDENCE_LABEL: Record<AuthorSlotSuggestion["confidence"], string> = {
  exact: "full name",
  alias: "your alias",
  initial: "initials",
};

const SHOWN = 12;

export function ClaimPapers({
  identity,
  snapshot,
  name,
  aliases,
  queue,
  onSubmitted,
}: {
  identity: Identity;
  snapshot: Snapshot;
  /** The member's name — from their profile, or their roster entry before it exists. */
  name: string;
  aliases?: string[];
  queue: QueueItem[];
  onSubmitted: (pr: { number: number; url: string }) => void;
}) {
  const personId = identity.personId;
  const pubEntity = entityByKey("publications");

  const suggestions = useMemo(() => {
    if (!personId || !pubEntity) return [];
    const people = snapshot.content.people.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases }));
    return suggestPublicationsForPerson({ id: personId, name, aliases }, snapshot.content.publications, people)
      // A paper already waiting in a submission is not offered twice.
      .filter((s) => !pendingFor(queue, filePathFor(pubEntity, s.publicationId)));
  }, [personId, name, aliases, snapshot, queue, pubEntity]);

  const safe = (s: AuthorSlotSuggestion) => s.confidence !== "initial" && s.alsoCouldBe.length === 0;
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(suggestions.filter(safe).map((s) => s.publicationId)));
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  if (!personId || !pubEntity || suggestions.length === 0) return null;

  const visible = showAll ? suggestions : suggestions.slice(0, SHOWN);
  const toggle = (id: string) =>
    setTicked((t) => {
      const next = new Set(t);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function send() {
    if (!pubEntity || !personId) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const chosen = suggestions.filter((s) => ticked.has(s.publicationId));
      const files = await Promise.all(
        chosen.map(async (s) => {
          const path = filePathFor(pubEntity, s.publicationId);
          const { content } = await api.file(path);
          return { path, content: insertSelfLink(content, s.authorIndex, personId) };
        })
      );
      const res = await api.submit({
        title: `Link ${chosen.length} paper${chosen.length === 1 ? "" : "s"} to ${name}`,
        summary:
          `${name} claimed these author entries as their own:\n\n` +
          chosen.map((s) => `- "${s.authorName}" on ${s.title}${s.year ? ` (${s.year})` : ""} — ${CONFIDENCE_LABEL[s.confidence]} match`).join("\n"),
        files,
      });
      setTicked(new Set());
      onSubmitted(res.pr);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not send these for review. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-sm border border-border p-4">
      <div>
        <h3 className="text-[15px] font-bold tracking-tight text-foreground">
          {suggestions.length} paper{suggestions.length === 1 ? "" : "s"} that look like yours
        </h3>
        <p className="mt-0.5 text-[12.5px] text-text-faint">
          Tick the ones you wrote. Linked papers show up on your profile. Ones that could also be a lab-mate are left for you to decide.
        </p>
      </div>
      {failure && <Notice kind="error" title={failure} />}
      <ul className="divide-y divide-hairline">
        {visible.map((s) => (
          <li key={s.publicationId}>
            <label className="flex cursor-pointer items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={ticked.has(s.publicationId)}
                onChange={() => toggle(s.publicationId)}
                className="mt-1 size-4 shrink-0 accent-foreground"
              />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-[13.5px] leading-snug text-foreground">{s.title}</span>
                <span className="block font-mono text-[11px] text-text-faint">
                  as “{s.authorName}”{s.year ? ` · ${s.year}` : ""} · {CONFIDENCE_LABEL[s.confidence]} match
                  {s.alsoCouldBe.length > 0 && ` · could also be ${s.alsoCouldBe.join(", ")}`}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton primary disabled={busy || ticked.size === 0} onClick={() => void send()}>
          {busy ? "Sending…" : `Link ${ticked.size} paper${ticked.size === 1 ? "" : "s"} for approval`}
        </ActionButton>
        {suggestions.length > SHOWN && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="font-mono text-[11px] text-text-faint hover:text-foreground">
            {showAll ? "Show fewer" : `Show all ${suggestions.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
