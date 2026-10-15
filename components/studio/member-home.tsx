"use client";

// What a lab member sees. Three jobs:
//
//   1. First sign-in: their roster entry names a profile id that has no record yet, so this
//      offers to create it. That is what collapses onboarding from three admin actions
//      (stub profile -> link -> invite) down to one (add to roster -> invite). The Worker
//      already permits it: canWritePath matches content/people/<their-id>.yaml by path
//      equality and does not care whether the file exists.
//
//   2. While a change is waiting for review, say so — and do NOT offer "Create my profile"
//      again. The live snapshot lags approval by a deploy, so without this a member who
//      submitted ten minutes ago sees the same empty state and submits a conflicting second
//      copy. The open-submission list (members see only their own) is the source of truth.
//
//   3. Afterwards: a home page for their own records — profile, publications, awards, posts —
//      so they never have to hunt through the whole lab's data to find their own.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Identity, type QueueItem, type ReturnedItem, type Snapshot } from "@/lib/studio/api";
import { entityByKey, filePathFor } from "@/lib/studio/entities";
import { personCompleteness, profileTodos } from "@/lib/studio/records";
import { filesChangedIn, pendingFor, relativeTime } from "@/lib/studio/submissions";
import { EntityBrowser } from "./entity-browser";
import { ActionButton, Notice } from "./notice";
import { ProfileForm } from "./profile-form";

type Rec = Record<string, unknown>;
type Pr = { number: number; url: string };

export function MemberHome({
  identity,
  snapshot,
  onSubmitted,
  onIdentityChange,
  onOpenQueue,
}: {
  identity: Identity;
  snapshot: Snapshot;
  onSubmitted: (pr: Pr) => void;
  /** The gate re-reads the roster on every request, so "Check again" can pick up a fix without a new link. */
  onIdentityChange: (next: Identity) => void;
  onOpenQueue: () => void;
}) {
  const profile = useMemo(
    () => snapshot.content.people.find((p) => p.id === identity.personId),
    [snapshot, identity.personId]
  );

  // The member's own open submissions. Loaded once, and again after anything is submitted
  // from this page, so the "waiting for review" state appears immediately.
  const [queue, setQueue] = useState<QueueItem[]>();
  const [queueFailed, setQueueFailed] = useState(false);
  /** Submissions sent back with a note. Loaded alongside the queue; best-effort. */
  const [returned, setReturned] = useState<ReturnedItem[]>([]);
  const [dismissed, setDismissed] = useState<number[]>(() => readDismissed());
  const loadQueue = useCallback(async () => {
    try {
      const [q, r] = await Promise.all([
        api.queue(),
        api.returned().catch(() => ({ returned: [] as ReturnedItem[] })),
      ]);
      setQueue(q.queue);
      setReturned(r.returned);
      setQueueFailed(false);
    } catch {
      setQueue([]);
      setQueueFailed(true);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQueue();
  }, [loadQueue]);

  const submitted = (pr: Pr) => {
    onSubmitted(pr);
    void loadQueue();
  };

  const peopleEntity = entityByKey("people");
  const profilePath = identity.personId && peopleEntity ? filePathFor(peopleEntity, identity.personId) : undefined;
  const pendingProfile = queue && profilePath ? pendingFor(queue, profilePath) : undefined;

  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string>();

  const visibleReturns = returned.filter((r) => !dismissed.includes(r.number));
  const dismiss = (n: number) => {
    const next = [...dismissed, n];
    setDismissed(next);
    writeDismissed(next);
  };
  const returnedNotices = visibleReturns.map((r) => {
    const isProfile = profilePath !== undefined && filesChangedIn(r).includes(profilePath);
    return (
      <Notice
        key={r.number}
        kind="warn"
        title={`“${r.title}” was returned ${relativeTime(r.closedAt)}`}
        onDismiss={() => dismiss(r.number)}
        actions={
          isProfile && !pendingProfile ? (
            <ActionButton
              primary
              onClick={() => {
                if (profile) setEditing(true);
                else setCreating(true);
              }}
            >
              Fix and send again
            </ActionButton>
          ) : undefined
        }
      >
        {r.reason ? (
          <>
            Note from the reviewer: <span className="text-foreground">“{r.reason}”</span>
          </>
        ) : (
          "No note was left. Ask an admin what to change."
        )}
        {" "}What you sent is kept in this browser, so you can start from it.
      </Notice>
    );
  });

  if (!identity.personId) {
    return (
      <Notice
        kind="warn"
        title="Your account isn't linked to a profile yet"
        actions={
          <ActionButton
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              setCheckNote(undefined);
              try {
                const next = await api.me();
                if (next.personId) onIdentityChange(next);
                else setCheckNote("Still not linked. The admin may not have approved the roster change yet.");
              } catch {
                setCheckNote("Could not reach the server. Try again in a moment.");
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? "Checking…" : "Check again"}
          </ActionButton>
        }
      >
        An admin needs to set a profile id for you on the roster. Once they have, click
        Check again — you don&apos;t need a new sign-in link.
        {checkNote && <span className="mt-1 block">{checkNote}</span>}
      </Notice>
    );
  }

  if (!peopleEntity) return null;

  // Still finding out whether something is already waiting. Brief, and it prevents the
  // double-submit this screen exists to avoid.
  if (!queue) {
    return <p className="text-sm text-text-faint">Loading your page…</p>;
  }

  if (editing && profile) {
    return (
      <ProfileForm
        identity={identity}
        snapshot={snapshot}
        initial={profile as unknown as Rec}
        isNew={false}
        onCancel={() => setEditing(false)}
        onSubmitted={(pr) => {
          setEditing(false);
          submitted(pr);
        }}
      />
    );
  }

  if (!profile) {
    if (pendingProfile) {
      return (
        <div className="space-y-5">
          {returnedNotices}
          <PendingNotice item={pendingProfile} what="Your profile" onOpenQueue={onOpenQueue} />
          <MyRecords identity={identity} snapshot={snapshot} queue={queue} onSubmitted={submitted} />
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {!creating && returnedNotices}
        <CreateProfile
          identity={identity}
          snapshot={snapshot}
          onSubmitted={submitted}
          started={creating}
          onStartedChange={setCreating}
        />
      </div>
    );
  }

  const score = personCompleteness(profile);
  // Same list the card editor shows, so the numbers and wording agree.
  const todo = profileTodos(profile).filter((t) => !t.done);

  return (
    <div className="space-y-5">
      {queueFailed && (
        <Notice kind="warn" title="Couldn't check for pending changes">
          If you submitted something recently it may still be waiting for review. Reload to try again.
        </Notice>
      )}
      {returnedNotices}
      {pendingProfile && <PendingNotice item={pendingProfile} what="A change to your profile" onOpenQueue={onOpenQueue} />}

      <div className="rounded-sm border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{profile.name}</h2>
            <p className="font-mono text-[11px] text-text-faint">{profile.roleTitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-[10.5px] tracking-wider text-text-faint uppercase">
                Profile complete
              </p>
              <p className="text-lg font-bold text-foreground">{score}%</p>
            </div>
            <ActionButton
              primary
              onClick={() => setEditing(true)}
              disabled={Boolean(pendingProfile)}
              title={pendingProfile ? "Wait for the pending change to be reviewed first" : undefined}
            >
              Edit my profile
            </ActionButton>
          </div>
        </div>
        {todo.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-[12.5px] text-text-faint">
            {todo.map((t) => (
              <li key={t.key}>
                ·{" "}
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={Boolean(pendingProfile)}
                  className="hover:text-foreground hover:underline disabled:no-underline"
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MyRecords identity={identity} snapshot={snapshot} queue={queue} onSubmitted={submitted} />
    </div>
  );
}

/** "Waiting for review" — the state that stops duplicate submissions. */
function PendingNotice({ item, what, onOpenQueue }: { item: QueueItem; what: string; onOpenQueue: () => void }) {
  const check =
    item.checks === "failure"
      ? "Automatic checks found a problem — an admin will look at it and get back to you."
      : item.checks === "pending"
        ? "Automatic checks are running now."
        : "It passed the automatic checks.";
  return (
    <Notice
      kind="ok"
      title={`${what} is waiting for review`}
      actions={
        <button type="button" onClick={onOpenQueue} className="font-mono text-[11px] text-brand-strong hover:underline">
          See my submissions →
        </button>
      }
    >
      Sent {relativeTime(item.createdAt)} (#{item.number}). {check} Once an admin approves it, it
      appears on the site a few minutes later — nothing else to do.
    </Notice>
  );
}

/** First sign-in: create the profile the roster reserved for this person. */
function CreateProfile({
  identity,
  snapshot,
  onSubmitted,
  started,
  onStartedChange,
}: {
  identity: Identity;
  snapshot: Snapshot;
  onSubmitted: (pr: Pr) => void;
  started: boolean;
  onStartedChange: (v: boolean) => void;
}) {
  if (started) {
    return (
      <ProfileForm
        identity={identity}
        snapshot={snapshot}
        // Seeded with what the roster already knows, so the first thing a new member sees
        // is their own half-filled page, not an empty form.
        initial={{ id: identity.personId, name: identity.name, status: "published" }}
        isNew
        onCancel={() => onStartedChange(false)}
        onSubmitted={(pr) => {
          onStartedChange(false);
          onSubmitted(pr);
        }}
      />
    );
  }

  return (
    <div className="rounded-sm border border-border p-6">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Welcome, {identity.name.split(" ")[0]}
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-faint">
        You don&apos;t have a page on the lab site yet. It takes about five minutes: your role,
        a photo, a short bio and a couple of links. An admin approves it, and it&apos;s live a
        few minutes after that. You can stop halfway — what you&apos;ve typed is kept in this browser.
      </p>
      <button
        onClick={() => onStartedChange(true)}
        className="mt-4 rounded-sm bg-invert-bg px-4 py-2 font-mono text-[11px] font-bold tracking-wider text-invert-fg uppercase"
      >
        Create my profile
      </button>
    </div>
  );
}

/** The member's own publications, awards and posts, with a way to add more. */
function MyRecords({
  identity,
  snapshot,
  queue,
  onSubmitted,
}: {
  identity: Identity;
  snapshot: Snapshot;
  queue: QueueItem[];
  onSubmitted: (pr: Pr) => void;
}) {
  const [open, setOpen] = useState<string>();
  const personId = identity.personId;

  const mine = useMemo(() => {
    return {
      publications: snapshot.content.publications.filter((p) =>
        p.authors?.some((a) => a.personId === personId)
      ),
      recognitions: snapshot.content.recognitions.filter((r) => r.personId === personId),
      posts: snapshot.content.posts.filter((p) => p.authorId === personId),
    };
  }, [snapshot, personId]);

  // New records the member has submitted that are not live yet.
  const pendingCount = (dir: string) =>
    queue.filter((q) => q.body.includes(`\`${dir}/`)).length;

  const sections = [
    { key: "publications", label: "My publications", count: mine.publications.length, pending: pendingCount("content/publications") },
    { key: "recognitions", label: "My awards", count: mine.recognitions.length, pending: pendingCount("content/recognitions") },
    { key: "posts", label: "My posts", count: mine.posts.length, pending: pendingCount("content/posts") },
  ];

  if (open) {
    const entity = entityByKey(open);
    if (!entity) return null;
    return (
      <div className="space-y-3">
        <button
          onClick={() => setOpen(undefined)}
          className="font-mono text-[11px] text-text-faint hover:text-foreground"
        >
          ← Back to my page
        </button>
        <Notice kind="info">
          Add new {entity.plural.toLowerCase()} here, or fix ones you&apos;re listed on. Every
          change goes to an admin for approval first.
        </Notice>
        <EntityBrowser
          entity={entity}
          snapshot={snapshot}
          // Members may create records and edit the ones that name them — the Worker checks
          // the same thing against the file's current contents, so this can never offer an
          // Edit that ends in a 403. Deleting is for admins.
          canEdit={(r) => isMine(r, personId, open)}
          canDelete={() => false}
          lockedLabel="Admins edit this"
          createSeed={createSeedFor(open, identity)}
          onSubmitted={onSubmitted}
          scopeTo={(r) => isMine(r, personId, open)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {sections.map((s) => (
        <button
          key={s.key}
          onClick={() => setOpen(s.key)}
          className="rounded-sm border border-border p-3 text-left hover:border-brand"
        >
          <p className="text-2xl font-bold text-foreground">
            {s.count}
            {s.pending > 0 && (
              <span className="ml-2 align-middle font-mono text-[10.5px] font-normal text-brand-strong">
                +{s.pending} in review
              </span>
            )}
          </p>
          <p className="font-mono text-[10.5px] tracking-wider text-text-faint uppercase">{s.label}</p>
        </button>
      ))}
    </div>
  );
}

/**
 * What a member's new record starts with: themselves, linked. The link is what makes the
 * record theirs — it is how "My publications" finds it after approval, and it is the one
 * field a reviewer cannot guess if it is missing.
 */
function createSeedFor(kind: string, identity: Identity): Rec {
  const personId = identity.personId;
  if (kind === "publications") {
    return { status: "published", authors: [{ name: identity.name, personId }] };
  }
  if (kind === "recognitions") return { status: "published", personId };
  if (kind === "posts") return { status: "published", kind: "news", authorId: personId };
  return { status: "published" };
}

// Returned-submission notices the member has closed. Per browser; a reviewer's note is
// worth seeing once, not on every visit for the next month.
const DISMISSED_KEY = "xlab-studio-dismissed-returns";
function readDismissed(): number[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}
function writeDismissed(list: number[]): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* ignore */
  }
}

function isMine(record: Rec | undefined, personId: string | undefined, kind: string): boolean {
  if (!record || !personId) return false;
  if (kind === "publications") {
    const authors = record.authors as { personId?: string }[] | undefined;
    return Boolean(authors?.some((a) => a.personId === personId));
  }
  if (kind === "recognitions") return record.personId === personId;
  if (kind === "posts") return record.authorId === personId;
  return false;
}
