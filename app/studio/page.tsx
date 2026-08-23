"use client";

// X-Lab Studio — a single client-side app inside the static export.
//
// Deliberately ONE route rather than nested routes: `output: "export"` requires every
// dynamic segment to be enumerated at build time, which a content manager cannot do. View
// state lives in React instead, so the whole tool ships as one prerendered shell.
//
// This file must never import lib/content/index.ts or loader.ts — they use fs. All content
// comes from the build-time snapshot; all writes go through the gate.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  captureTokenFromHash,
  clearToken,
  getToken,
  loadSnapshot,
  signInWithGitHubUrl,
  type Identity,
  type Snapshot,
} from "@/lib/studio/api";
import { ENTITIES, entityByKey } from "@/lib/studio/entities";
import { personCompleteness } from "@/lib/studio/records";
import { ISSUE_TITLES, type Issue } from "@/lib/content/report";
import { EntityBrowser } from "@/components/studio/entity-browser";
import { ReviewQueue } from "@/components/studio/review-queue";
import { RosterManager } from "@/components/studio/roster-manager";
import { MemberHome } from "@/components/studio/member-home";
import { AuthorLinker } from "@/components/studio/author-linker";

type View =
  | { kind: "dashboard" }
  | { kind: "entity"; key: string }
  | { kind: "queue" }
  | { kind: "health" }
  | { kind: "linker" }
  | { kind: "roster" }
  | { kind: "me" };

export default function StudioPage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  // Members land on their own page; admins and editors land on the lab-wide dashboard.
  const [view, setView] = useState<View>({ kind: "dashboard" });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string>();
  const [toast, setToast] = useState<{ number: number; url: string }>();

  const boot = useCallback(async () => {
    const { error } = captureTokenFromHash();
    if (error) setAuthError(errorMessage(error));

    // The snapshot is public, so load it regardless — it makes the shell useful even while
    // the session is being checked.
    loadSnapshot().then(setSnapshot).catch(() => undefined);

    if (getToken()) {
      try {
        setIdentity(await api.me());
      } catch {
        setIdentity(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Session check + snapshot fetch on mount. The setState calls happen in async
    // continuations after network round trips, not synchronously during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void boot();
  }, [boot]);

  if (loading) {
    return <Centered>Loading Studio…</Centered>;
  }

  if (!identity) {
    return <SignIn error={authError} />;
  }

  const canApprove = identity.role === "admin" || identity.role === "editor";
  const isMember = !canApprove;
  const canEdit = (record: Record<string, unknown> | undefined) => {
    if (canApprove) return true;
    // Members may edit only their own person record; the gate enforces this server-side too.
    return Boolean(identity.personId && record && record.id === identity.personId);
  };

  // A member's first view is their own page, not the lab-wide dashboard.
  const current: View = isMember && view.kind === "dashboard" ? { kind: "me" } : view;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-black leading-tight tracking-tight text-foreground flex items-center gap-3">
            X-Lab Studio
            {snapshot && (
              <span className="ml-2 font-mono text-[11px] font-normal text-text-faint">
                live @ {snapshot.commit}
              </span>
            )}
          </h1>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground">
              Hello, {identity.name}
            </span>
            <span className="mx-1 text-lg text-text-faint select-none" aria-hidden="true">·</span>
            <span
              className={
                "font-mono text-xs px-2 py-0.5 rounded" +
                (identity.role === "admin"
                  ? " bg-blue-100 text-blue-700 border border-blue-200"
                  : identity.role === "editor"
                  ? " bg-green-100 text-green-700 border border-green-200"
                  : " bg-gray-100 text-gray-700 border border-gray-200")
              }
            >
              {identity.role}
            </span>
          </div>
        </div>
   
        <button
          onClick={() => {
            clearToken();
            setIdentity(null);
          }}
          className="font-mono text-[11px] text-text-faint hover:text-foreground"
        >
          Sign out
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[190px_1fr]">
        <nav className="space-y-0.5">
          {isMember ? (
            <NavButton active={current.kind === "me"} onClick={() => setView({ kind: "me" })}>
              My page
            </NavButton>
          ) : (
            <>
              <NavButton
                active={current.kind === "dashboard"}
                onClick={() => setView({ kind: "dashboard" })}
              >
                Dashboard
              </NavButton>
              <NavButton active={current.kind === "health"} onClick={() => setView({ kind: "health" })}>
                Data health
              </NavButton>
              <NavButton active={current.kind === "linker"} onClick={() => setView({ kind: "linker" })}>
                Link authors
              </NavButton>
            </>
          )}
          <NavButton active={current.kind === "queue"} onClick={() => setView({ kind: "queue" })}>
            {isMember ? "My submissions" : "Review queue"}
          </NavButton>
          {identity.role === "admin" && (
            <NavButton active={current.kind === "roster"} onClick={() => setView({ kind: "roster" })}>
              Roster &amp; access
            </NavButton>
          )}
          <p className="px-2 pt-4 pb-1 font-mono text-[10px] font-bold tracking-wider text-text-placeholder uppercase">
            {isMember ? "Browse the lab" : "Content"}
          </p>
          {ENTITIES.map((e) => (
            <NavButton
              key={e.key}
              active={current.kind === "entity" && current.key === e.key}
              onClick={() => setView({ kind: "entity", key: e.key })}
            >
              {e.plural}
              {snapshot && (
                <span className="ml-1.5 font-mono text-[10px] text-text-placeholder">
                  {(snapshot.content[e.snapshotKey] as unknown[]).length}
                </span>
              )}
            </NavButton>
          ))}
        </nav>

        <main className="min-w-0">
          {toast && (
            <div className="mb-4 rounded-sm border border-brand-soft-border bg-brand-soft-bg px-3 py-2 text-sm">
              <span className="text-brand-strong">Submitted for review.</span>{" "}
              <button onClick={() => setView({ kind: "queue" })} className="underline">
                Open the review queue
              </button>{" "}
              <button onClick={() => setToast(undefined)} className="float-right text-text-faint">
                ✕
              </button>
            </div>
          )}

          {!snapshot ? (
            <p className="text-sm text-text-faint">Loading content…</p>
          ) : current.kind === "me" ? (
            <MemberHome identity={identity} snapshot={snapshot} onSubmitted={(pr) => setToast(pr)} />
          ) : current.kind === "dashboard" ? (
            <Dashboard snapshot={snapshot} onNavigate={setView} />
          ) : current.kind === "queue" ? (
            <ReviewQueue canApprove={canApprove} snapshot={snapshot} />
          ) : current.kind === "health" ? (
            <Health snapshot={snapshot} />
          ) : current.kind === "linker" ? (
            <AuthorLinker snapshot={snapshot} onSubmitted={(pr) => setToast(pr)} />
          ) : current.kind === "roster" ? (
            <RosterManager snapshot={snapshot} />
          ) : (
            (() => {
              const entity = entityByKey(current.key);
              if (!entity) return <p className="text-sm text-text-faint">Unknown section.</p>;
              return (
                <EntityBrowser
                  entity={entity}
                  snapshot={snapshot}
                  canEdit={canEdit}
                  onSubmitted={(pr) => setToast(pr)}
                  // Members browse the lab's content for context but change it only from
                  // their own page, where the scoping and permissions are explicit.
                  readOnly={isMember}
                />
              );
            })()
          )}
        </main>
      </div>
    </div>
  );
}

// --- views ---------------------------------------------------------------------

function Dashboard({ snapshot, onNavigate }: { snapshot: Snapshot; onNavigate: (v: View) => void }) {
  const issues = snapshot.report?.issues ?? [];
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.length - errors;

  const incomplete = useMemo(
    () =>
      snapshot.content.people
        .map((p) => ({ p, score: personCompleteness(p) }))
        .filter((x) => x.score < 100)
        .sort((a, b) => a.score - b.score)
        .slice(0, 6),
    [snapshot]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ENTITIES.slice(0, 4).map((e) => (
          <button
            key={e.key}
            onClick={() => onNavigate({ kind: "entity", key: e.key })}
            className="rounded-sm border border-border p-3 text-left hover:border-brand"
          >
            <p className="text-2xl font-bold text-foreground">
              {(snapshot.content[e.snapshotKey] as unknown[]).length}
            </p>
            <p className="font-mono text-[10.5px] tracking-wider text-text-faint uppercase">{e.plural}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => onNavigate({ kind: "health" })}
        className="block w-full rounded-sm border border-border p-4 text-left hover:border-brand"
      >
        <p className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">Data health</p>
        <p className="mt-1 text-sm text-foreground">
          {errors > 0 ? (
            <span className="font-medium text-brand-orange">{errors} error{errors === 1 ? "" : "s"}</span>
          ) : (
            <span className="font-medium text-brand-strong">No errors</span>
          )}
          <span className="text-text-faint"> · {warnings} thing{warnings === 1 ? "" : "s"} worth improving</span>
        </p>
      </button>

      {incomplete.length > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
            Least complete profiles
          </h3>
          <div className="space-y-1.5">
            {incomplete.map(({ p, score }) => (
              <button
                key={p.id}
                onClick={() => onNavigate({ kind: "entity", key: "people" })}
                className="flex w-full items-center gap-3 rounded-sm border border-hairline px-3 py-2 text-left hover:border-brand"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-bg-alt">
                  <span className="block h-full bg-brand" style={{ width: `${score}%` }} />
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-[11px] text-text-faint">{score}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11.5px] text-text-faint">
        Snapshot generated {new Date(snapshot.generatedAt).toLocaleString()} · schema v{snapshot.schemaVersion}
      </p>
    </div>
  );
}

/**
 * Data health.
 *
 * Reads the verdict the real validator produced at build time (see scripts/build-snapshot.ts)
 * rather than recomputing it here. There was previously a second implementation of the checks
 * in the browser, and the two had drifted apart — different checks, different wording. The
 * snapshot now carries the answer, so there is exactly one place a rule is written.
 */
function Health({ snapshot }: { snapshot: Snapshot }) {
  const report = snapshot.report;
  const grouped = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of report?.issues ?? []) {
      map.set(issue.code, [...(map.get(issue.code) ?? []), issue]);
    }
    // Errors first, then whatever affects the most records.
    return [...map.entries()].sort((a, b) => {
      const byLevel = Number(b[1][0].level === "error") - Number(a[1][0].level === "error");
      return byLevel !== 0 ? byLevel : b[1].length - a[1].length;
    });
  }, [report]);

  if (!report) {
    return (
      <p className="text-sm text-text-faint">
        This snapshot was built before health reporting existed. It appears after the next deploy.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Data health</h2>
      <p className="max-w-2xl text-[12.5px] leading-relaxed text-text-faint">
        Errors block a submission from being approved. Warnings never block anything. Coverage is
        not a problem at all — it is how much of the optional linking has been done, and only a
        person can decide whether a given link belongs.
      </p>

      {report.coverage.length > 0 && (
        <div className="rounded-sm border border-border p-3">
          <p className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase">
            Coverage
          </p>
          <div className="mt-2 space-y-2">
            {report.coverage.map((stat) => {
              const pct = stat.total === 0 ? 100 : Math.round((stat.covered / stat.total) * 100);
              return (
                <div key={stat.key}>
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 text-[12.5px] text-foreground">{stat.label}</span>
                    <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-bg-alt">
                      <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-16 shrink-0 text-right font-mono text-[11px] text-text-faint">
                      {stat.covered}/{stat.total}
                    </span>
                  </div>
                  {stat.hint && (
                    <p className="mt-0.5 text-[11.5px] leading-snug text-text-placeholder">{stat.hint}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="text-sm text-brand-strong">Everything checks out — no issues found.</p>
      ) : (
        grouped.map(([code, list]) => (
          <div key={code} className="rounded-sm border border-border p-3">
            <p className="text-sm">
              <span className={list[0].level === "error" ? "font-medium text-brand-orange" : "text-foreground"}>
                {ISSUE_TITLES[code] ?? code}
              </span>
              <span className="ml-2 font-mono text-[11px] text-text-faint">
                {list.length} record{list.length === 1 ? "" : "s"}
              </span>
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-text-faint">
              {list.slice(0, 12).map((i) => i.id ?? i.message).join(", ")}
              {list.length > 12 && ` … +${list.length - 12} more`}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

function SignIn({ error }: { error?: string }) {
  return (
    <Centered>
      <div className="w-full max-w-sm space-y-4 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">X-Lab Studio</h1>
          <p className="mt-1 text-sm text-text-faint">Sign in to manage the lab&apos;s content.</p>
        </div>
        {error && (
          <p className="rounded-sm border border-brand-orange/40 bg-brand-orange/5 px-3 py-2 text-[12.5px] text-brand-orange">
            {error}
          </p>
        )}
        <a
          href={signInWithGitHubUrl}
          className="block rounded-sm bg-invert-bg px-4 py-2.5 font-mono text-[11.5px] font-bold tracking-wider text-invert-fg uppercase"
        >
          Sign in with GitHub
        </a>
        <p className="text-[11.5px] leading-snug text-text-faint">
          Lab members sign in with an emailed link instead — ask an admin to add you.
        </p>
      </div>
    </Centered>
  );
}

// --- small pieces --------------------------------------------------------------

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70vh] items-center justify-center px-5 text-sm text-text-faint">{children}</div>;
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
        active ? "bg-bg-alt font-medium text-foreground" : "text-text-faint hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "not_authorized":
      return "That account is not on the roster. An admin needs to add you first.";
    case "already_used":
      return "That sign-in link was already used. Request a new one.";
    case "invalid_or_expired":
      return "That sign-in link expired. Request a new one.";
    case "bad_oauth_state":
      return "Sign-in could not be verified. Please try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
