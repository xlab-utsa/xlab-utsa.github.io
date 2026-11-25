// The shape of access/roster.json — who may sign in to Studio, and as what.
//
// One schema, used in three places so they can never disagree:
//   1. scripts/validate-content.ts — CI refuses a roster PR that would break sign-in.
//   2. components/studio/roster-manager.tsx — the same errors appear inline before submit.
//   3. (The Worker stays schema-blind on purpose; it only skips entries it cannot use.)
//
// v2 (SPEC.md §8.4): the repo is public, so the roster no longer holds readable email
// addresses. Each entry carries `emailHashes` — an HMAC of each lowercased address under a
// secret only the Worker holds — and a stable `id` that sessions and password records key
// on. A legacy plaintext `email` is still accepted so the switch can happen through Studio
// ("Hash them now" on the roster screen) once the Worker with the secret is deployed; it is
// reported as a warning until then.
//
// CLIENT-SAFE: pure Zod, no fs. Imported by the Studio bundle.
import { z } from "zod";

export const ROSTER_PATH = "access/roster.json";

/** The documentation block at the top of the roster file. Studio rewrites the whole file, so it lives here. */
export const ROSTER_COMMENT: string[] = [
  "Who may sign in to X-Lab Studio, and as what. Managed through Studio's roster screen.",
  "",
  "Deliberately OUTSIDE content/ so it never lands in public/content-snapshot.json.",
  "It lives in the repo (not a database) so that 'who had access when' stays answerable",
  "forever from git history. The repo is public, so addresses are stored only as",
  "emailHashes (HMAC under a secret the Worker holds) — never in plain text (SPEC.md §8.4).",
  "Passwords are never here at all: they live, hashed, in the Worker's private store.",
  "",
  "id:       stable account id (sessions and passwords key on it). Never reuse one.",
  "role:     admin  - full write access, can approve submissions, manages the roster",
  "          editor - full content write access, can approve submissions",
  "          member - edits their own person record and work that names them; may create",
  "                   publications, awards, posts and projects, which wait for approval",
  "emailHashes: the hashed addresses this person signs in with (several are fine).",
  "email:    LEGACY plain-text address — replace via Studio, Roster, Hash them now.",
  "personId: the content/people/<id>.yaml this person owns. Required for members.",
  "githubLogin: lets an admin also sign in with GitHub.",
  "active:   set false to revoke access without losing the historical record."
];

export const RoleSchema = z.enum(["admin", "editor", "member"]);
export type Role = z.infer<typeof RoleSchema>;

/** Same rule as record ids in lib/content/schema.ts — a personId is a filename. */
const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case (e.g. jane-doe)");

/** "hmac-sha256:" + 43 base64url characters (a 32-byte HMAC). */
export const EMAIL_HASH_RE = /^hmac-sha256:[A-Za-z0-9_-]{43}$/;

export const RosterEntrySchema = z.strictObject({
  /** Stable account id. Sessions and password records key on it; never reuse one. */
  id: Slug,
  name: z.string().trim().min(1, "must not be empty"),
  role: RoleSchema,
  /** HMACs of the addresses this person may sign in with. Several are fine. */
  emailHashes: z.array(z.string().regex(EMAIL_HASH_RE, "not a hashed address — use Studio's roster screen")).default([]),
  /** LEGACY plaintext address. Replace with emailHashes (Studio → Roster → "Hash them now"). */
  email: z.email("must be a valid email address").optional(),
  /** The content/people/<id>.yaml this person owns. Required for members. */
  personId: Slug.optional(),
  /** GitHub login, for admins who sign in with GitHub. */
  githubLogin: z.string().trim().min(1).optional(),
  active: z.boolean(),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

export const RosterSchema = z
  .strictObject({
    /** Free-text documentation block kept at the top of the file. */
    _comment: z.array(z.string()).optional(),
    members: z.array(RosterEntrySchema),
  })
  .superRefine((roster, ctx) => {
    const members = roster.members;
    const seenId = new Map<string, number>();
    const seenAddress = new Map<string, number>();
    const seenPerson = new Map<string, number>();

    members.forEach((m, i) => {
      const prevId = seenId.get(m.id);
      if (prevId !== undefined) {
        ctx.addIssue({ code: "custom", path: ["members", i, "id"], message: `duplicate of entry ${prevId + 1} (${members[prevId].name})` });
      } else {
        seenId.set(m.id, i);
      }

      if (m.emailHashes.length === 0 && !m.email && !m.githubLogin) {
        ctx.addIssue({
          code: "custom",
          path: ["members", i, "emailHashes"],
          message: "needs at least one address (or a GitHub login) — otherwise they can never sign in",
        });
      }

      // The same address on two entries would make sign-in pick one arbitrarily.
      for (const key of [...m.emailHashes, ...(m.email ? [`plain:${m.email.trim().toLowerCase()}`] : [])]) {
        const prev = seenAddress.get(key);
        if (prev !== undefined && prev !== i) {
          ctx.addIssue({ code: "custom", path: ["members", i, "emailHashes"], message: `an address here is also on entry ${prev + 1} (${members[prev].name})` });
        } else {
          seenAddress.set(key, i);
        }
      }

      if (m.role === "member" && !m.personId) {
        ctx.addIssue({
          code: "custom",
          path: ["members", i, "personId"],
          message: "a member needs a profile id — it is the only record they may edit",
        });
      }

      // Two ACTIVE entries owning one profile would let each silently overwrite the other's
      // edits. Inactive duplicates are history and are left alone.
      if (m.active && m.personId) {
        const owner = seenPerson.get(m.personId);
        if (owner !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["members", i, "personId"],
            message: `profile "${m.personId}" is already owned by ${members[owner].name}`,
          });
        } else {
          seenPerson.set(m.personId, i);
        }
      }
    });

    // The one rule that protects against locking everyone out of Studio.
    if (!members.some((m) => m.active && m.role === "admin")) {
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: "at least one active admin is required — otherwise nobody can manage the roster",
      });
    }
  });
export type Roster = z.infer<typeof RosterSchema>;

export interface RosterIssue {
  /** Index into members[], or undefined for roster-wide problems. */
  index?: number;
  field?: string;
  message: string;
}

/** Validate a roster and return human-readable issues, or [] when it is fine. */
export function rosterIssues(roster: unknown): RosterIssue[] {
  const result = RosterSchema.safeParse(roster);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const [head, index, field] = issue.path;
    if (head === "members" && typeof index === "number") {
      return { index, field: field === undefined ? undefined : String(field), message: issue.message };
    }
    return { message: issue.message };
  });
}

/** Non-blocking problems: entries that still expose a readable address in the public repo. */
export function rosterWarnings(roster: unknown): RosterIssue[] {
  const result = RosterSchema.safeParse(roster);
  if (!result.success) return [];
  return result.data.members.flatMap((m, index) =>
    m.email
      ? [{ index, field: "email", message: `${m.name}'s address is stored in plain text — fix it in Studio: Roster → "Hash them now"` }]
      : []
  );
}

/** A starting account id for a new entry: their profile id, else their name as a slug. */
export function suggestAccountId(name: string, personId?: string): string {
  if (personId) return personId;
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
