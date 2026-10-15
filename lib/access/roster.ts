// The shape of access/roster.json — who may sign in to Studio, and as what.
//
// One schema, used in three places so they can never disagree:
//   1. scripts/validate-content.ts — CI refuses a roster PR that would break sign-in.
//   2. components/studio/roster-manager.tsx — the same errors appear inline before submit.
//   3. (The Worker stays schema-blind on purpose; it only skips entries with no email.)
//
// CLIENT-SAFE: pure Zod, no fs. Imported by the Studio bundle.
import { z } from "zod";

export const ROSTER_PATH = "access/roster.json";

export const RoleSchema = z.enum(["admin", "editor", "member"]);
export type Role = z.infer<typeof RoleSchema>;

/** Same rule as record ids in lib/content/schema.ts — a personId is a filename. */
const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case (e.g. jane-doe)");

export const RosterEntrySchema = z.strictObject({
  email: z.email("must be a valid email address"),
  name: z.string().trim().min(1, "must not be empty"),
  role: RoleSchema,
  /** The content/people/<id>.yaml this person owns. Required for members. */
  personId: Slug.optional(),
  /** GitHub login, for admins who sign in with GitHub rather than a link. */
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
    const seenEmail = new Map<string, number>();
    const seenPerson = new Map<string, number>();

    members.forEach((m, i) => {
      const email = m.email.trim().toLowerCase();
      const prev = seenEmail.get(email);
      if (prev !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["members", i, "email"],
          message: `duplicate of entry ${prev + 1} (${members[prev].name})`,
        });
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
