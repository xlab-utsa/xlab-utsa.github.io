// Turning edited records into file content, and auditing the content set for problems.
"use client";

import { stringify } from "yaml";
import { filePathFor, type EntityDef } from "./entities";
import type { FileChange, SnapshotContent } from "./api";

// --- serialization -------------------------------------------------------------

/** Drop empty values so records stay minimal and diffs stay readable. */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const arr = value.map(prune).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = prune(v);
      if (p !== undefined) out[k] = p;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === "" || value === undefined) return undefined;
  return value;
}

/**
 * Serialize a record to its on-disk representation.
 *
 * Posts are MDX: the markdown body lives below the frontmatter, not inside it, so the body
 * is split back out here. Everything else is plain YAML.
 */
export function serializeRecord(entity: EntityDef, record: Record<string, unknown>): string {
  const cleaned = (prune(record) ?? {}) as Record<string, unknown>;

  if (entity.ext === "mdx") {
    const { body, ...frontmatter } = cleaned as { body?: string };
    const yaml = stringify(frontmatter, { lineWidth: 0 }).trimEnd();
    return `---\n${yaml}\n---\n\n${(body ?? "").trim()}\n`;
  }
  return stringify(cleaned, { lineWidth: 0 });
}

/**
 * The file set a submission sends for one record: the serialized record plus any images
 * chosen for it, in ONE payload — so a reviewer never sees a record pointing at a file that
 * does not exist yet, and CI's asset check cannot fail spuriously.
 *
 * Shared by the generic form and the member profile form so the two can never diverge in
 * what they commit.
 */
export function buildRecordFiles(
  entity: EntityDef,
  record: Record<string, unknown>,
  /** Uploaded images not yet committed, keyed by repo path (public/images/...). */
  assets: Record<string, string>
): FileChange[] {
  return [
    { path: filePathFor(entity, String(record.id)), content: serializeRecord(entity, record) },
    ...Object.entries(assets).map(([path, contentBase64]) => ({ path, contentBase64 })),
  ];
}

// --- image preparation ---------------------------------------------------------

/**
 * Downscale and re-encode an image in the browser before it is committed.
 *
 * Uploads land in the git repo permanently, so a 6 MB phone photo would be carried in every
 * clone forever. Capping the long edge and re-encoding keeps member photos in the tens of
 * kilobytes. PNG input is preserved as PNG because logos and cutouts rely on transparency;
 * everything else becomes JPEG, which is far smaller for photographs.
 */
export async function prepareImage(
  file: File,
  maxEdge = 900
): Promise<{ base64: string; ext: "png" | "jpg"; bytes: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("could not process this image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  const dataUrl = keepAlpha
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", 0.85);

  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return {
    base64,
    ext: keepAlpha ? "png" : "jpg",
    bytes: Math.round((base64.length * 3) / 4),
  };
}

// --- data health ---------------------------------------------------------------
//
// There used to be a second copy of lib/content/validate.ts here, rewritten for the browser,
// because the snapshot carried no verdict for Studio to display. The two copies had already
// drifted — different checks, different wording. The real validator now runs once at build
// time and its findings ship inside the snapshot as `report`, so there is exactly one place
// a rule is written. See scripts/build-snapshot.ts.

export interface ProfileTodo {
  key: "photo" | "title" | "bio" | "email" | "scholarOrSite" | "affiliation" | "joinedYear";
  /** Imperative, as shown in a to-do list. */
  label: string;
  done: boolean;
}

/**
 * What a profile still lacks, in the order it matters to a visitor. ONE list, used by the
 * member's home page, the card editor's to-do rail and the roster nudge — so "71 %" means
 * the same thing everywhere.
 */
export function profileTodos(person: Partial<SnapshotContent["people"][number]> | Record<string, unknown>): ProfileTodo[] {
  const p = person as Partial<SnapshotContent["people"][number]>;
  return [
    { key: "photo", label: "Add a photo", done: Boolean(p.photo) },
    { key: "title", label: "Write your title line", done: Boolean(p.roleTitle) },
    { key: "bio", label: "Write a short bio", done: Boolean(p.bio) },
    { key: "scholarOrSite", label: "Link your Scholar profile or website", done: Boolean(p.links?.scholar || p.links?.website) },
    { key: "email", label: "Add a contact email", done: Boolean(p.links?.email) },
    { key: "affiliation", label: "Add your affiliation", done: Boolean(p.affiliations?.length) },
    { key: "joinedYear", label: "Add the year you joined", done: p.labTenure?.joinedYear !== undefined },
  ];
}

/** 0–100 completeness for a person, from the same list as profileTodos(). */
export function personCompleteness(person: SnapshotContent["people"][number] | Record<string, unknown>): number {
  const todos = profileTodos(person);
  return Math.round((todos.filter((t) => t.done).length / todos.length) * 100);
}
