// The entity registry: what Studio can manage, and where each record lives on disk.
//
// Adding a content type means adding one entry here and one schema in lib/content/schema.ts.
// Everything else — list view, form, validation, save path — follows automatically.
"use client";

import {
  CourseSchema,
  InstitutionSchema,
  PersonSchema,
  PostSchema,
  ProjectSchema,
  PublicationSchema,
  RecognitionSchema,
  ResearchThemeSchema,
  ServiceRecordSchema,
  SponsorSchema,
} from "@/lib/content/schema";
import type { ZodType } from "zod";
import type { SnapshotContent } from "./api";

export interface EntityDef {
  key: string;
  /** Singular and plural labels for the UI. */
  label: string;
  plural: string;
  schema: ZodType;
  /** Where these records live in the snapshot. */
  snapshotKey: keyof SnapshotContent;
  /** Directory under content/. */
  dir: string;
  /** File extension — posts carry a markdown body, so they are .mdx. */
  ext: "yaml" | "mdx";
  /** Fields shown in the list view, in order. */
  columns: string[];
  /** Discriminated-union key, when the schema is a union (publications). */
  discriminator?: string;
  /** Members may create these but not edit others' (mirrors the Worker's path rules). */
  memberCreatable?: boolean;
}

export const ENTITIES: EntityDef[] = [
  {
    key: "people",
    label: "Person",
    plural: "People",
    schema: PersonSchema,
    snapshotKey: "people",
    dir: "content/people",
    ext: "yaml",
    columns: ["name", "personType", "roleTitle", "status"],
  },
  {
    key: "publications",
    label: "Publication",
    plural: "Publications",
    schema: PublicationSchema,
    snapshotKey: "publications",
    dir: "content/publications",
    ext: "yaml",
    columns: ["title", "category", "year", "venue"],
    discriminator: "category",
    memberCreatable: true,
  },
  {
    key: "recognitions",
    label: "Award",
    plural: "Awards",
    schema: RecognitionSchema,
    snapshotKey: "recognitions",
    dir: "content/recognitions",
    ext: "yaml",
    columns: ["award", "category", "personId", "year"],
    memberCreatable: true,
  },
  {
    key: "posts",
    label: "Post",
    plural: "News & blog",
    schema: PostSchema,
    snapshotKey: "posts",
    dir: "content/posts",
    ext: "mdx",
    columns: ["title", "kind", "date", "status"],
    memberCreatable: true,
  },
  {
    key: "projects",
    label: "Project",
    plural: "Projects",
    schema: ProjectSchema,
    snapshotKey: "projects",
    dir: "content/projects",
    ext: "yaml",
    columns: ["title", "tagline", "projectStatus", "status"],
  },
  {
    key: "themes",
    label: "Research theme",
    plural: "Research themes",
    schema: ResearchThemeSchema,
    snapshotKey: "researchThemes",
    dir: "content/themes",
    ext: "yaml",
    columns: ["title", "shortDescription", "order"],
  },
  {
    key: "institutions",
    label: "Institution",
    plural: "Institutions",
    schema: InstitutionSchema,
    snapshotKey: "institutions",
    dir: "content/institutions",
    ext: "yaml",
    columns: ["name", "shortName", "city", "country"],
  },
  {
    key: "sponsors",
    label: "Sponsor",
    plural: "Sponsors",
    schema: SponsorSchema,
    snapshotKey: "sponsors",
    dir: "content/sponsors",
    ext: "yaml",
    columns: ["name", "url", "status"],
  },
  {
    key: "service",
    label: "Service record",
    plural: "Service",
    schema: ServiceRecordSchema,
    snapshotKey: "service",
    dir: "content/service",
    ext: "yaml",
    columns: ["role", "category", "org", "periodDisplay"],
  },
  {
    key: "courses",
    label: "Course",
    plural: "Teaching",
    schema: CourseSchema,
    snapshotKey: "courses",
    dir: "content/courses",
    ext: "yaml",
    columns: ["title", "code", "termDisplay"],
  },
];

export function entityByKey(key: string): EntityDef | undefined {
  return ENTITIES.find((e) => e.key === key);
}

export function filePathFor(entity: EntityDef, id: string): string {
  return `${entity.dir}/${id}.${entity.ext}`;
}

/**
 * Where an uploaded image for a given record + field belongs, matching the conventions
 * already in public/images/. Returned as the site-relative path stored in the record; the
 * repo path is this with a `public` prefix.
 *
 * Deriving the path rather than letting people choose one is what keeps assets findable and
 * makes the "photo on disk but no photo: field" class of bug impossible to recreate.
 */
export function assetPathFor(
  entity: EntityDef,
  id: string,
  fieldKey: string,
  ext: string
): string {
  switch (`${entity.key}.${fieldKey}`) {
    case "projects.thumbnail":
      return `/images/projects/${id}/thumbnail.${ext}`;
    case "publications.thumbnail":
      return `/images/publications/${id}/thumbnail.${ext}`;
    case "people.photo":
      return `/images/people/${id}.${ext}`;
    case "posts.image":
      return `/images/posts/${id}.${ext}`;
    case "sponsors.logo":
      return `/images/sponsors/${id}.${ext}`;
    case "institutions.logo":
      return `/images/institutions/${id}.${ext}`;
    default:
      return `/images/${entity.key}/${id}-${fieldKey}.${ext}`;
  }
}

/** Repo path for a site-relative asset path. */
export function repoAssetPath(assetPath: string): string {
  return `public${assetPath}`;
}

/**
 * Records with no UI on the public site today. Studio still manages them so the data stays
 * maintained and validated; surfacing them later needs a component, not a migration.
 * (SPEC.md §7.)
 */
export const UNRENDERED_ENTITIES = new Set(["service", "courses"]);

/** Derive a kebab-case id from a title/name, matching the Slug rule in the schema. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
