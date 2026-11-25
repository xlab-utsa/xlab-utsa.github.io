"use client";

// Work → people suggestions inside the record editor (SPEC.md §9.2).
//
//   * Publication: for each unlinked author, the lab members the name could be. One click
//     links a suggestion; "Link the clear matches" links only those preselect() deems safe.
//   * Project: lab members who authored the project's linked papers but are not listed as
//     contributors yet.
//
// It only edits the form's state — nothing is saved until the person submits the form,
// which then goes through review like any other change.
import { useMemo } from "react";
import {
  suggestContributorsForProject,
  suggestPeopleForAuthors,
  type LinkConfidence,
} from "@/lib/content/suggestions";
import type { Snapshot } from "@/lib/studio/api";
import { ActionButton } from "./notice";

type Rec = Record<string, unknown>;
type Author = { name: string; personId?: string };

const CONFIDENCE: Record<LinkConfidence, string> = { exact: "full name", alias: "alias", initial: "initials" };

const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px] text-foreground transition-colors hover:border-foreground";

export function LinkSuggestions({
  entityKey,
  record,
  snapshot,
  onChange,
}: {
  entityKey: string;
  record: Rec;
  snapshot: Snapshot;
  onChange: (patch: Rec) => void;
}) {
  const people = useMemo(
    () => snapshot.content.people.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases })),
    [snapshot]
  );

  if (entityKey === "publications") {
    const authors = (Array.isArray(record.authors) ? record.authors : []) as Author[];
    const rows = suggestPeopleForAuthors(authors, people);
    if (rows.length === 0) return null;

    const link = (pairs: { index: number; personId: string }[]) => {
      const next = authors.map((a, i) => {
        const hit = pairs.find((p) => p.index === i);
        return hit ? { ...a, personId: hit.personId } : a;
      });
      onChange({ authors: next });
    };
    // "Clear" means a full-name or alias match with no rival. An initials-only match stays a
    // one-at-a-time click: "Y. Hu" on a 2007 paper is very often somebody else.
    const clear = rows
      .filter((r) => r.suggested && r.suggested.confidence !== "initial")
      .map((r) => ({ index: r.authorIndex, personId: r.suggested!.personId }));

    return (
      <Panel title="Lab members among the authors" hint="Linking an author puts this paper on that person's profile.">
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.authorIndex} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="min-w-[120px] font-mono text-text-faint">“{row.authorName}”</span>
              <span className="text-text-faint">could be</span>
              {row.candidates.map((c) => (
                <button key={c.personId} type="button" className={chip} onClick={() => link([{ index: row.authorIndex, personId: c.personId }])}>
                  {c.personName}
                  <span className="font-mono text-[10px] text-text-faint">{CONFIDENCE[c.confidence]}</span>
                </button>
              ))}
            </li>
          ))}
        </ul>
        {clear.length > 0 && (
          <ActionButton onClick={() => link(clear)}>
            Link the {clear.length} clear match{clear.length === 1 ? "" : "es"}
          </ActionButton>
        )}
      </Panel>
    );
  }

  if (entityKey === "projects") {
    const project = {
      id: String(record.id ?? ""),
      title: String(record.title ?? ""),
      publicationIds: Array.isArray(record.publicationIds) ? (record.publicationIds as string[]) : [],
      contributors: Array.isArray(record.contributors) ? (record.contributors as string[]) : [],
    };
    const rows = suggestContributorsForProject(project, snapshot.content.publications, people);
    if (rows.length === 0) return null;
    const add = (ids: string[]) => onChange({ contributors: [...project.contributors, ...ids] });

    return (
      <Panel title="Possible contributors" hint="Lab members who authored this project's linked papers.">
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <button key={r.personId} type="button" className={chip} onClick={() => add([r.personId])}>
              + {r.personName}
              <span className="font-mono text-[10px] text-text-faint">
                {r.viaPublicationIds.length} paper{r.viaPublicationIds.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
        {rows.length > 1 && <ActionButton onClick={() => add(rows.map((r) => r.personId))}>Add all {rows.length}</ActionButton>}
      </Panel>
    );
  }

  return null;
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-sm border border-dashed border-border p-3">
      <div>
        <p className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">{title}</p>
        <p className="text-[12px] text-text-faint">{hint}</p>
      </div>
      {children}
    </div>
  );
}
