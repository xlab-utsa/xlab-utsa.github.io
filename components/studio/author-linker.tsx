"use client";

// Bulk author linking — the tool that fixes the actual problem in this content set.
//
// `authors[].personId` is optional, so an unlinked lab member is valid data. No validator can
// ever flag it, and 81% of author entries carry no link because nothing ever asked. Fixing
// that one publication at a time is 300 review cycles.
//
// The design principle is the one that runs through all of this: SUGGEST, never decide. The
// matcher groups author strings and proposes a person; a human confirms or overrides every
// row; the whole batch then goes through the normal submission → CI → approval path like any
// other change. An initials-only match ("J. Xiong") is genuinely ambiguous and is never
// pre-selected as if it were certain.
import { useMemo, useState } from "react";
import { api, type Snapshot } from "@/lib/studio/api";
import { entityByKey, filePathFor } from "@/lib/studio/entities";
import { serializeRecord } from "@/lib/studio/records";
import { authorKey, matchAuthorToPeople, type MatchConfidence } from "@/lib/content/matching";

type Rec = Record<string, unknown>;

interface Occurrence {
  publicationId: string;
  authorIndex: number;
  /** The exact string as written in that record. */
  name: string;
}

interface Group {
  key: string;
  /** The most common spelling, shown as the row's label. */
  display: string;
  variants: string[];
  occurrences: Occurrence[];
  suggestedPersonId?: string;
  suggestedPersonName?: string;
  confidence?: MatchConfidence;
  /** More than one lab member could be meant — a machine must not choose. */
  ambiguous: string[];
}

/** Every unlinked author string in the publication set, grouped by who it probably is. */
function buildGroups(snapshot: Snapshot): Group[] {
  const people = snapshot.content.people.map((p) => ({ id: p.id, name: p.name }));
  type Bucket = { occurrences: Occurrence[]; spellings: Map<string, number> };
  const map = new Map<string, Bucket>();

  for (const publication of snapshot.content.publications) {
    publication.authors.forEach((author, authorIndex) => {
      if (author.personId) return;
      const key = authorKey(author.name);
      if (!key.replace("|", "")) return;
      const entry: Bucket = map.get(key) ?? { occurrences: [], spellings: new Map() };
      entry.occurrences.push({ publicationId: publication.id, authorIndex, name: author.name });
      entry.spellings.set(author.name, (entry.spellings.get(author.name) ?? 0) + 1);
      map.set(key, entry);
    });
  }

  return [...map.entries()]
    .map(([key, entry]) => {
      const variants = [...entry.spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
      const { match, candidates } = matchAuthorToPeople(variants[0], people);
      return {
        key,
        display: variants[0],
        variants,
        occurrences: entry.occurrences,
        suggestedPersonId: match?.personId,
        suggestedPersonName: match?.personName,
        confidence: match?.confidence,
        ambiguous: match ? [] : candidates.map((c) => c.personId),
      };
    })
    .sort((a, b) => b.occurrences.length - a.occurrences.length);
}

export function AuthorLinker({
  snapshot,
  onSubmitted,
}: {
  snapshot: Snapshot;
  onSubmitted: (pr: { number: number; url: string }) => void;
}) {
  const groups = useMemo(() => buildGroups(snapshot), [snapshot]);
  const suggested = useMemo(
    () => groups.filter((g) => g.suggestedPersonId || g.ambiguous.length > 0),
    [groups]
  );

  const [showAll, setShowAll] = useState(false);
  /** groupKey → personId the human has chosen. Absent means "leave unlinked". */
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [expanded, setExpanded] = useState<string>();

  const visible = showAll ? groups : suggested;
  const chosen = Object.entries(choices).filter(([, personId]) => personId);

  const affected = useMemo(() => {
    const set = new Set<string>();
    for (const [key] of chosen) {
      const group = groups.find((g) => g.key === key);
      for (const occurrence of group?.occurrences ?? []) set.add(occurrence.publicationId);
    }
    return set;
  }, [chosen, groups]);

  const occurrenceCount = chosen.reduce(
    (n, [key]) => n + (groups.find((g) => g.key === key)?.occurrences.length ?? 0),
    0
  );

  async function apply() {
    const entity = entityByKey("publications");
    if (!entity || chosen.length === 0) return;
    setBusy(true);
    setFailure(undefined);
    try {
      // Build the edits per publication first, so a paper with two newly linked authors is
      // written once rather than twice.
      const edits = new Map<string, Map<number, string>>();
      for (const [key, personId] of chosen) {
        const group = groups.find((g) => g.key === key);
        for (const occurrence of group?.occurrences ?? []) {
          const perPublication = edits.get(occurrence.publicationId) ?? new Map<number, string>();
          perPublication.set(occurrence.authorIndex, personId);
          edits.set(occurrence.publicationId, perPublication);
        }
      }

      const files = [...edits.entries()].map(([publicationId, byIndex]) => {
        const original = snapshot.content.publications.find((p) => p.id === publicationId) as unknown as Rec;
        const authors = (original.authors as Rec[]).map((author, i) =>
          byIndex.has(i) ? { ...author, personId: byIndex.get(i) } : author
        );
        return {
          path: filePathFor(entity, publicationId),
          content: serializeRecord(entity, { ...original, authors }),
        };
      });

      const names = chosen
        .map(([, personId]) => snapshot.content.people.find((p) => p.id === personId)?.name ?? personId)
        .filter((v, i, a) => a.indexOf(v) === i);

      const res = await api.submit({
        title: `Link ${occurrenceCount} author entries to ${names.length} lab member${names.length === 1 ? "" : "s"}`,
        summary:
          `Bulk author linking from Studio.\n\n` +
          chosen
            .map(([key, personId]) => {
              const group = groups.find((g) => g.key === key);
              const person = snapshot.content.people.find((p) => p.id === personId);
              return `- "${group?.display}" (${group?.occurrences.length} occurrences) → ${person?.name ?? personId}`;
            })
            .join("\n"),
        files,
      });
      setChoices({});
      onSubmitted(res.pr);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  if (groups.length === 0) {
    return <p className="text-sm text-brand-strong">Every author entry is already linked.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Link authors to people</h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-text-faint">
          {groups.length} distinct author names across the publication set carry no link to a person
          record. Most are external co-authors and should stay that way — linking matters for lab
          members, because it is what makes a paper appear on their profile. Nothing is applied
          until you choose a person and submit, and the batch goes through review like any other
          change.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowAll(false)}
          className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] ${
            !showAll ? "border-brand text-brand-strong" : "border-border text-text-faint"
          }`}
        >
          Likely lab members ({suggested.length})
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] ${
            showAll ? "border-brand text-brand-strong" : "border-border text-text-faint"
          }`}
        >
          All unlinked names ({groups.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-text-faint">
          No unlinked author name resembles anyone currently on the people list.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["author string", "papers", "link to", ""].map((c) => (
                  <th
                    key={c}
                    className="py-2 pr-3 font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((group) => (
                <GroupRow
                  key={group.key}
                  group={group}
                  snapshot={snapshot}
                  value={choices[group.key] ?? ""}
                  onChange={(personId) => setChoices((c) => ({ ...c, [group.key]: personId }))}
                  expanded={expanded === group.key}
                  onToggle={() => setExpanded(expanded === group.key ? undefined : group.key)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {failure && (
        <p className="rounded-sm border border-brand-orange/40 bg-brand-orange/5 px-3 py-2 text-sm text-brand-orange">
          {failure}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          onClick={() => void apply()}
          disabled={busy || chosen.length === 0}
          className="rounded-sm bg-invert-bg px-4 py-2 font-mono text-[11px] font-bold tracking-wider text-invert-fg uppercase disabled:opacity-40"
        >
          {busy ? "Submitting…" : `Submit ${occurrenceCount} link${occurrenceCount === 1 ? "" : "s"}`}
        </button>
        {chosen.length > 0 && (
          <p className="font-mono text-[11px] text-text-faint">
            {affected.size} publication{affected.size === 1 ? "" : "s"} will change
          </p>
        )}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  snapshot,
  value,
  onChange,
  expanded,
  onToggle,
}: {
  group: Group;
  snapshot: Snapshot;
  value: string;
  onChange: (personId: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-hairline align-top hover:bg-bg-alt">
        <td className="py-2 pr-3">
          <span className="text-foreground">{group.display}</span>
          {group.variants.length > 1 && (
            <span className="ml-2 font-mono text-[10.5px] text-text-placeholder">
              also written {group.variants.slice(1).join(", ")}
            </span>
          )}
          {group.suggestedPersonName && (
            <p className="mt-0.5 font-mono text-[10.5px] text-text-faint">
              looks like {group.suggestedPersonName}
              {group.confidence === "initial" && " — initials only, confirm before linking"}
            </p>
          )}
          {group.ambiguous.length > 1 && (
            <p className="mt-0.5 font-mono text-[10.5px] text-brand-orange">
              ambiguous: could be {group.ambiguous.join(" or ")}
            </p>
          )}
        </td>
        <td className="py-2 pr-3">
          <button onClick={onToggle} className="font-mono text-[11px] text-text-faint hover:text-foreground">
            {group.occurrences.length} {expanded ? "▾" : "▸"}
          </button>
        </td>
        <td className="py-2 pr-3">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-sm border border-border bg-background px-2 py-1 text-[12.5px]"
          >
            <option value="">— leave unlinked —</option>
            {snapshot.content.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2">
          {group.suggestedPersonId && value !== group.suggestedPersonId && (
            <button
              onClick={() => onChange(group.suggestedPersonId!)}
              className="font-mono text-[11px] text-brand-strong hover:underline"
            >
              use suggestion
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-hairline">
          <td colSpan={4} className="bg-bg-alt px-3 py-2">
            <ul className="space-y-0.5">
              {group.occurrences.slice(0, 40).map((occurrence, i) => {
                const publication = snapshot.content.publications.find(
                  (p) => p.id === occurrence.publicationId
                );
                return (
                  <li key={i} className="font-mono text-[11px] leading-snug text-text-faint">
                    {publication?.year ?? "n.d."} · {publication?.title ?? occurrence.publicationId}
                  </li>
                );
              })}
              {group.occurrences.length > 40 && (
                <li className="font-mono text-[11px] text-text-placeholder">
                  … +{group.occurrences.length - 40} more
                </li>
              )}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
