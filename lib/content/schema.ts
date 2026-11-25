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

/**
 * A position at an institution — the person's career, inside or outside the lab.
 *
 * v3: `institutionId` became optional and `organization` (free text) was added, because an
 * alumnus's next employer ("Penn State", "University of Maryland") rarely has an Institution
 * record and creating one per employer is not worth it. Exactly one of the two names the
 * place. By convention the FIRST entry is the person's current position — it is what an
 * alumni tile shows as "now at".
 */
export const AffiliationSchema = z
  .strictObject({
    institutionId: Slug.optional(),
    organization: z.string().trim().min(1).optional(),
    department: z.string().optional(),
    roleTitle: NonEmpty,
    type: AffiliationTypeSchema.optional(),
    startDate: YearMonth.optional(),
    endDate: YearMonth.nullable().optional(),
  })
  .superRefine((a, ctx) => {
    if (!a.institutionId && !a.organization) {
      ctx.addIssue({
        code: "custom",
        path: ["institutionId"],
        message: "choose an institution, or type the organization's name",
      });
    }
    if (a.institutionId && a.organization) {
      ctx.addIssue({
        code: "custom",
        path: ["organization"],
        message: "set either an institution or an organization name, not both",
      });
    }
  });
export type Affiliation = z.infer<typeof AffiliationSchema>;

/**
 * What someone was (or is) IN THE LAB. Declaration order is seniority order — it decides
 * which role wins when a person holds two at once, and the group order on the People page.
 *
 * v3: replaces v2's `personType`. `grad-collaborator` was removed (2026-11-23 meeting:
 * "everyone will fit one of those profiles"); `visiting-faculty` was added.
 */
export const LabRoleTypeSchema = z.enum([
  "lab-lead",
  "visiting-faculty",
  "postdoc",
  "research-staff",
  "phd-student",
  "masters-student",
  "undergrad-student",
]);
export type LabRoleType = z.infer<typeof LabRoleTypeSchema>;

/**
 * One stint in the lab. A person accumulates these: PhD student, then alumni; postdoc, then
 * alumni. `current` is explicit rather than inferred from a missing `end`, because the real
 * data is full of people who have left on a date nobody recorded — "ended, date unknown"
 * has to be sayable without inventing a year.
 */
export const LabRoleSchema = z
  .strictObject({
    role: LabRoleTypeSchema,
    current: z.boolean(),
    start: YearMonth.optional(),
    end: YearMonth.optional(),
    /** Overrides the role's default wording for this stint, e.g. "Visiting Professor". */
    title: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.current && r.end) {
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "a role with an end date cannot be current — untick current, or clear the end date",
      });
    }
    if (r.start && r.end && r.end < r.start) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "ends before it starts" });
    }
  });
export type LabRole = z.infer<typeof LabRoleSchema>;

/** Identifiers that pin a person to their publication record elsewhere. */
export const PersonIdsSchema = z.strictObject({
  orcid: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'must be an ORCID iD like "0000-0002-1825-0097"')
    .optional(),
  /** The `user=` value from a Google Scholar profile URL. */
  scholarId: z.string().regex(/^[A-Za-z0-9_-]{12}$/, "must be the 12-character user= value from a Scholar profile URL").optional(),
  /** DBLP person id, e.g. "13/3489" from dblp.org/pid/13/3489. */
  dblpPid: z.string().regex(/^[0-9a-z]+\/[0-9A-Za-z-]+$/, 'must be a DBLP pid like "13/3489"').optional(),
});

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

export const PersonSchema = z.strictObject({
  id: Slug,
  name: NonEmpty,
  /**
   * v3: replaces `personType` + `labTenure`. Current member = has a `current` role; alumni =
   * has roles, none current. Derived helpers live in lib/content/people.ts — never re-derive
   * these rules inline.
   */
  labRoles: z.array(LabRoleSchema).min(1, "needs at least one lab role"),
  /** Display title line under the name. Free text; the lab role is the structured fact. */
  roleTitle: NonEmpty,
  /**
   * Other spellings this person is published under ("C. Xu", "Xu, Chenhui"). The matcher
   * treats an alias as strongly as the name itself, so list only spellings that really are
   * this person.
   */
  aliases: z.array(NonEmpty).default([]),
  ids: PersonIdsSchema.optional(),
  secondaryTitles: z.array(NonEmpty).optional(),
  photo: AssetPath.optional(),
  office: z.string().optional(),
  bio: z.string().optional(),
  profile: PersonProfileSchema.optional(),
  links: PersonLinksSchema.optional(),
  affiliations: z.array(AffiliationSchema).optional(),
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
  /** Markdown write-up, rendered on the Projects page. */
  description: z.string().optional(),
  thumbnail: AssetPath.optional(),
  /** Small square mark for the project, shown beside its title. */
  icon: AssetPath.optional(),
  /** v3: was `links.publicationId` (one). A project routinely has several papers. */
  publicationIds: z.array(NonEmpty).default([]),
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
  /** v3: the canonical venue record. Wins over `venue` for display once set. */
  venueId: Slug.optional(),
  /** Free-text venue as originally sourced. Kept as the display fallback until `venueId` is set. */
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
  /** DBLP record key, e.g. "conf/iccad/HuXX24" — the stable link to DBLP's metadata. */
  dblpKey: z.string().regex(/^[a-z]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/, 'must be a DBLP key like "conf/iccad/HuXX24"').optional(),
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

export const PostMentionsSchema = z.strictObject({
  personIds: z.array(Slug).default([]),
  projectIds: z.array(Slug).default([]),
  publicationIds: z.array(NonEmpty).default([]),
});

export const PostSchema = z.strictObject({
  id: Slug,
  kind: PostKindSchema,
  date: IsoDate,
  title: NonEmpty,
  summary: NonEmpty,
  /** Markdown body, read from the MDX file content rather than frontmatter. */
  body: z.string().optional(),
  image: AssetPath.optional(),
  /** v3: was a single `authorId`. */
  authorIds: z.array(Slug).default([]),
  tags: z.array(NonEmpty).default([]),
  sourceUrl: Url.optional(),
  /**
   * v3: who and what the post is about — rendered as links, and counted on the other side
   * ("news about this person"). Replaces v2's single `relatedPublicationId`.
   */
  mentions: PostMentionsSchema.optional(),
  ...envelope,
});
export type Post = z.infer<typeof PostSchema>;

// --- Venue (v3) ----------------------------------------------------------------

export const VenueKindSchema = z.enum(["conference", "journal", "workshop", "other"]);
export type VenueKind = z.infer<typeof VenueKindSchema>;

/**
 * Where a paper appeared, once — instead of 235 free-text spellings across 405 papers. Ids
 * follow the DBLP stream key where one exists (`conf/iccad` → `iccad`), so records seeded
 * from DBLP and records added by hand share one naming scheme.
 */
export const VenueSchema = z.strictObject({
  id: Slug,
  /** Acronym or short form shown in charts and compact spots, e.g. "ICCAD". */
  shortName: NonEmpty,
  name: NonEmpty,
  kind: VenueKindSchema,
  /** DBLP stream key, e.g. "conf/iccad" or "journals/tcad". */
  dblpKey: z.string().regex(/^(?:conf|journals|series)\/[A-Za-z0-9_-]+$/, 'must be a DBLP stream key like "conf/iccad"').optional(),
  url: Url.optional(),
  ...envelope,
});
export type Venue = z.infer<typeof VenueSchema>;

// --- GalleryPhoto (v3) ---------------------------------------------------------

/** A lab photo for the homepage banner. */
export const GalleryPhotoSchema = z.strictObject({
  id: Slug,
  image: AssetPath,
  caption: z.string().optional(),
  date: IsoDate.optional(),
  /** Lab members in the photo — optional, confirmed only. */
  personIds: z.array(Slug).default([]),
  /** Where the photo came from, e.g. a LinkedIn post URL or "lab group chat". */
  source: z.string().optional(),
  order: z.number().int().optional(),
  ...envelope,
});
export type GalleryPhoto = z.infer<typeof GalleryPhotoSchema>;

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
  "venues",
  "gallery",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];
