// Schema v2 — the SINGLE source of truth for every content shape in this repo.
//
// This file is authoritative. The TypeScript types the app uses are derived from these
// schemas via z.infer, so a type and its validator can never drift apart. (v1 kept a
// hand-written mirror in types/content.ts; the two had already diverged before it was
// deleted. Do not reintroduce a parallel type file.)
//
// Three properties every schema here must preserve:
//   1. STRICT — unknown keys are an error, not silently dropped. A typo'd field name
//      fails the build instead of vanishing.
//   2. FORMAT-VALIDATED — URLs, emails, DOIs, dates, and asset paths are checked, not
//      just "is a string".
//   3. CLIENT-SAFE — no fs, no node builtins. This file is imported by the Studio UI in
//      the browser as well as by the build. Keep it that way.
//
// Cross-record rules that a per-record schema cannot express (unique ids, foreign-key
// resolution, asset existence) live in lib/content/validate.ts.
import { z } from "zod";

// --- Reusable primitives -------------------------------------------------------

const NonEmpty = z.string().trim().min(1, "must not be empty");

/** Lowercase kebab-case identifier. Record ids double as filenames, so keep them safe. */
const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case (e.g. jane-doe)");

const Url = z.url("must be a full URL including https://");
const Email = z.email("must be a valid email address");

const Year = z
  .number()
  .int("must be a whole number")
  .min(1900, "looks too early")
  .max(2100, "looks too far in the future");

/** "YYYY" or "YYYY-MM" — used for tenure, affiliations, and patent dates. */
const YearMonth = z
  .string()
  .regex(/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/, 'must be "YYYY" or "YYYY-MM"');

/**
 * Full ISO calendar date, "YYYY-MM-DD" — used for post dates.
 *
 * Preprocessed because YAML parsers resolve an unquoted `2023-01-09` into a JS Date, so
 * frontmatter dates arrive as Date objects rather than strings. Normalizing here means
 * authors can quote them or not and both work.
 */
const IsoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z
    .string()
    .regex(
      /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
      'must be "YYYY-MM-DD"'
    )
);

/**
 * A path into public/. Validated for shape here; validate.ts separately checks the file
 * actually exists on disk, which is what stops the "photo on disk but no photo: field"
 * and "sponsor logo referenced but missing" classes of bug.
 */
const AssetPath = z
  .string()
  .regex(
    /^\/images\/[A-Za-z0-9\-_/]+\.(?:png|jpe?g|svg|webp|avif)$/i,
    'must be a public asset path like "/images/people/jane-doe.png"'
  );

/** Bare DOI, not a URL — e.g. "10.1145/3079856.3080244". */
const Doi = z
  .string()
  .regex(/^10\.\d{4,9}\/\S+$/, 'must be a bare DOI like "10.1145/3079856"');

const Month = z.enum([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

// --- Common envelope -----------------------------------------------------------

/** Publication state. `draft` and `hidden` records are excluded from the public site. */
export const RecordStatusSchema = z.enum(["draft", "published", "hidden"]);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

/**
 * Where a record came from. In v1 this lived only in YAML comments, which any programmatic
 * writer destroys — moving it into the data is what lets Studio write records safely.
 */
export const ProvenanceSchema = z.strictObject({
  source: z.string().optional(),
  note: z.string().optional(),
});

/** Spread into every top-level entity. */
const envelope = {
  status: RecordStatusSchema.default("published"),
  updatedAt: IsoDate.optional(),
  updatedBy: z.string().optional(),
  _meta: ProvenanceSchema.optional(),
};

// --- Institution ---------------------------------------------------------------

export const InstitutionSchema = z.strictObject({
  id: Slug,
  name: NonEmpty,
  shortName: z.string().optional(),
  url: Url.optional(),
  logo: AssetPath.optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  ...envelope,
});
export type Institution = z.infer<typeof InstitutionSchema>;

// --- Person --------------------------------------------------------------------

export const AffiliationTypeSchema = z.enum([
  "primary",
  "adjunct",
  "visiting",
  "affiliate",
]);
export type AffiliationType = z.infer<typeof AffiliationTypeSchema>;

export const AffiliationSchema = z.strictObject({
  institutionId: Slug,
  department: z.string().optional(),
  roleTitle: NonEmpty,
  type: AffiliationTypeSchema.optional(),
  startDate: YearMonth.optional(),
  endDate: YearMonth.nullable().optional(),
});
export type Affiliation = z.infer<typeof AffiliationSchema>;

export const PersonTypeSchema = z.enum([
  "lab-lead",
  "postdoc",
  "research-staff",
  "phd-student",
  "masters-student",
  "undergrad-student",
  "grad-collaborator",
]);
export type PersonType = z.infer<typeof PersonTypeSchema>;

export const EducationEntrySchema = z.strictObject({
  degree: NonEmpty,
  institution: NonEmpty,
  year: Year.optional(),
  note: z.string().optional(),
});

export const ResearchAgendaItemSchema = z.strictObject({
  project: NonEmpty,
  description: NonEmpty,
  representativeTechniques: z.array(NonEmpty).default([]),
});

export const PersonProfileSchema = z.strictObject({
  education: z.array(EducationEntrySchema).optional(),
  researchPhilosophy: z.string().optional(),
  researchInterests: z.array(NonEmpty).optional(),
  researchAgenda: z.array(ResearchAgendaItemSchema).optional(),
  futureVision: z.string().optional(),
  quote: z.string().optional(),
});

export const PersonLinksSchema = z.strictObject({
  email: Email.optional(),
  scholar: Url.optional(),
  website: Url.optional(),
  universityProfile: Url.optional(),
  linkedin: Url.optional(),
  github: Url.optional(),
  /** Overrides the card click target; see the fallback chain in lib/team.ts. */
  redirectUrl: Url.optional(),
});

export const LabTenureSchema = z.strictObject({
  // Left optional rather than required: 16 existing records have no sourced joined year and
  // the project's rule is never to invent data. validate.ts reports missing values as a
  // WARNING, and the Studio form requires it for new records.
  joinedYear: Year.optional(),
  /** null/absent = still in the lab. Setting this is what moves someone to alumni. */
  leftYear: Year.nullable().optional(),
});

export const PersonSchema = z.strictObject({
  id: Slug,
  name: NonEmpty,
  personType: PersonTypeSchema,
  roleTitle: NonEmpty,
  secondaryTitles: z.array(NonEmpty).optional(),
  photo: AssetPath.optional(),
  office: z.string().optional(),
  bio: z.string().optional(),
  profile: PersonProfileSchema.optional(),
  links: PersonLinksSchema.optional(),
  affiliations: z.array(AffiliationSchema).optional(),
  labTenure: LabTenureSchema.optional(),
  sortWeight: z.number().int().optional(),
  ...envelope,
});
export type Person = z.infer<typeof PersonSchema>;

// --- ResearchTheme -------------------------------------------------------------

export const ResearchThemeSchema = z.strictObject({
  id: Slug,
  icon: z.string().optional(),
  title: NonEmpty,
  shortDescription: NonEmpty,
  longDescription: z.string().optional(),
  order: z.number().int().optional(),
  ...envelope,
});
export type ResearchTheme = z.infer<typeof ResearchThemeSchema>;

// --- Project -------------------------------------------------------------------

export const ProjectStatusSchema = z.enum(["active", "deployed", "archived"]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectLinksSchema = z.strictObject({
  paperUrl: Url.optional(),
  publicationId: z.string().optional(),
  code: Url.optional(),
  demo: Url.optional(),
  video: Url.optional(),
  poster: Url.optional(),
  website: Url.optional(),
});

export const ProjectSchema = z.strictObject({
  id: Slug,
  title: NonEmpty,
  tagline: NonEmpty,
  description: z.string().optional(),
  thumbnail: AssetPath.optional(),
  // v2: was a single `themeId`. Projects and papers routinely span more than one research
  // thrust, and forcing a single tag is part of why only 17 of 301 publications were tagged.
  themeIds: z.array(Slug).default([]),
  projectStatus: ProjectStatusSchema.optional(),
  /** Free-text EXTERNAL org (e.g. "Apple") — not a Person reference. */
  collaborationWith: z.string().optional(),
  contributors: z.array(Slug).default([]),
  featured: z.boolean().default(false),
  order: z.number().int().optional(),
  links: ProjectLinksSchema.optional(),
  ...envelope,
});
export type Project = z.infer<typeof ProjectSchema>;

// --- Publication ---------------------------------------------------------------

export const PublicationCategorySchema = z.enum([
  "patent",
  "journal",
  "conference",
  "workshop",
  "invited-paper",
  "book-chapter",
]);
export type PublicationCategory = z.infer<typeof PublicationCategorySchema>;

export const AuthorRefSchema = z.strictObject({
  /** Display text, source of truth for author order and formatting. */
  name: NonEmpty,
  /** Set ONLY when this author is a known lab member. */
  personId: Slug.optional(),
});
export type AuthorRef = z.infer<typeof AuthorRefSchema>;

/** Fields every publication carries, regardless of category. */
const publicationBase = {
  id: NonEmpty,
  title: NonEmpty,
  authors: z.array(AuthorRefSchema).min(1, "needs at least one author"),
  themeIds: z.array(Slug).default([]),
  thumbnail: AssetPath.optional(),
  venue: z.string().optional(),
  year: Year.optional(),
  dateDisplay: z.string().optional(),
  month: Month.optional(),
  location: z.string().optional(),
  /** "in press", "Spotlight" — NOT award info, which belongs on Recognition. */
  note: z.string().optional(),
  doi: Doi.optional(),
  url: Url.optional(),
  pdfUrl: Url.optional(),
  featured: z.boolean().default(false),
  featuredOrder: z.number().int().optional(),
  ...envelope,
};

// v2: a discriminated union rather than one flat type with every category's fields
// optional. This makes it impossible for a journal article to carry `patentNo`, and lets
// the Studio render exactly the right form fields per category.

export const PatentPublicationSchema = z.strictObject({
  ...publicationBase,
  category: z.literal("patent"),
  patentNo: z.string().optional(),
  docketNo: z.string().optional(),
  applicationNo: z.string().optional(),
  filedDate: YearMonth.optional(),
  issuedDate: YearMonth.optional(),
  jurisdiction: z.string().optional(),
});

export const JournalPublicationSchema = z.strictObject({
  ...publicationBase,
  category: z.literal("journal"),
  volumeIssue: z.string().optional(),
});

export const BookChapterPublicationSchema = z.strictObject({
  ...publicationBase,
  category: z.literal("book-chapter"),
  book: z.string().optional(),
  editors: z.string().optional(),
  publisher: z.string().optional(),
  onlineIsbn: z.string().optional(),
});

export const ConferencePublicationSchema = z.strictObject({
  ...publicationBase,
  category: z.literal("conference"),
});

export const WorkshopPublicationSchema = z.strictObject({
  ...publicationBase,
  category: z.literal("workshop"),
});

export const InvitedPaperPublicationSchema = z.strictObject({
  ...publicationBase,
  category: z.literal("invited-paper"),
});

export const PublicationSchema = z.discriminatedUnion("category", [
  PatentPublicationSchema,
  JournalPublicationSchema,
  BookChapterPublicationSchema,
  ConferencePublicationSchema,
  WorkshopPublicationSchema,
  InvitedPaperPublicationSchema,
]);
export type Publication = z.infer<typeof PublicationSchema>;

// --- Post (news + blog) --------------------------------------------------------

export const PostKindSchema = z.enum(["news", "blog"]);
export type PostKind = z.infer<typeof PostKindSchema>;

export const PostSchema = z.strictObject({
  id: Slug,
  kind: PostKindSchema,
  date: IsoDate,
  title: NonEmpty,
  summary: NonEmpty,
  /** Markdown body, read from the MDX file content rather than frontmatter. */
  body: z.string().optional(),
  image: AssetPath.optional(),
  authorId: Slug.optional(),
  tags: z.array(NonEmpty).default([]),
  sourceUrl: Url.optional(),
  relatedPublicationId: z.string().optional(),
  ...envelope,
});
export type Post = z.infer<typeof PostSchema>;

// --- Recognition ---------------------------------------------------------------

export const RecognitionCategorySchema = z.enum([
  "best-paper-award",
  "best-paper-nomination",
  "best-poster-award",
  "international-competition-award",
  "professional-honor-award",
]);
export type RecognitionCategory = z.infer<typeof RecognitionCategorySchema>;

export const RecognitionSchema = z.strictObject({
  id: NonEmpty,
  category: RecognitionCategorySchema,
  personId: Slug,
  award: NonEmpty,
  year: Year.optional(),
  dateDisplay: z.string().optional(),
  title: z.string().optional(),
  venue: z.string().optional(),
  org: z.string().optional(),
  /** Award facts live here, never duplicated into Publication.note. */
  publicationId: z.string().optional(),
  ...envelope,
});
export type Recognition = z.infer<typeof RecognitionSchema>;

// --- ServiceRecord -------------------------------------------------------------

export const ServiceCategorySchema = z.enum([
  "editorial",
  "conference-leadership",
  "technical-program-committee",
  "community-service",
  "university-service",
]);
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const ServiceRecordSchema = z.strictObject({
  id: NonEmpty,
  personId: Slug,
  category: ServiceCategorySchema,
  role: NonEmpty,
  org: z.string().optional(),
  periodDisplay: NonEmpty,
  startYear: Year.optional(),
  endYear: Year.optional(),
  isOngoing: z.boolean().default(false),
  ...envelope,
});
export type ServiceRecord = z.infer<typeof ServiceRecordSchema>;

// --- Course --------------------------------------------------------------------

export const CourseSchema = z.strictObject({
  id: NonEmpty,
  personId: Slug,
  code: z.string().optional(),
  title: NonEmpty,
  institutionId: Slug.optional(),
  /** Fallback free text when the institution isn't a normalized record. */
  institutionName: z.string().optional(),
  termDisplay: NonEmpty,
  ...envelope,
});
export type Course = z.infer<typeof CourseSchema>;

// --- Sponsor -------------------------------------------------------------------

export const SponsorSchema = z.strictObject({
  id: Slug,
  name: NonEmpty,
  logo: AssetPath.optional(),
  url: Url.optional(),
  grantNumbers: z.array(NonEmpty).default([]),
  ...envelope,
});
export type Sponsor = z.infer<typeof SponsorSchema>;

// --- SiteMeta (singleton) ------------------------------------------------------

export const NavItemSchema: z.ZodType<{
  label: string;
  path: string;
  children?: { label: string; path: string; children?: unknown[] }[];
}> = z.lazy(() =>
  z.strictObject({
    label: NonEmpty,
    path: NonEmpty,
    children: z.array(NavItemSchema).optional(),
  })
);

export const SiteMetaSchema = z.strictObject({
  title: NonEmpty,
  tagline: NonEmpty,
  description: NonEmpty,
  keywords: z.array(NonEmpty).default([]),
  nav: z.array(NavItemSchema),
  contact: z
    .strictObject({
      email: Email.optional(),
      phone: z.string().nullable().optional(),
      address: z
        .strictObject({
          line1: z.string().optional(),
          line2: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zip: z.string().optional(),
          country: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  /** Convenience only (e.g. reusing a logo) — never a source of truth. */
  primaryInstitutionId: Slug.optional(),
  recruitingNotice: z.string().optional(),
  socialLinks: z
    .strictObject({
      github: Url.nullable().optional(),
      linkedin: Url.nullable().optional(),
      scholar: Url.nullable().optional(),
      huggingface: Url.nullable().optional(),
      twitter: Url.nullable().optional(),
      youtube: Url.nullable().optional(),
    })
    .optional(),
  logo: z
    .strictObject({
      light: AssetPath,
      dark: AssetPath,
    })
    .optional(),
  // Singleton: carries provenance but not the draft/published envelope — there is only
  // ever one site record and it is always live.
  _meta: ProvenanceSchema.optional(),
});
export type SiteMeta = z.infer<typeof SiteMetaSchema>;

// --- Entity registry -----------------------------------------------------------
// Drives the migration script, the validator, the snapshot builder, and (in P3) the
// Studio's entity list. Adding a content type means adding one entry here.

export const ENTITY_KINDS = [
  "institutions",
  "people",
  "themes",
  "projects",
  "publications",
  "posts",
  "recognitions",
  "service",
  "courses",
  "sponsors",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];
