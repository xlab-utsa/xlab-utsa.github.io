// Who may sign in, and as what.
//
// The roster lives in the REPO (access/roster.json), not in KV. Three reasons that matters:
// it is version-controlled, so "who had access when" is answerable forever; it is editable
// through the same review flow as everything else; and losing the KV namespace costs
// nothing but in-flight sign-in links.
//
// It is JSON rather than YAML specifically so this Worker needs no parser dependency —
// keeping the deployed artifact small and, more importantly, keeping the Worker free of
// anything that would need updating when the content model changes.
//
// It is deliberately OUTSIDE content/, so it never lands in the public content snapshot.
import { readFile } from "./github";
import type { Env, Identity, Role } from "./env";

export const ROSTER_PATH = "access/roster.json";

export interface RosterEntry {
  email: string;
  name: string;
  role: Role;
  /** The content/people/<id>.yaml this person owns and may edit. */
  personId?: string;
  /** GitHub login, for admins who sign in with GitHub rather than email. */
  githubLogin?: string;
  active: boolean;
}

interface Roster {
  members: RosterEntry[];
}

/** Roster changes are rare; a short cache avoids a GitHub round trip on every request. */
let cache: { roster: Roster; at: number } | undefined;
const TTL_MS = 60_000;

export async function loadRoster(env: Env): Promise<Roster> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.roster;
  const file = await readFile(env, ROSTER_PATH);
  if (!file) return { members: [] };
  let roster: Roster;
  try {
    roster = JSON.parse(file.content) as Roster;
  } catch {
    // A malformed roster must fail closed — nobody signs in — rather than open.
    throw new Error(`${ROSTER_PATH} is not valid JSON`);
  }
  cache = { roster, at: Date.now() };
  return roster;
}

export function invalidateRosterCache(): void {
  cache = undefined;
}

export async function findByEmail(env: Env, email: string): Promise<RosterEntry | undefined> {
  const { members } = await loadRoster(env);
  const needle = email.trim().toLowerCase();
  return members.find((m) => m.active && m.email.trim().toLowerCase() === needle);
}

export async function findByGithubLogin(
  env: Env,
  login: string
): Promise<RosterEntry | undefined> {
  const { members } = await loadRoster(env);
  const needle = login.trim().toLowerCase();
  return members.find(
    (m) => m.active && m.githubLogin && m.githubLogin.trim().toLowerCase() === needle
  );
}

export function toIdentity(entry: RosterEntry, sub?: string): Identity {
  return {
    sub: sub ?? entry.email.toLowerCase(),
    email: entry.email,
    name: entry.name,
    role: entry.role,
    personId: entry.personId,
  };
}

// --- authorization -------------------------------------------------------------

export function canApprove(id: Identity): boolean {
  return id.role === "admin" || id.role === "editor";
}

/**
 * Path-level write authorization. Deliberately expressed as PATH RULES rather than content
 * rules, so this Worker stays schema-blind: it never needs to know what a Person or a
 * Publication is, only which files a role may touch.
 *
 * Anything subtler than this is caught by admin review, which every submission passes
 * through regardless of role.
 */
export function canWritePath(id: Identity, path: string, isCreate: boolean): boolean {
  if (id.role === "admin") return true;
  if (id.role === "editor") {
    return path.startsWith("content/") || path.startsWith("public/images/");
  }

  // Members: their own person record, plus create-only in the collections they contribute
  // to. They may never edit or delete another person's record.
  //
  // Every rule here is guarded on personId being present. Without the guard, a member whose
  // roster entry has no linked profile would be authorized for the literal path
  // ".../undefined.png" — harmless in practice, but it is exactly the kind of hole that
  // stops being harmless once someone adds a rule above it.
  if (!id.personId) return false;

  // Path equality, not a prefix — and deliberately not conditioned on the file already
  // existing, which is what lets a member CREATE their own profile on first sign-in.
  if (path === `content/people/${id.personId}.yaml`) return true;
  if (path === `public/images/people/${id.personId}.png`) return true;
  if (path === `public/images/people/${id.personId}.jpg`) return true;

  if (isCreate) {
    return (
      path.startsWith("content/publications/") ||
      path.startsWith("content/recognitions/") ||
      path.startsWith("content/posts/")
    );
  }
  return false;
}
