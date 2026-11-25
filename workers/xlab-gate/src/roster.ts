// Who may sign in, and as what.
//
// The roster lives in the REPO (access/roster.json), not in KV. Three reasons that matters:
// it is version-controlled, so "who had access when" is answerable forever; it is editable
// through the same review flow as everything else; and losing the KV namespace costs
// nothing but passwords and in-flight links (an admin re-issues set-password links).
//
// It is JSON rather than YAML specifically so this Worker needs no parser dependency.
// It is deliberately OUTSIDE content/, so it never lands in the public content snapshot.
import { readFile } from "./github";
import type { Env, Identity, Role } from "./env";

export const ROSTER_PATH = "access/roster.json";

export interface RosterEntry {
  /** Stable account id — sessions and password records key on it. */
  id: string;
  name: string;
  role: Role;
  /** The address they sign in with. */
  email: string;
  /** The content/people/<id>.yaml this person owns and may edit. */
  personId?: string;
  /** GitHub login, for admins who also sign in with GitHub. */
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

/** Pure matching, so it can be tested without KV or GitHub. Case and spaces never matter. */
export function matchEmail(members: RosterEntry[], email: string): RosterEntry | undefined {
  const needle = email.trim().toLowerCase();
  // Guarded on types: one malformed entry must not throw here and lock everyone out.
  return members.find(
    (m) => m.active && typeof m.id === "string" && typeof m.email === "string" && m.email.trim().toLowerCase() === needle
  );
}

export async function findByEmail(env: Env, email: string): Promise<RosterEntry | undefined> {
  const { members } = await loadRoster(env);
  return matchEmail(members, email);
}

export async function findById(env: Env, id: string): Promise<RosterEntry | undefined> {
  const { members } = await loadRoster(env);
  return members.find((m) => m.active && m.id === id);
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

export function toIdentity(entry: RosterEntry, sub: string, email = ""): Identity {
  return {
    sub,
    account: entry.id,
    email,
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
export function canWritePath(
  id: Identity,
  path: string,
  isCreate: boolean,
  /** Current contents of the file when it exists — lets a member edit records they are on. */
  existing?: string,
  /** The contents being submitted — needed only to recognise a self-link (see below). */
  incoming?: string
): boolean {
  if (id.role === "admin") return true;
  if (id.role === "editor") {
    return path.startsWith("content/") || path.startsWith("public/images/");
  }

  // Members: their own person record, plus the collections they contribute to — create
  // freely, edit only records that already name them. They may never touch another
  // person's record.
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

  const contribution =
    path.startsWith("content/publications/") ||
    path.startsWith("content/recognitions/") ||
    path.startsWith("content/posts/") ||
    path.startsWith("content/projects/");
  if (!contribution) return false;
  if (isCreate) return true;
  if (existing === undefined) return false;
  if (ownsRecord(existing, id.personId)) return true;

  // Self-linking (SPEC.md §9.3): a member may claim their own author slot on a paper that
  // does not name them yet — and nothing else. Review still applies.
  return (
    path.startsWith("content/publications/") &&
    incoming !== undefined &&
    isSelfLinkOnly(existing, incoming, id.personId)
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Keys whose LIST items name a record's owners (schema v3): post authors, project contributors. */
const OWNER_LIST_KEYS = ["authorIds", "contributors"];

/**
 * Does this record name the member — as a publication author, award recipient, post author,
 * or project contributor? A textual test rather than a parse, so this Worker stays
 * schema-blind: it knows only that ownership is spelled `personId:`/`authorId:` followed by
 * the id on its own line, or the id as an item of an `authorIds:`/`contributors:` list
 * (block or flow style). A person merely MENTIONED (`mentions.personIds`) does not own the
 * record. Review still happens; this merely lets a member fix a typo in their own work
 * without a round trip through an admin.
 */
export function ownsRecord(content: string, personId: string): boolean {
  const id = escapeRe(personId);
  const text = content.replace(/\r\n/g, "\n");
  if (new RegExp(`^\\s*(?:-\\s+)?(?:personId|authorId):\\s*["']?${id}["']?\\s*(?:#.*)?$`, "m").test(text)) return true;

  const keys = OWNER_LIST_KEYS.join("|");
  // Flow style: authorIds: [a, jane-doe]
  if (new RegExp(`^\\s*(?:${keys}):\\s*\\[(?:[^\\]]*[\\s,])?["']?${id}["']?\\s*[,\\]]`, "m").test(text)) return true;

  // Block style: find the item line, then walk up past sibling items to the key owning the list.
  const lines = text.split("\n");
  const item = new RegExp(`^(\\s*)-\\s+["']?${id}["']?\\s*(?:#.*)?$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(item);
    if (!m) continue;
    const indent = m[1].length;
    for (let k = i - 1; k >= 0; k--) {
      const line = lines[k];
      if (!line.trim()) continue;
      const lead = line.length - line.trimStart().length;
      if (lead === indent && line.trimStart().startsWith("-")) continue; // a sibling item
      const key = line.match(/^(\s*)([A-Za-z_][\w-]*):\s*(?:#.*)?$/);
      if (key && key[1].length <= indent && OWNER_LIST_KEYS.includes(key[2])) return true;
      break;
    }
  }
  return false;
}

/**
 * True when `incoming` is `existing` with exactly ONE line added: `personId: <own id>`,
 * directly under an author's `- name:` line that had no personId yet. Any other difference —
 * a changed character, a second insertion, a link for someone else — fails. Purely textual,
 * so Studio must build the submission by inserting that line into the file's current text.
 */
export function isSelfLinkOnly(existing: string, incoming: string, personId: string): boolean {
  const norm = (t: string) => t.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const a = norm(existing).split("\n");
  const b = norm(incoming).split("\n");
  if (b.length !== a.length + 1) return false;
  const link = new RegExp(`^(\\s*)personId:\\s*["']?${escapeRe(personId)}["']?\\s*$`);

  let inserted = -1;
  for (let i = 0, j = 0; j < b.length; j++) {
    if (i < a.length && b[j] === a[i]) {
      i++;
      continue;
    }
    if (inserted !== -1) return false;
    inserted = j;
  }
  if (inserted < 1) return false;

  const m = b[inserted].match(link);
  const author = b[inserted - 1].match(/^(\s*)-\s+name:\s*\S/);
  if (!m || !author || m[1].length !== author[1].length + 2) return false;
  // The slot must not already carry a link — a second personId would be a takeover.
  const next = b[inserted + 1] ?? "";
  const nextLead = next.length - next.trimStart().length;
  if (nextLead === m[1].length && /^\s*personId:/.test(next)) return false;
  return true;
}
