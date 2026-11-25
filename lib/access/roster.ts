// The shape of access/roster.json — who may sign in to Studio, and as what.
//
// One schema, used in three places so they can never disagree:
//   1. scripts/validate-content.ts — CI refuses a roster PR that would break sign-in.
//   2. components/studio/roster-manager.tsx — the same errors appear inline before submit.
//   3. (The Worker stays schema-blind on purpose; it only skips entries it cannot use.)
//
// v2 (SPEC.md §8.4): each entry has a stable account `id` that sessions and password records
// key on, so a person's sign-in address can change without losing their password. Passwords
// are never here; they live, hashed, in the Worker's private store.
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
  "forever from git history. Passwords are never here: they live, hashed, in the Worker's",
  "private store.",
  "",
  "id:       stable account id (sessions and passwords key on it). Never reuse one.",
  "email:    the address they sign in with.",
  "role:     admin  - full write access, can approve submissions, manages the roster",
  "          editor - full content write access, can approve submissions",
  "          member - edits their own person record and work that names them; may create",
  "                   publications, awards, posts and projects, which wait for approval",
  "personId: the content/people/<id>.yaml this person owns. Required for members.",
  "githubLogin: lets an admin also sign in with GitHub.",
  "active:   set false to revoke access without losing the historical record.",
];

export const RoleSchema = z.enum(["admin", "editor", "member"]);
export type Role = z.infer<typeof RoleSchema>;

/** Same rule as record ids in lib/content/schema.ts — a personId is a filename. */
const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case (e.g. jane-doe)");

export const RosterEntrySchema = z.strictObject({
  /** Stable account id. Sessions and password records key on it; never reuse one. */
  id: Slug,
  name: z.string().trim().min(1, "must not be empty"),
  /** The address they sign in with. */
  email: z.email("must be a valid email address"),
  role: RoleSchema,
  /** The content/people/<id>.yaml this person owns. Required for members. */
  personId: Slug.optional(),
  /** GitHub login, for admins who also sign in with GitHub. */
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
    const seenEmail = new Map<string, number>();
    const seenPerson = new Map<string, number>();

    members.forEach((m, i) => {
      const prevId = seenId.get(m.id);
      if (prevId !== undefined) {
        ctx.addIssue({ code: "custom", path: ["members", i, "id"], message: `duplicate of entry ${prevId + 1} (${members[prevId].name})` });
      } else {
        seenId.set(m.id, i);
      }

      // The same address on two entries would make sign-in pick one arbitrarily.
      const email = m.email.trim().toLowerCase();
      const prevEmail = seenEmail.get(email);
      if (prevEmail !== undefined) {
        ctx.addIssue({ code: "custom", path: ["members", i, "email"], message: `duplicate of entry ${prevEmail + 1} (${members[prevEmail].name})` });
      } else {
        seenEmail.set(email, i);
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
