"use client";

// Who can sign in, and how they get in.
//
// Because no email provider is configured, onboarding works by handing someone a link:
// add them here, generate a link, send it however you already talk to them. The link is
// single-use and expires, so it is safe to send over chat.
//
// Roster edits go through the same review flow as content — they are a pull request, not a
// direct write — which is what keeps "who had access when" answerable from git history.
import { useCallback, useEffect, useState } from "react";
import { api, ROSTER_PATH, type RosterEntry, type Snapshot } from "@/lib/studio/api";
import { slugify } from "@/lib/studio/entities";

const input =
  "w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand";
const ROLES = ["admin", "editor", "member"] as const;

const ROLE_HELP: Record<RosterEntry["role"], string> = {
  admin: "Everything, including managing this roster and approving submissions.",
  editor: "Can edit all content and approve submissions. Cannot manage the roster.",
  member: "Edits only their own profile; can propose new publications, awards and posts.",
};

export function RosterManager({ snapshot }: { snapshot: Snapshot }) {
  const [members, setMembers] = useState<RosterEntry[]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
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
      setMembers((await api.roster()).members);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the roster.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveRoster(next: RosterEntry[], title: string) {
    setBusy(true);
    try {
      // Preserve the explanatory _comment block that documents what each role means —
      // it is the only in-repo documentation of this file.
      const body = {
        _comment: ROSTER_COMMENT,
        members: next,
      };
      await api.submit({
        title,
        summary: "Roster change submitted from Studio.",
        files: [{ path: ROSTER_PATH, content: JSON.stringify(body, null, 2) + "\n" }],
      });
      setMembers(next);
      alert("Submitted for review. Approve it in the review queue, then the change takes effect within a minute.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save the roster.");
    } finally {
      setBusy(false);
    }
  }

  async function makeInvite(entry: RosterEntry) {
    try {
      const res = await api.invite(entry.email);
      setInvite({
        name: res.name,
        email: entry.email,
        link: res.link,
        days: res.expiresInDays,
        reusable: res.reusable,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create an invite link.");
    }
  }

  async function revokeInvites(entry: RosterEntry) {
    if (!confirm(`Invalidate every outstanding sign-in link for ${entry.name}?\n\nAnyone still holding one will not be able to use it. Sessions already signed in are unaffected.`))
      return;
    try {
      const res = await api.revokeInvites(entry.email);
      setInvite(undefined);
      alert(res.revoked === 0 ? "There were no outstanding links." : `Revoked ${res.revoked} link(s).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not revoke links.");
    }
  }

  if (error) return <p className="text-sm text-brand-orange">{error}</p>;
  if (!members) return <p className="text-sm text-text-faint">Loading roster…</p>;

  const unlinked = snapshot.content.people.filter(
    (p) => !members.some((m) => m.personId === p.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Roster</h2>
        <p className="mt-1 text-[12.5px] text-text-faint">
          Anyone listed here can sign in. Changes go through review like everything else.
        </p>
      </div>

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
              Single use, expires in {invite.days} days. Send it however you normally contact them.
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
            {members.map((m, i) => (
              <tr key={m.email} className="border-b border-hairline">
                <td className="py-2 pr-3">
                  <span className={m.active ? "text-foreground" : "text-text-placeholder line-through"}>{m.name}</span>
                </td>
                <td className="py-2 pr-3 font-mono text-[11.5px] text-text-faint">{m.email}</td>
                <td className="py-2 pr-3">
                  <select
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => {
                      const next = members.map((x, j) =>
                        j === i ? { ...x, role: e.target.value as RosterEntry["role"] } : x
                      );
                      setMembers(next);
                    }}
                    className="rounded-sm border border-border bg-background px-1.5 py-1 text-[12.5px]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  {/*
                    A free-text id, not a dropdown of existing people: a member's profile
                    legitimately does not exist yet — they create it themselves on first
                    sign-in — so a picker over current records could not express it.
                  */}
                  <input
                    value={m.personId ?? ""}
                    disabled={busy}
                    placeholder="—"
                    onChange={(e) =>
                      setMembers(
                        members.map((x, j) =>
                          j === i ? { ...x, personId: e.target.value || undefined } : x
                        )
                      )
                    }
                    className="w-[170px] rounded-sm border border-border bg-background px-1.5 py-1 font-mono text-[12px]"
                  />
                  {m.personId && !profileExists(snapshot, m.personId) && (
                    <span className="ml-1.5 font-mono text-[10px] text-text-placeholder">not created yet</span>
                  )}
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => void makeInvite(m)}
                    disabled={!m.active}
                    className="font-mono text-[11px] text-brand-strong hover:underline disabled:text-text-placeholder"
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
                    onClick={() =>
                      setMembers(members.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))
                    }
                    className="ml-3 font-mono text-[11px] text-text-faint hover:text-brand-orange"
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => void saveRoster(members, "Update Studio roster")}
        disabled={busy}
        className="rounded-sm bg-invert-bg px-4 py-2 font-mono text-[11px] font-bold tracking-wider text-invert-fg uppercase disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit roster changes"}
      </button>

      <div className="space-y-3 border-t border-border pt-5">
        <h3 className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">Add someone</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            className={input}
            placeholder="Name"
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
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <select
            className={input}
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
            value={draft.personId ?? ""}
            onChange={(e) => setDraft({ ...draft, personId: e.target.value || undefined })}
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
                Links to the existing profile{" "}
                <span className="font-mono">{draft.personId}</span>.
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
        <button
          onClick={() => {
            if (!draft.email.trim() || !draft.name.trim()) return alert("Name and email are required.");
            if (members.some((m) => m.email.toLowerCase() === draft.email.trim().toLowerCase()))
              return alert("That email is already on the roster.");
            if (draft.role === "member" && !draft.personId)
              return alert("A member needs a profile id — it is normally filled in from their name.");
            // Two roster entries pointing at one profile would let each overwrite the other's
            // edits, with the second submission silently winning.
            if (draft.personId && members.some((m) => m.personId === draft.personId))
              return alert(`Someone on the roster already owns the profile "${draft.personId}".`);
            void saveRoster([...members, { ...draft, email: draft.email.trim() }], `Add ${draft.name} to the roster`);
            setDraft({ email: "", name: "", role: "member", active: true });
          }}
          disabled={busy}
          className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase disabled:opacity-50"
        >
          Add to roster
        </button>
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
