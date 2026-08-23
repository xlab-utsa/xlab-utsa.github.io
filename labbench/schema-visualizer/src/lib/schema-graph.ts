// Hand-encoded mirror of the schema documented in docs/SCHEMA.md and typed in
// types/content.ts (repo root, two levels up from this file). This file is the single
// source of truth for what the visualizer renders — if the real schema changes,
// update this file to match.

export type Tier = "core" | "secondary";

export interface FieldDef {
  name: string;
  type: string;
  required: boolean;
  note?: string;
  /** Set when this field is a foreign key. `to` is the target entity id. */
  fk?: { to: string; via?: string };
}

export interface EntityDef {
  id: string;
  label: string;
  tier: Tier;
  filePath: string;
  summary: string;
  rationale: string;
  fields: FieldDef[];
}

export const entities: EntityDef[] = [
  {
    id: "institution",
    label: "Institution",
    tier: "core",
    filePath: "content/institutions.yaml",
    summary: "Lookup table for places people are affiliated with.",
    rationale:
      "Exists so Affiliation records reference an institution instead of retyping strings. Scoped narrowly: only for places people are affiliated with, not a general org registry — award-granting orgs like \"IBM Research\" stay free text on Recognition.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key (slug)" },
      { name: "name", type: "string", required: true },
      { name: "shortName", type: "string", required: false },
      { name: "url", type: "string", required: false },
      { name: "logo", type: "string", required: false, note: "image path" },
      { name: "city", type: "string", required: false },
      { name: "state", type: "string", required: false },
      { name: "country", type: "string", required: false },
    ],
  },
  {
    id: "person",
    label: "Person",
    tier: "core",
    filePath: "content/people/<slug>.yaml",
    summary: "A lab member — lead, postdoc, student, or collaborator.",
    rationale:
      "photo is always an explicit, human-set path, never inferred from filename matching — the old Hugo site's fuzzy filename-matcher silently failed for 2 of 17 people. labTenure (joined/left year) is kept SEPARATE from affiliations: \"is this person currently active in the lab\" is answered only by labTenure.leftYear being null/absent, independent of which institution(s) they're affiliated with. Collapsing the two breaks the moment someone's institutional affiliation is ongoing but lab involvement has ended, or the reverse.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key (slug)" },
      { name: "name", type: "string", required: true },
      {
        name: "personType",
        type: '"lab-lead" | "postdoc" | "research-staff" | "phd-student" | "masters-student" | "undergrad-student" | "grad-collaborator"',
        required: true,
      },
      { name: "roleTitle", type: "string", required: true, note: "free-text display line" },
      { name: "secondaryTitles", type: "string[]", required: false },
      { name: "photo", type: "string", required: false, note: "explicit path, never fuzzy-matched" },
      { name: "office", type: "string", required: false },
      { name: "bio", type: "string", required: false },
      {
        name: "profile",
        type: "PersonProfile",
        required: false,
        note: "embedded: education[], researchPhilosophy, researchInterests[], researchAgenda[], futureVision, quote",
      },
      {
        name: "links",
        type: "PersonLinks",
        required: false,
        note: "embedded: email, scholar, website, universityProfile, linkedin, github",
      },
      {
        name: "affiliations",
        type: "Affiliation[]",
        required: false,
        note: "embedded array, each: institutionId, department?, roleTitle, type?, startDate?, endDate?",
        fk: { to: "institution", via: "affiliations[].institutionId" },
      },
      {
        name: "labTenure",
        type: "{ joinedYear?, leftYear? }",
        required: false,
        note: "lab membership tenure — deliberately separate from affiliations",
      },
      { name: "sortWeight", type: "number", required: false },
    ],
  },
  {
    id: "research-theme",
    label: "ResearchTheme",
    tier: "core",
    filePath: "content/research/themes.yaml",
    summary: "A titled research area with a description.",
    rationale:
      "Can contain zero or more Projects; a theme with none still renders fine as description-only. Most current themes are description-only today — the site launches fine before every theme has projects attached.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key (slug)" },
      { name: "icon", type: "string", required: false },
      { name: "title", type: "string", required: true },
      { name: "shortDescription", type: "string", required: true },
      { name: "longDescription", type: "string", required: false, note: "markdown" },
      { name: "order", type: "number", required: false },
    ],
  },
  {
    id: "project",
    label: "Project",
    tier: "core",
    filePath: "content/projects/<slug>.yaml",
    summary: "The poloclub-style card unit: a tool, demo, or paper-linked project.",
    rationale:
      "Expected to be the fastest-growing entity over time as more tools/demos exist — closest analog to poloclub's 40+ project cards. themeId is a single optional FK, not many-to-many: every project observed so far belongs to at most one theme conceptually, and this is a trivial additive migration later if that ever changes.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key (slug)" },
      { name: "title", type: "string", required: true },
      { name: "tagline", type: "string", required: true, note: "one line" },
      { name: "description", type: "string", required: false, note: "markdown" },
      { name: "thumbnail", type: "string", required: false },
      {
        name: "themeId",
        type: "string",
        required: false,
        fk: { to: "research-theme" },
      },
      { name: "status", type: '"active" | "deployed" | "archived"', required: false },
      { name: "collaborationWith", type: "string", required: false, note: "free-text EXTERNAL org name, e.g. \"Apple\" — not a Person link" },
      {
        name: "contributors",
        type: "string[]",
        required: false,
        note: "lab members who worked on this project — populate only when confirmed",
        fk: { to: "person" },
      },
      { name: "featured", type: "boolean", required: false },
      { name: "order", type: "number", required: false },
      {
        name: "links.publicationId",
        type: "string",
        required: false,
        note: "one of several link fields (paperUrl, code, demo, video, poster, website)",
        fk: { to: "publication" },
      },
    ],
  },
  {
    id: "publication",
    label: "Publication",
    tier: "core",
    filePath:
      "content/publications/{patents,journals,conferences,workshops,invited-papers,book-chapters}.yaml",
    summary: "One unified shape across all 6 publication categories.",
    rationale:
      "Discriminated by category, with category-specific optional fields (patent numbers, volume/issue, book/publisher) rather than 6 parallel types. id is generated once at normalization and then treated as immutable, since Project and Recognition reference it. authors is an ordered {name, personId?}[] array — name is always the display source of truth, personId is set only for authors who are confirmed lab members (most aren't). This replaced an earlier plain-string design that avoided linking entirely to dodge \"inconsistent partial linking\" — backwards reasoning: partial linking is completely normal, and the old version meant even the PI never linked to his own Person record despite being on nearly every paper. note is for non-award annotations only (\"in press\", \"Spotlight\") — award facts live on Recognition so the two can't drift out of sync.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key — generated once, then immutable" },
      {
        name: "category",
        type: '"patent" | "journal" | "conference" | "workshop" | "invited-paper" | "book-chapter"',
        required: true,
      },
      { name: "title", type: "string", required: true },
      {
        name: "authors[].personId",
        type: "string",
        required: false,
        note: "authors is {name, personId?}[] — most authors have no personId (external co-authors); this is the FK slot for the ones who are lab members",
        fk: { to: "person" },
      },
      { name: "venue", type: "string", required: false },
      { name: "year", type: "number", required: false },
      { name: "dateDisplay", type: "string", required: false },
      { name: "month", type: "string", required: false },
      { name: "location", type: "string", required: false },
      { name: "note", type: "string", required: false, note: 'non-award only, e.g. "in press"' },
      { name: "doi", type: "string", required: false },
      { name: "url / pdfUrl", type: "string", required: false },
      { name: "featured", type: "boolean", required: false },
      { name: "featuredOrder", type: "number", required: false },
      { name: "patentNo / docketNo / applicationNo", type: "string", required: false, note: "patent only" },
      { name: "filedDate / issuedDate / jurisdiction", type: "string", required: false, note: "patent only" },
      { name: "volumeIssue", type: "string", required: false, note: "journal only" },
      { name: "book / editors / publisher / onlineIsbn", type: "string", required: false, note: "book-chapter only" },
    ],
  },
  {
    id: "post",
    label: "Post",
    tier: "core",
    filePath: "content/posts/<yyyy-mm-dd>-<slug>.mdx",
    summary: "News AND Blog, unified with a kind discriminator.",
    rationale:
      "Both are dated, chronologically-sorted feed items; the real difference in the data is just how much content exists per entry, which is naturally optional fields (body, authorId, tags) rather than duplicated feed/pagination logic for two separate types. Verified during the dry run: a news item can carry a short body too, not just a one-liner — confirms the unification was the right call.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key (slug)" },
      { name: "kind", type: '"news" | "blog"', required: true },
      { name: "date", type: "string", required: true, note: "ISO date" },
      { name: "title", type: "string", required: true },
      { name: "summary", type: "string", required: true },
      { name: "body", type: "string", required: false, note: "markdown, effectively required for kind:blog" },
      { name: "image", type: "string", required: false },
      { name: "authorId", type: "string", required: false, fk: { to: "person" } },
      { name: "tags", type: "string[]", required: false },
      { name: "sourceUrl", type: "string", required: false },
      { name: "relatedPublicationId", type: "string", required: false, fk: { to: "publication" } },
    ],
  },
  {
    id: "site-meta",
    label: "SiteMeta",
    tier: "core",
    filePath: "content/site-meta.yaml",
    summary: "Singleton: site title, nav, contact, socials, logo.",
    rationale:
      "contact.address is deliberately freeform and NOT derived from primaryInstitutionId — a lab's mailing address can outlive any one person's institutional affiliation. primaryInstitutionId is a convenience only (e.g. reuse a logo), never the source of truth for address/branding. Both contact and primaryInstitutionId are left null in the current dry-run population pending an explicit content decision.",
    fields: [
      { name: "title / tagline / description", type: "string", required: true },
      { name: "keywords", type: "string[]", required: false },
      { name: "nav", type: "NavItem[]", required: true },
      {
        name: "contact",
        type: "{ email?, phone?, address? }",
        required: false,
        note: "freeform address — deliberately not derived from primaryInstitutionId",
      },
      { name: "primaryInstitutionId", type: "string", required: false, note: "convenience only", fk: { to: "institution" } },
      { name: "recruitingNotice", type: "string", required: false },
      { name: "socialLinks", type: "{ github?, linkedin?, huggingface?, twitter?, youtube? }", required: false },
      { name: "logo", type: "{ light, dark }", required: false },
    ],
  },
  {
    id: "recognition",
    label: "Recognition",
    tier: "secondary",
    filePath: "content/recognitions/<category>.yaml",
    summary: "Awards and honors — the sole authority for award facts.",
    rationale:
      "Publication.note is reserved for non-award annotations so award facts aren't duplicated in two places that can drift apart. The dry run surfaced a real open question here: source data attributes all awards to the PI's own page even when he isn't first author — schema supports per-person attribution via personId, but deciding whose achievement each entry really is is a content decision, not resolved by the schema alone.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key" },
      {
        name: "category",
        type: '"best-paper-award" | "best-paper-nomination" | "best-poster-award" | "international-competition-award" | "professional-honor-award"',
        required: true,
      },
      { name: "personId", type: "string", required: true, fk: { to: "person" } },
      { name: "award", type: "string", required: true },
      { name: "year", type: "number", required: false },
      { name: "dateDisplay", type: "string", required: false },
      { name: "title", type: "string", required: false },
      { name: "venue", type: "string", required: false },
      { name: "org", type: "string", required: false },
      { name: "publicationId", type: "string", required: false, fk: { to: "publication" } },
    ],
  },
  {
    id: "service-record",
    label: "ServiceRecord",
    tier: "secondary",
    filePath: "content/service.yaml",
    summary: "Editorial, conference, TPC, community, and university service roles.",
    rationale:
      "Real periods are irregular (\"2010–2012, 2015, 2018–2019\", \"Multiple semesters\") — periodDisplay is required raw text and the source of truth; startYear/endYear are best-effort, only populated when a record cleanly parses as a single range. Don't model arbitrary interval sets.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key" },
      { name: "personId", type: "string", required: true, fk: { to: "person" } },
      {
        name: "category",
        type: '"editorial" | "conference-leadership" | "technical-program-committee" | "community-service" | "university-service"',
        required: true,
      },
      { name: "role", type: "string", required: true },
      { name: "org", type: "string", required: false },
      { name: "periodDisplay", type: "string", required: true, note: "raw text, source of truth" },
      { name: "startYear / endYear", type: "number", required: false, note: "best-effort only" },
      { name: "isOngoing", type: "boolean", required: false },
    ],
  },
  {
    id: "course",
    label: "Course",
    tier: "secondary",
    filePath: "content/teaching.yaml",
    summary: "Teaching history.",
    rationale: "Simple list matching poloclub's course table pattern — no invented enrollment data.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key" },
      { name: "personId", type: "string", required: true, fk: { to: "person" } },
      { name: "code", type: "string", required: false },
      { name: "title", type: "string", required: true },
      { name: "institutionId", type: "string", required: false, fk: { to: "institution" } },
      { name: "institutionName", type: "string", required: false, note: "fallback free text" },
      { name: "termDisplay", type: "string", required: true, note: "raw text, no invented enrollment data" },
    ],
  },
  {
    id: "sponsor",
    label: "Sponsor",
    tier: "secondary",
    filePath: "content/sponsors.yaml",
    summary: "Logo grid entity. No real data yet.",
    rationale: "Structure defined ahead of need — poloclub has a sponsor-logo grid pattern worth having a slot for.",
    fields: [
      { name: "id", type: "string", required: true, note: "primary key" },
      { name: "name", type: "string", required: true },
      { name: "logo", type: "string", required: true },
      { name: "url", type: "string", required: false },
      { name: "grantNumbers", type: "string[]", required: false },
    ],
  },
];

export interface EdgeDef {
  id: string;
  source: string;
  sourceField: string;
  sourceFieldIndex: number;
  target: string;
}

/** Derived once, not hand-maintained twice — walks entity fields looking for `fk`. */
export const edges: EdgeDef[] = entities.flatMap((e) =>
  e.fields.reduce<EdgeDef[]>((acc, f, index) => {
    if (f.fk) {
      acc.push({
        id: `${e.id}.${f.name}->${f.fk.to}`,
        source: e.id,
        sourceField: f.name,
        sourceFieldIndex: index,
        target: f.fk.to,
      });
    }
    return acc;
  }, []),
);

export const HEADER_HEIGHT = 40;
export const ROW_HEIGHT = 28;
export const CARD_WIDTH = 320;
export const ID_FIELD_INDEX = 0; // every entity's first field is its primary key `id`

export function rowHandleId(entityId: string, fieldIndex: number, kind: "source" | "target") {
  return `${entityId}__field-${fieldIndex}__${kind}`;
}

/** Matches EntityCard's actual rendered height so the layout engine never guesses. */
export function estimateNodeHeight(entity: EntityDef) {
  return HEADER_HEIGHT + entity.fields.length * ROW_HEIGHT;
}
