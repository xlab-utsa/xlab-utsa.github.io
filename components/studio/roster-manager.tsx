"use client";

// Who can sign in, and how they get in.
//
// Because no email provider is configured, onboarding works by handing someone a link:
// add them here, get the change approved, generate a link, send it however you already talk
// to them. Member links are single-use and expire, so they are safe to send over chat.
//
// Roster edits go through the same review flow as content — they are a pull request, not a
// direct write — which is what keeps "who had access when" answerable from git history.
// Two consequences this screen has to be honest about:
//
//   - A change takes effect only once its PR is approved. Until then the person is not on
//     the roster the Worker reads, so "Invite link" cannot work for them yet.
//   - Each PR rewrites the whole file. Two open roster PRs would conflict, so while one is
//     waiting this screen refuses to open another.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ROSTER_PATH, type QueueItem, type RosterEntry, type Snapshot } from "@/lib/studio/api";
import { rosterIssues, type RosterIssue } from "@/lib/access/roster";
import { slugify } from "@/lib/studio/entities";
import { pendingFor, relativeTime } from "@/lib/studio/submissions";
import { ActionButton, Notice, type NoticeKind } from "./notice";

const input =
  "w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand disabled:opacity-60";
const ROLES = ["admin", "editor", "member"] as const;

const ROLE_HELP: Record<RosterEntry["role"], string> = {
  admin: "Everything, including managing this roster and approving submissions.",
  editor: "Can edit all content and approve submissions. Cannot manage the roster.",
  member: "Edits only their own profile; can propose new publications, awards and posts.",
};

type Flash = { kind: NoticeKind; title: string; body?: string };

export function RosterManager({ snapshot, onOpenQueue }: { snapshot: Snapshot; onOpenQueue: () => void }) {
  /** What the gate returned — the roster that is actually in force. */
  const [loaded, setLoaded] = useState<RosterEntry[]>();
  /** The rows as edited on screen. */
  const [members, setMembers] = useState<RosterEntry[]>();
  const [pendingPr, setPendingPr] = useState<QueueItem>();
  /**
   * Rows that exist only in a submission made from this screen, so a just-added person is
   * visible as "waiting for approval" rather than vanishing until the PR merges. Known only
   * for this page load — after a reload the banner above still says a change is pending.
   */
  const [pendingRows, setPendingRows] = useState<RosterEntry[]>([]);
  const [error, setError] = useState<string>();
  const [flash, setFlash] = useState<Flash>();
  const [busy, setBusy] = useState(false);
  const [rowIssues, setRowIssues] = useState<RosterIssue[]>([]);
  const [invite, setInvite] = useState<{
    name: string;
    email: string;
    link: string;
    days: number;
    reusable: boolean;
  }>();
  const [draft, setDraft] = useState<RosterEntry>({
    email: "",
    name: "",
    role: "member",
    active: true,
  });

  const load = useCallback(async () => {
    try {
      const [roster, queue] = await Promise.all([api.roster(), api.queue()]);
      setLoaded(roster.members);
      setMembers(roster.members);
      const pending = pendingFor(queue.queue, ROSTER_PATH);
      setPendingPr(pending);
      if (!pending) setPendingRows([]);
      setRowIssues([]);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the roster.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const dirty = useMemo(
    () => Boolean(loaded && members && JSON.stringify(loaded) !== JSON.stringify(members)),
    [loaded, members]
  );

  /** Validate, and if clean, open the PR. Returns true on success. */
  async function saveRoster(next: RosterEntry[], title: string): Promise<boolean> {
    const issues = rosterIssues({ _comment: ROSTER_COMMENT, members: next });
    if (issues.length) {
      setRowIssues(issues);
      setFlash({
        kind: "error",
        title: "Fix the highlighted rows before submitting",
        body: issues.filter((i) => i.index === undefined).map((i) => i.message).join(" "),
      });
      return false;
    }
    setRowIssues([]);
    setBusy(true);
    try {
      // Preserve the explanatory _comment block that documents what each role means —
      // it is the only in-repo documentation of this file.
      const body = { _comment: ROSTER_COMMENT, members: next };
      const res = await api.submit({
        title,
        summary: "Roster change submitted from Studio.",
        files: [{ path: ROSTER_PATH, content: JSON.stringify(body, null, 2) + "\n" }],
      });
      setFlash({
        kind: "ok",
        title: `Submitted as #${res.pr.number}`,
        body: "Approve it in the review queue once the automatic checks pass. The change takes effect within a minute of approval; invite links work from then on.",
      });
      setPendingRows(next.filter((m) => !loaded?.some((x) => x.email.toLowerCase() === m.email.toLowerCase())));
      await load();
      return true;
    } catch (err) {
      setFlash({ kind: "error", title: "Could not submit the roster change", body: err instanceof Error ? err.message : undefined });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function makeInvite(entry: RosterEntry) {
    setFlash(undefined);
    try {
      const res = await api.invite(entry.email);
      setInvite({ name: res.name, email: entry.email, link: res.link, days: res.expiresInDays, reusable: res.reusable });
    } catch (err) {
      setFlash({
        kind: "error",
        title: `Could not create a link for ${entry.name}`,
        body: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function revokeInvites(entry: RosterEntry) {
    if (
      !confirm(
        `Invalidate every outstanding sign-in link for ${entry.name}?\n\nAnyone still holding one will not be able to use it. Sessions already signed in are unaffected.`
      )
    )
      return;
    try {
      const res = await api.revokeInvites(entry.email);
      setInvite(undefined);
      setFlash({
        kind: "ok",
        title: res.revoked === 0 ? `No outstanding links for ${entry.name}` : `Revoked ${res.revoked} link${res.revoked === 1 ? "" : "s"} for ${entry.name}`,
      });
    } catch (err) {
      setFlash({ kind: "error", title: "Could not revoke links", body: err instanceof Error ? err.message : undefined });
    }
  }

  if (error) return <p className="text-sm text-brand-orange">{error}</p>;
  if (!members || !loaded) return <p className="text-sm text-text-faint">Loading roster…</p>;

  const locked = Boolean(pendingPr) || busy;
  const unlinked = snapshot.content.people.filter((p) => !members.some((m) => m.personId === p.id));
  const issueFor = (index: number, field: string) =>
    rowIssues.find((i) => i.index === index && i.field === field)?.message;
  const rowHasIssue = (index: number) => rowIssues.some((i) => i.index === index);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Roster</h2>
        <p className="mt-1 text-[12.5px] text-text-faint">
          Anyone listed here can sign in. Changes go through review like everything else.
        </p>
      </div>

      {pendingPr && (
        <Notice
          kind="warn"
          title={`Roster change #${pendingPr.number} is waiting for approval`}
          actions={
            <button type="button" onClick={onOpenQueue} className="font-mono text-[11px] text-brand-strong hover:underline">
              Open the review queue →
            </button>
          }
        >
          Sent {relativeTime(pendingPr.createdAt)}. Approve it (or return it) before making
          another change — each change rewrites the whole roster, and two at once would
          conflict. Invite links for people added in that change work once it is approved.
        </Notice>
      )}

      {flash && (
        <Notice kind={flash.kind} title={flash.title} onDismiss={() => setFlash(undefined)}>
          {flash.body}
        </Notice>
      )}

      {invite && (
        <div className="rounded-sm border border-brand-soft-border bg-brand-soft-bg p-3">
          <p className="text-sm font-medium text-brand-strong">Sign-in link for {invite.name}</p>
          {invite.reusable ? (
            <p className="mt-1 text-[12px] text-text-faint">
              <strong className="text-brand-orange">Works repeatedly</strong> for {invite.days} days
              — admin links are reusable, so testing it or a mail scanner opening it will not burn
              it. Treat it like a password: send it privately, and use{" "}
              <strong>Revoke links</strong> if it ever goes somewhere it should not.
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-text-faint">
              Works once, expires in {invite.days} days. Send it however you normally contact them
              — they open it, and they are in.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input readOnly value={invite.link} className={`${input} font-mono text-[11px]`} onFocus={(e) => e.target.select()} />
            <button
              onClick={() => void navigator.clipboard.writeText(invite.link)}
              className="shrink-0 rounded-sm bg-invert-bg px-3 font-mono text-[11px] font-bold tracking-wider text-invert-fg uppercase"
            >
              Copy
            </button>
            <button onClick={() => setInvite(undefined)} className="shrink-0 px-2 text-text-faint">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["Name", "Email", "Role", "Owns profile", ""].map((h) => (
                <th key={h} className="py-2 pr-3 font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const saved = loaded.find((x) => x.email.toLowerCase() === m.email.toLowerCase());
              const changed = JSON.stringify(saved) !== JSON.stringify(m);
              return (
                <tr key={m.email} className={`border-b border-hairline ${rowHasIssue(i) ? "bg-brand-orange/5" : ""}`}>
                  <td className="py-2 pr-3">
                    <span className={m.active ? "text-foreground" : "text-text-placeholder line-through"}>{m.name}</span>
                    {changed && <span className="ml-1.5 font-mono text-[10px] text-brand-orange">unsaved</span>}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11.5px] text-text-faint">{m.email}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={m.role}
                      disabled={locked}
                      onChange={(e) =>
                        setMembers(members.map((x, j) => (j === i ? { ...x, role: e.target.value as RosterEntry["role"] } : x)))
                      }
                      className="rounded-sm border border-border bg-background px-1.5 py-1 text-[12.5px] disabled:opacity-60"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {issueFor(i, "role") && <p className="mt-0.5 text-[11px] text-brand-orange">{issueFor(i, "role")}</p>}
                  </td>
                  <td className="py-2 pr-3">
                    {/*
                      A free-text id, not a dropdown of existing people: a member's profile
                      legitimately does not exist yet — they create it themselves on first
                      sign-in — so a picker over current records could not express it.
                    */}
                    <input
                      value={m.personId ?? ""}
                      disabled={locked}
                      placeholder="—"
                      onChange={(e) =>
                        setMembers(members.map((x, j) => (j === i ? { ...x, personId: e.target.value.trim() || undefined } : x)))
                      }
                      className="w-[170px] rounded-sm border border-border bg-background px-1.5 py-1 font-mono text-[12px] disabled:opacity-60"
                    />
                    {m.personId && !profileExists(snapshot, m.personId) && !issueFor(i, "personId") && (
                      <span className="ml-1.5 font-mono text-[10px] text-text-placeholder">not created yet</span>
                    )}
                    {issueFor(i, "personId") && <p className="mt-0.5 text-[11px] text-brand-orange">{issueFor(i, "personId")}</p>}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => void makeInvite(m)}
                      disabled={!m.active || !saved || changed}
                      title={
                        !saved
                          ? "Approve the roster change first — this person is not on the roster the gate reads yet"
                          : changed
                            ? "Submit (and approve) the change to this row first"
                            : !m.active
                              ? "Reactivate this person to invite them"
                              : "Create a sign-in link to send them"
                      }
                      className="font-mono text-[11px] text-brand-strong hover:underline disabled:text-text-placeholder disabled:no-underline"
                    >
                      Invite link
                    </button>
                    <button
                      onClick={() => void revokeInvites(m)}
                      title="Invalidate every outstanding sign-in link for this person"
                      className="ml-3 font-mono text-[11px] text-text-faint hover:text-brand-orange"
                    >
                      Revoke links
                    </button>
                    <button
                      disabled={locked}
                      onClick={() => setMembers(members.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))}
                      className="ml-3 font-mono text-[11px] text-text-faint hover:text-brand-orange disabled:opacity-60"
                    >
                      {m.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {pendingPr &&
              pendingRows.map((m) => (
                <tr key={`pending:${m.email}`} className="border-b border-hairline opacity-70">
                  <td className="py-2 pr-3 text-foreground">{m.name}</td>
                  <td className="py-2 pr-3 font-mono text-[11.5px] text-text-faint">{m.email}</td>
                  <td className="py-2 pr-3 font-mono text-[12.5px] text-text-faint">{m.role}</td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-text-faint">{m.personId ?? "—"}</td>
                  <td className="py-2 text-right font-mono text-[11px] whitespace-nowrap text-brand-orange">
                    waiting for approval (#{pendingPr.number})
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          primary
          onClick={() => void saveRoster(members, "Update Studio roster")}
          disabled={locked || !dirty}
          title={!dirty ? "Nothing has changed" : undefined}
        >
          {busy ? "Submitting…" : "Submit roster changes"}
        </ActionButton>
        {dirty && !busy && (
          <button
            type="button"
            onClick={() => {
              setMembers(loaded);
              setRowIssues([]);
            }}
            className="font-mono text-[11px] text-text-faint hover:text-foreground"
          >
            Discard edits
          </button>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <h3 className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">Add someone</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            className={input}
            placeholder="Name"
            disabled={locked}
            value={draft.name}
            onChange={(e) => {
              const name = e.target.value;
              // Keep the id in step with the name until it is edited by hand, so the common
              // case needs no thought and the unusual case is still possible.
              const auto = draft.personId === undefined || draft.personId === slugify(draft.name);
              setDraft({ ...draft, name, ...(auto ? { personId: slugify(name) || undefined } : {}) });
            }}
          />
          <input
            className={input}
            placeholder="Email"
            type="email"
            disabled={locked}
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <select
            className={input}
            disabled={locked}
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value as RosterEntry["role"] })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            className={`${input} font-mono text-[12px]`}
            placeholder="profile-id (auto)"
            disabled={locked}
            value={draft.personId ?? ""}
            onChange={(e) => setDraft({ ...draft, personId: e.target.value.trim() || undefined })}
          />
        </div>
        <p className="text-[11.5px] text-text-faint">{ROLE_HELP[draft.role]}</p>
        {/*
          The profile id is filled in automatically from the name and does NOT need to
          already exist. That is the whole point: the member creates their own profile at
          this id on first sign-in, so adding someone is one action instead of three
          (stub profile -> link -> invite).
        */}
        {draft.role === "member" && (
          <p className="text-[11.5px] text-text-faint">
            {profileExists(snapshot, draft.personId) ? (
              <>
                Links to the existing profile <span className="font-mono">{draft.personId}</span>.
              </>
            ) : (
              <>
                They will create their own profile at{" "}
                <span className="font-mono">{draft.personId || "…"}</span> when they first sign in.
              </>
            )}
          </p>
        )}
        {unlinked.length > 0 && draft.role === "member" && (
          <p className="text-[11.5px] text-text-faint">
            {unlinked.length} existing profile{unlinked.length === 1 ? "" : "s"} not linked to anyone yet — type its id above to link instead of creating a new one.
          </p>
        )}
        <ActionButton
          disabled={locked}
          onClick={() => {
            const entry: RosterEntry = {
              ...draft,
              name: draft.name.trim(),
              email: draft.email.trim(),
              personId: draft.personId?.trim() || undefined,
            };
            if (!entry.email || !entry.name) {
              setFlash({ kind: "error", title: "Name and email are required" });
              return;
            }
            if (dirty) {
              setFlash({
                kind: "warn",
                title: "Submit or discard your row edits first",
                body: "Adding someone sends the roster as it is on the server plus the new person; unsaved row edits would be left behind.",
              });
              return;
            }
            // Validate the would-be roster so a bad id or duplicate is caught here, not by CI.
            const issues = rosterIssues({ _comment: ROSTER_COMMENT, members: [...loaded, entry] });
            const mine = issues.filter((i) => i.index === loaded.length);
            if (mine.length) {
              setFlash({ kind: "error", title: "Check the new entry", body: mine.map((i) => `${i.field ?? "entry"}: ${i.message}`).join(" · ") });
              return;
            }
            void saveRoster([...loaded, entry], `Add ${entry.name} to the roster`).then((ok) => {
              if (ok) setDraft({ email: "", name: "", role: "member", active: true });
            });
          }}
        >
          Add to roster
        </ActionButton>
        <p className="text-[11.5px] leading-snug text-text-faint">
          Next: approve the change in the review queue, come back here, click <strong>Invite link</strong>
          next to their name and send it to them.
        </p>
      </div>
    </div>
  );
}

function profileExists(snapshot: Snapshot, personId?: string): boolean {
  return Boolean(personId && snapshot.content.people.some((p) => p.id === personId));
}

const ROSTER_COMMENT = [
  "Who may sign in to X-Lab Studio, and as what. Managed through Studio's roster screen.",
  "",
  "Deliberately OUTSIDE content/ so it never lands in public/content-snapshot.json.",
  "It lives in the repo (not a database) so that 'who had access when' stays answerable",
  "forever from git history.",
  "",
  "role:     admin  - full write access, can approve submissions, manages the roster",
  "          editor - full content write access, can approve submissions",
  "          member - edits only their own person record; may CREATE publications,",
  "                   recognitions and posts, which then wait for approval",
  "personId: the content/people/<id>.yaml this person owns. Required for members.",
  "githubLogin: only needed for admins who sign in with GitHub instead of email.",
  "active:   set false to revoke access without losing the historical record.",
];
