// Low-level file readers for content/. Filesystem + parsing only — no Zod validation
// (that happens in index.ts, where errors from every file are collected and reported
// together instead of failing on the first bad file).
//
// SERVER/BUILD ONLY. This module uses fs and must never be imported by client code or by
// the Studio UI. Import lib/content/schema.ts there instead — it is pure Zod.
import fs from "fs";
import path from "path";
import matter from "gray-matter";
// v2 uses `yaml` (eemeli) rather than js-yaml: it round-trips comments, reports parse
// errors with line/column, and is the same parser the migration and validation scripts use.
import { parse as parseYaml } from "yaml";
import type { ZodType } from "zod";

/** Overridable so scripts can validate a candidate tree (e.g. content-v2/) before swapping. */
const CONTENT_ROOT = path.join(process.cwd(), process.env.CONTENT_DIR ?? "content");

export class ContentValidationError extends Error {}

/** Parse+validate a single value against a schema, tagging errors with their source file. */
export function validateOrCollect<T>(
  schema: ZodType<T>,
  value: unknown,
  sourceLabel: string,
  errors: string[]
): T | undefined {
  const result = schema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const at = issue.path.length ? ` at "${issue.path.join(".")}"` : "";
      errors.push(`${sourceLabel}${at}: ${issue.message}`);
    }
    return undefined;
  }
  return result.data;
}

/** Throw a single aggregated error if any validation errors were collected. */
export function assertNoErrors(errors: string[], context: string): void {
  if (errors.length > 0) {
    throw new ContentValidationError(
      `Content validation failed (${context}) — ${errors.length} error(s):\n` +
        errors.map((e) => `  - ${e}`).join("\n")
    );
  }
}

function absPath(relativePath: string): string {
  return path.join(CONTENT_ROOT, relativePath);
}

/** Read+parse a single YAML file relative to content/. Returns undefined if missing. */
export function readYaml(relativePath: string): unknown {
  const full = absPath(relativePath);
  if (!fs.existsSync(full)) return undefined;
  return parseYaml(fs.readFileSync(full, "utf-8"));
}

/**
 * Read+parse every *.yaml file directly inside a directory relative to content/.
 *
 * v2 stores one record per file for every entity. The returned `file` is used both as the
 * error label and, by the validator, to assert that the filename matches the record's id —
 * which is what makes duplicate ids structurally impossible.
 */
export function readYamlDir(
  relativeDir: string
): { file: string; basename: string; data: unknown }[] {
  const full = absPath(relativeDir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()
    .map((file) => ({
      file: `${relativeDir}/${file}`,
      basename: file.replace(/\.ya?ml$/, ""),
      data: parseYaml(fs.readFileSync(path.join(full, file), "utf-8")),
    }));
}

/** Read+parse every *.mdx file directly inside a directory relative to content/. */
export function readMdxDir(
  relativeDir: string
): { file: string; basename: string; frontmatter: unknown; body: string }[] {
  const full = absPath(relativeDir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(full, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        file: `${relativeDir}/${file}`,
        basename: file.replace(/\.mdx?$/, ""),
        frontmatter: data,
        body: content.trim(),
      };
    });
}
