"use client";

// What a lab member sees. Two jobs:
//
//   1. First sign-in: their roster entry names a profile id that has no record yet, so this
//      offers to create it. That is what collapses onboarding from three admin actions
//      (stub profile -> link -> invite) down to one (add to roster -> invite). The Worker
//      already permits it: canWritePath matches content/people/<their-id>.yaml by path
//      equality and does not care whether the file exists.
//
//   2. Afterwards: a home page for their own records — profile, publications, awards, posts —
//      so they never have to hunt through the whole lab's data to find their own.
import { useMemo, useState } from "react";
import type { Identity, Snapshot } from "@/lib/studio/api";
import { entityByKey } from "@/lib/studio/entities";
import { personCompleteness } from "@/lib/studio/records";
import { EntityBrowser } from "./entity-browser";

type Rec = Record<string, unknown>;

export function MemberHome({
  identity,
  snapshot,
  onSubmitted,
}: {
  identity: Identity;
  snapshot: Snapshot;
  onSubmitted: (pr: { number: number; url: string }) => void;
}) {
  const profile = useMemo(
    () => snapshot.content.people.find((p) => p.id === identity.personId),
    [snapshot, identity.personId]
  );

  if (!identity.personId) {
    return (
      <Notice title="Your account is not linked to a profile yet">
        Ask an admin to set a profile id for you on the roster. Until then you can look around,
        but you cannot edit anything.
      </Notice>
    );
  }

  if (!profile) {
    return <CreateProfile identity={identity} snapshot={snapshot} onSubmitted={onSubmitted} />;
  }

  const score = personCompleteness(profile);
  return (
    <div className="space-y-5">
      <div className="rounded-sm border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{profile.name}</h2>
            <p className="font-mono text-[11px] text-text-faint">{profile.roleTitle}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10.5px] tracking-wider text-text-faint uppercase">
              Profile complete
            </p>
            <p className="text-lg font-bold text-foreground">{score}%</p>
          </div>
        </div>
        {score < 100 && (
          <ul className="mt-3 space-y-0.5 text-[12.5px] text-text-faint">
            {!profile.photo && <li>· Add a photo</li>}
            {!profile.bio && <li>· Write a short bio</li>}
            {!profile.links?.email && <li>· Add a contact email</li>}
            {!profile.links?.scholar && !profile.links?.website && (
              <li>· Add a Scholar profile or personal site</li>
            )}
            {!profile.affiliations?.length && <li>· Add your affiliation</li>}
            {profile.labTenure?.joinedYear === undefined && <li>· Add the year you joined the lab</li>}
          </ul>
        )}
      </div>

      <MyRecords identity={identity} snapshot={snapshot} onSubmitted={onSubmitted} />
    </div>
  );
}

/** First sign-in: create the profile the roster reserved for this person. */
function CreateProfile({
  identity,
  snapshot,
  onSubmitted,
}: {
  identity: Identity;
  snapshot: Snapshot;
  onSubmitted: (pr: { number: number; url: string }) => void;
}) {
  const [started, setStarted] = useState(false);
  const entity = entityByKey("people");
  if (!entity) return null;

  if (started) {
    return (
      <EntityBrowser
        entity={entity}
        snapshot={snapshot}
        canEdit={(r) => r?.id === identity.personId}
        onSubmitted={onSubmitted}
        // Open straight into a create form seeded with what the roster already knows, so the
        // first thing a new member sees is their own half-filled profile, not an empty list.
        startCreating={{
          id: identity.personId,
          name: identity.name,
          personType: "phd-student",
          status: "published",
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
        You don&apos;t have a profile on the lab site yet. Create one now — add your photo, role,
        a short bio, and your links. It goes to an admin for review, and appears on the site
        once approved.
      </p>
      <button
        onClick={() => setStarted(true)}
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
  onSubmitted,
}: {
  identity: Identity;
  snapshot: Snapshot;
  onSubmitted: (pr: { number: number; url: string }) => void;
}) {
  const [open, setOpen] = useState<string>();

  const mine = useMemo(() => {
    const id = identity.personId;
    return {
      publications: snapshot.content.publications.filter((p) =>
        p.authors?.some((a) => a.personId === id)
      ),
      recognitions: snapshot.content.recognitions.filter((r) => r.personId === id),
      posts: snapshot.content.posts.filter((p) => p.authorId === id),
    };
  }, [snapshot, identity.personId]);

  const sections = [
    { key: "publications", label: "My publications", count: mine.publications.length },
    { key: "recognitions", label: "My awards", count: mine.recognitions.length },
    { key: "posts", label: "My posts", count: mine.posts.length },
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
        <EntityBrowser
          entity={entity}
          snapshot={snapshot}
          // Members may add new records and edit ones they are attached to. Anything else is
          // read-only here; the Worker enforces the same rule server-side.
          canEdit={(r) => isMine(r, identity.personId, open)}
          onSubmitted={onSubmitted}
          scopeTo={(r) => isMine(r, identity.personId, open)}
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
          <p className="text-2xl font-bold text-foreground">{s.count}</p>
          <p className="font-mono text-[10.5px] tracking-wider text-text-faint uppercase">{s.label}</p>
        </button>
      ))}
    </div>
  );
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

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border p-6">
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-faint">{children}</p>
    </div>
  );
}
