"use client";

// Who can sign in, and how they get in (SPEC.md §8).
//
// Onboarding: add someone here (name, email, role), get the change approved, then click
// "Set-password link" and send it to them however you already talk to them. They open it,
// choose a password, and from then on sign in with their email and that password. Forgot it?
// Same button. No email is ever sent by the system.
//
// The repo is public, so the roster never stores an address: the gate turns each one into a
// hash (HMAC under a secret only it holds) and the roster keeps that. This screen therefore
// cannot show anyone's address — only how many they have — and legacy plain-text entries are
// flagged with a one-click fix.
//
// Roster edits go through the same review flow as content — they are a pull request, not a
// direct write — which is what keeps "who had access when" answerable from git history.
// Two consequences this screen has to be honest about:
//
//   - A change takes effect only once its PR is approved. Until then the person is not on
//     the roster the Worker reads, so their set-password link cannot be made yet.
//   - Each PR rewrites the whole file. Two open roster PRs would conflict, so while one is
//     waiting this screen refuses to open another.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ROSTER_PATH, type QueueItem, type RosterEntry, type Snapshot } from "@/lib/studio/api";
import { ROSTER_COMMENT, rosterIssues, suggestAccountId, type RosterIssue } from "@/lib/access/roster";
import { slugify } from "@/lib/studio/entities";
import { pendingFor, relativeTime } from "@/lib/studio/submissions";
import { ActionButton, Notice, type NoticeKind } from "./notice";

const input =
  "w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand disabled:opacity-60";
const ROLES = ["admin", "editor", "member"] as const;

const ROLE_HELP: Record<RosterEntry["role"], string> = {
  admin: "Everything, including managing this roster and approving submissions.",
  editor: "Can edit all content and approve submissions. Cannot manage the roster.",
  member: "Edits their own profile and work that names them; can propose new publications, awards, posts and projects.",
};

type Flash = { kind: NoticeKind; title: string; body?: string };
type Draft = { name: string; email: string; role: RosterEntry["role"]; personId?: string };
const EMPTY_DRAFT: Draft = { name: "", email: "", role: "member" };

const addressCount = (m: RosterEntry) => m.emailHashes.length + (m.email ? 1 : 0);

export function RosterManager({ snapshot, onOpenQueue }: { snapshot: Snapshot; onOpenQueue: () => void }) {
  /** What the gate returned — the roster that is actually in force. */
  const [loaded, setLoaded] = useState<RosterEntry[]>();
  /** The rows as edited on screen. */
  const [members, setMembers] = useState<RosterEntry[]>();
  const [pendingPr, setPendingPr] = useState<QueueItem>();
  /**
   * Rows that exist only in a submission made from this screen, so a just-added person is
   * visible as "waiting for approval" rather than vanishing until the PR merges.
   */
  const [pendingRows, setPendingRows] = useState<RosterEntry[]>([]);
  const [error, setError] = useState<string>();
  const [flash, setFlash] = useState<Flash>();
  const [busy, setBusy] = useState(false);
  const [rowIssues, setRowIssues] = useState<RosterIssue[]>([]);
  const [invite, setInvite] = useState<{ name: string; link: string; days: number }>();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    try {
      const [roster, queue] = await Promise.all([api.roster(), api.queue()]);
      // Older rosters have no emailHashes array; normalize so the screen can rely on it.
      const rows = roster.members.map((m) => ({ ...m, emailHashes: m.emailHashes ?? [] }));
      setLoaded(rows);
      setMembers(rows);
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
      // Preserve the explanatory _comment block — the only in-repo documentation of this file.
      const body = { _comment: ROSTER_COMMENT, members: next };
      const res = await api.submit({
        title,
        summary: "Roster change submitted from Studio.",
        files: [{ path: ROSTER_PATH, content: JSON.stringify(body, null, 2) + "\n" }],
      });
      setFlash({
        kind: "ok",
        title: `Submitted as #${res.pr.number}`,
        body: "Approve it in the review queue once the automatic checks pass. It takes effect within a minute of approval; set-password links work from then on.",
      });
      setPendingRows(next.filter((m) => !loaded?.some((x) => x.id === m.id)));
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
      const res = await api.invite(entry.id);
      setInvite({ name: res.name, link: res.link, days: res.expiresInDays });
    } catch (err) {
      setFlash({ kind: "error", title: `Could not create a link for ${entry.name}`, body: err instanceof Error ? err.message : undefined });
    }
  }

  async function revoke(entry: RosterEntry) {
    if (
      !confirm(
        `Sign ${entry.name} out everywhere and cancel their outstanding set-password links?\n\nTheir password keeps working — they just have to sign in again. To stop them signing in at all, deactivate them instead.`
      )
    )
      return;
    try {
      const res = await api.revokeInvites(entry.id);
      setInvite(undefined);
      setFlash({
        kind: "ok",
        title: `${entry.name} is signed out everywhere`,
        body: res.revoked ? `${res.revoked} outstanding link${res.revoked === 1 ? " was" : "s were"} cancelled too.` : undefined,
      });
    } catch (err) {
      setFlash({ kind: "error", title: "Could not revoke access", body: err instanceof Error ? err.message : undefined });
    }
  }

  /** Add another sign-in address to a row (as a hash). Marks the row unsaved. */
  async function addAddress(index: number) {
    if (!members) return;
    const email = prompt(`Another address ${members[index].name} may sign in with:`)?.trim();
    if (!email) return;
    try {
      const { hash } = await api.hashEmail(email);
      setMembers(members.map((m, j) => (j === index && !m.emailHashes.includes(hash) ? { ...m, emailHashes: [...m.emailHashes, hash] } : m)));
    } catch (err) {
      setFlash({ kind: "error", title: "Could not add that address", body: err instanceof Error ? err.message : undefined });
    }
  }

  /** Replace every legacy plain-text address with its hash, in one roster change. */
  async function hashLegacyAddresses() {
    if (!loaded) return;
    setBusy(true);
    try {
      const next: RosterEntry[] = [];
      for (const m of loaded) {
        if (!m.email) {
          next.push(m);
          continue;
        }
        const { hash } = await api.hashEmail(m.email);
        const rest = { ...m };
        delete rest.email;
        next.push({ ...rest, emailHashes: rest.emailHashes.includes(hash) ? rest.emailHashes : [...rest.emailHashes, hash] });
      }
      setBusy(false);
      await saveRoster(next, "Roster: store sign-in addresses as hashes");
    } catch (err) {
      setBusy(false);
      setFlash({ kind: "error", title: "Could not hash the addresses", body: err instanceof Error ? err.message : undefined });
    }
  }

  async function addPerson() {
    if (!loaded) return;
    const name = draft.name.trim();
    const email = draft.email.trim();
    const personId = draft.personId?.trim() || undefined;
    if (!name || !email) {
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
    let hash: string;
    try {
      ({ hash } = await api.hashEmail(email));
    } catch (err) {
      setFlash({ kind: "error", title: "Could not hash that address", body: err instanceof Error ? err.message : undefined });
      return;
    }
    const entry: RosterEntry = { id: suggestAccountId(name, personId), name, role: draft.role, emailHashes: [hash], personId, active: true };
    // Validate the would-be roster so a bad id or duplicate is caught here, not by CI.
    const issues = rosterIssues({ _comment: ROSTER_COMMENT, members: [...loaded, entry] });
    const mine = issues.filter((i) => i.index === loaded.length);
    if (mine.length) {
      setFlash({ kind: "error", title: "Check the new entry", body: mine.map((i) => `${i.field ?? "entry"}: ${i.message}`).join(" · ") });
      return;
    }
    if (await saveRoster([...loaded, entry], `Add ${entry.name} to the roster`)) setDraft(EMPTY_DRAFT);
  }

  if (error) return <p className="text-sm text-brand-orange">{error}</p>;
  if (!members || !loaded) return <p className="text-sm text-text-faint">Loading roster…</p>;

  const locked = Boolean(pendingPr) || busy;
  const legacy = loaded.filter((m) => m.email);
  const unlinked = snapshot.content.people.filter((p) => !members.some((m) => m.personId === p.id));
  const issueFor = (index: number, field: string) => rowIssues.find((i) => i.index === index && i.field === field)?.message;
  const rowHasIssue = (index: number) => rowIssues.some((i) => i.index === index);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Roster</h2>
        <p className="mt-1 text-[12.5px] text-text-faint">
          Anyone listed here can sign in with their email and password. Changes go through review like everything else.
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
          Sent {relativeTime(pendingPr.createdAt)}. Approve it (or return it) before making another change — each change
          rewrites the whole roster, and two at once would conflict.
        </Notice>
      )}

      {legacy.length > 0 && !pendingPr && (
        <Notice
          kind="warn"
          title={`${legacy.length} sign-in address${legacy.length === 1 ? " is" : "es are"} stored in plain text`}
          actions={
            <ActionButton primary disabled={locked} onClick={() => void hashLegacyAddresses()}>
              {busy ? "Hashing…" : "Hash them now"}
            </ActionButton>
          }
        >
          The repo is public, so anyone can read {legacy.map((m) => m.name).join(", ")}&apos;s address there. One click replaces
          {legacy.length === 1 ? " it" : " them"} with a hash and opens a roster change for you to approve. Sign-in keeps working
          throughout. (Earlier versions of the file stay in git history.)
        </Notice>
      )}

      {flash && (
        <Notice kind={flash.kind} title={flash.title} onDismiss={() => setFlash(undefined)}>
          {flash.body}
        </Notice>
      )}

      {invite && (
        <div className="rounded-sm border border-brand-soft-border bg-brand-soft-bg p-3">
          <p className="text-sm font-medium text-brand-strong">Set-password link for {invite.name}</p>
          <p className="mt-1 text-[12px] text-text-faint">
            Works once, expires in {invite.days} days. Send it however you normally contact them — they open it, choose a password,
            and are signed in. Anyone holding it can set the password, so send it privately.
          </p>
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
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["Name", "Sign-in", "Role", "Owns profile", ""].map((h) => (
                <th key={h} className="py-2 pr-3 font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const saved = loaded.find((x) => x.id === m.id);
              const changed = JSON.stringify(saved) !== JSON.stringify(m);
              const canLink = m.active && Boolean(saved) && !changed && addressCount(m) > 0;
              return (
                <tr key={m.id} className={`border-b border-hairline ${rowHasIssue(i) ? "bg-brand-orange/5" : ""}`}>
                  <td className="py-2 pr-3">
                    <span className={m.active ? "text-foreground" : "text-text-placeholder line-through"}>{m.name}</span>
                    {changed && <span className="ml-1.5 font-mono text-[10px] text-brand-orange">unsaved</span>}
                    <span className="block font-mono text-[10.5px] text-text-placeholder">{m.id}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-text-faint">
                    {m.emailHashes.length > 0 && (
                      <span className="block">
                        {m.emailHashes.length} address{m.emailHashes.length === 1 ? "" : "es"}
                      </span>
                    )}
                    {m.email && <span className="block text-brand-orange">1 in plain text</span>}
                    {m.githubLogin && <span className="block">GitHub: {m.githubLogin}</span>}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => void addAddress(i)}
                      className="mt-0.5 text-text-faint hover:text-foreground hover:underline disabled:opacity-60"
                    >
                      + address
                    </button>
                    {issueFor(i, "emailHashes") && <p className="mt-0.5 font-sans text-[11px] text-brand-orange">{issueFor(i, "emailHashes")}</p>}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={m.role}
                      disabled={locked}
                      onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, role: e.target.value as RosterEntry["role"] } : x)))}
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
                      onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, personId: e.target.value.trim() || undefined } : x)))}
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
                      disabled={!canLink}
                      title={
                        !saved
                          ? "Approve the roster change first — this person is not on the roster the gate reads yet"
                          : changed
                            ? "Submit (and approve) the change to this row first"
                            : !m.active
                              ? "Reactivate this person first"
                              : addressCount(m) === 0
                                ? "Add an address first — they sign in with it"
                                : "A one-time link with which they choose a password (first time, or forgotten)"
                      }
                      className="font-mono text-[11px] text-brand-strong hover:underline disabled:text-text-placeholder disabled:no-underline"
                    >
                      Set-password link
                    </button>
                    <button
                      onClick={() => void revoke(m)}
                      disabled={!saved}
                      title="Sign them out everywhere and cancel their outstanding links"
                      className="ml-3 font-mono text-[11px] text-text-faint hover:text-brand-orange disabled:opacity-60"
                    >
                      Sign out everywhere
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
                <tr key={`pending:${m.id}`} className="border-b border-hairline opacity-70">
                  <td className="py-2 pr-3 text-foreground">{m.name}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-text-faint">{addressCount(m)} address(es)</td>
                  <td className="py-2 pr-3 font-mono text-[12.5px] text-text-faint">{m.role}</td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-text-faint">{m.personId ?? "—"}</td>
                  <td className="py-2 text-right font-mono text-[11px] whitespace-nowrap text-brand-orange">waiting for approval (#{pendingPr.number})</td>
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
              // Keep the profile id in step with the name until it is edited by hand.
              const auto = draft.personId === undefined || draft.personId === slugify(draft.name);
              setDraft({ ...draft, name, ...(auto ? { personId: slugify(name) || undefined } : {}) });
            }}
          />
          <input
            className={input}
            placeholder="Email they will sign in with"
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
        {draft.role === "member" && (
          <p className="text-[11.5px] text-text-faint">
            {profileExists(snapshot, draft.personId) ? (
              <>
                Links to the existing profile <span className="font-mono">{draft.personId}</span>.
              </>
            ) : (
              <>
                They will create their own profile at <span className="font-mono">{draft.personId || "…"}</span> when they first sign in.
              </>
            )}
          </p>
        )}
        {unlinked.length > 0 && draft.role === "member" && (
          <p className="text-[11.5px] text-text-faint">
            {unlinked.length} existing profile{unlinked.length === 1 ? "" : "s"} not linked to anyone yet — type its id above to link
            instead of creating a new one.
          </p>
        )}
        <ActionButton disabled={locked} onClick={() => void addPerson()}>
          Add to roster
        </ActionButton>
        <p className="text-[11.5px] leading-snug text-text-faint">
          The address is stored only as a hash. Next: approve the change in the review queue, come back here, click{" "}
          <strong>Set-password link</strong> next to their name and send it to them.
        </p>
      </div>
    </div>
  );
}

function profileExists(snapshot: Snapshot, personId?: string): boolean {
  return Boolean(personId && snapshot.content.people.some((p) => p.id === personId));
}
