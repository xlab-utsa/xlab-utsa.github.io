// Typed content getters for the app. Reads YAML/MDX from content/, validates every record
// against schema.ts, and fails the build (via ContentValidationError) with every problem
// found across the whole tree at once rather than stopping at the first bad file.
//
// SERVER/BUILD ONLY — this pulls in loader.ts, which uses fs. The Studio UI must import
// lib/content/schema.ts directly instead.
//
// v2 layout: every entity is one record per file in its own directory. See
// scripts/migrate-content-v2.mjs for why.
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
  SiteMetaSchema,
  SponsorSchema,
  type Course,
  type Institution,
  type Person,
  type Post,
  type Project,
  type Publication,
  type PublicationCategory,
  type Recognition,
  type ResearchTheme,
  type ServiceRecord,
  type SiteMeta,
  type Sponsor,
} from "./schema";
import {
  assertNoErrors,
  readMdxDir,
  readYaml,
  readYamlDir,
  validateOrCollect,
} from "./loader";

// Re-export types so callers don't need to reach into ./schema directly.
export type {
  Affiliation,
  AuthorRef,
  Course,
  EntityKind,
  Institution,
  Person,
  PersonType,
  Post,
  PostKind,
  Project,
  Publication,
  PublicationCategory,
  Recognition,
  RecognitionCategory,
  RecordStatus,
  ServiceRecord,
  SiteMeta,
  Sponsor,
} from "./schema";

export interface AllContent {
  siteMeta: SiteMeta;
  institutions: Institution[];
  people: Person[];
  researchThemes: ResearchTheme[];
  projects: Project[];
  publications: Publication[];
  posts: Post[];
  recognitions: Recognition[];
  service: ServiceRecord[];
  courses: Course[];
  sponsors: Sponsor[];
}

let rawCache: AllContent | undefined;
let publishedCache: AllContent | undefined;

/** Validate a directory of one-record-per-file YAML. */
function loadDir<T>(
  dir: string,
  schema: Parameters<typeof validateOrCollect<T>>[0],
  errors: string[]
): T[] {
  return readYamlDir(dir)
    .map(({ file, basename, data }) => {
      const rec = validateOrCollect(schema, data, file, errors);
      // The filename is the primary key. Enforcing filename === id is what makes duplicate
      // ids impossible: a filesystem cannot hold two files with the same name.
      if (rec && (rec as { id?: string }).id !== basename) {
        errors.push(
          `${file}: id "${(rec as { id?: string }).id}" does not match its filename "${basename}"`
        );
      }
      return rec;
    })
    .filter((v): v is T => v !== undefined);
}

/**
 * Every record in content/, including drafts and hidden ones.
 * Used by the snapshot builder and the validator; the site itself uses loadAll().
 */
export function loadAllRecords(): AllContent {
  if (rawCache) return rawCache;
  const errors: string[] = [];

  const siteMeta = validateOrCollect(
    SiteMetaSchema,
    readYaml("site.yaml"),
    "site.yaml",
    errors
  );

  const posts = readMdxDir("posts")
    .map(({ file, basename, frontmatter, body }) => {
      const rec = validateOrCollect(
        PostSchema,
        { ...(frontmatter as object), body: body || undefined },
        file,
        errors
      );
      if (rec && rec.id !== basename) {
        errors.push(`${file}: id "${rec.id}" does not match its filename "${basename}"`);
      }
      return rec;
    })
    .filter((v): v is Post => v !== undefined);

  const content: AllContent = {
    siteMeta: siteMeta as SiteMeta,
    institutions: loadDir<Institution>("institutions", InstitutionSchema, errors),
    people: loadDir<Person>("people", PersonSchema, errors),
    researchThemes: loadDir<ResearchTheme>("themes", ResearchThemeSchema, errors),
    projects: loadDir<Project>("projects", ProjectSchema, errors),
    publications: loadDir<Publication>("publications", PublicationSchema, errors),
    posts,
    recognitions: loadDir<Recognition>("recognitions", RecognitionSchema, errors),
    service: loadDir<ServiceRecord>("service", ServiceRecordSchema, errors),
    courses: loadDir<Course>("courses", CourseSchema, errors),
    sponsors: loadDir<Sponsor>("sponsors", SponsorSchema, errors),
  };

  assertNoErrors(errors, "content/**");
  rawCache = content;
  return rawCache;
}

/**
 * What the public site renders: published records only. Draft and hidden records stay in
 * the repo and in Studio but never reach the built site.
 */
function loadAll(): AllContent {
  if (publishedCache) return publishedCache;
  const all = loadAllRecords();
  const pub = <T extends { status: string }>(xs: T[]) =>
    xs.filter((x) => x.status === "published");

  publishedCache = {
    siteMeta: all.siteMeta,
    institutions: pub(all.institutions),
    people: pub(all.people),
    researchThemes: pub(all.researchThemes),
    projects: pub(all.projects),
    publications: pub(all.publications),
    posts: pub(all.posts),
    recognitions: pub(all.recognitions),
    service: pub(all.service),
    courses: pub(all.courses),
    sponsors: pub(all.sponsors),
  };
  return publishedCache;
}

// --- SiteMeta -----------------------------------------------------------------
export function getSiteMeta(): SiteMeta {
  return loadAll().siteMeta;
}

// --- Institution ----------------------------------------------------------------
export function getAllInstitutions(): Institution[] {
  return loadAll().institutions;
}
export function getInstitutionById(id: string): Institution | undefined {
  return loadAll().institutions.find((i) => i.id === id);
}

// --- Person -----------------------------------------------------------------
export function getAllPeople(): Person[] {
  return loadAll().people;
}
export function getPersonById(id: string): Person | undefined {
  return loadAll().people.find((p) => p.id === id);
}
export function getCurrentPeople(): Person[] {
  return loadAll().people.filter(
    (p) => p.labTenure?.leftYear === undefined || p.labTenure?.leftYear === null
  );
}
export function getAlumniPeople(): Person[] {
  return loadAll().people.filter(
    (p) => p.labTenure?.leftYear !== undefined && p.labTenure?.leftYear !== null
  );
}

// --- ResearchTheme ------------------------------------------------------------
export function getResearchThemes(): ResearchTheme[] {
  return [...loadAll().researchThemes].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
}
export function getResearchThemeById(id: string): ResearchTheme | undefined {
  return loadAll().researchThemes.find((t) => t.id === id);
}

// --- Project ------------------------------------------------------------------
export function getAllProjects(): Project[] {
  return loadAll().projects;
}
export function getProjectById(id: string): Project | undefined {
  return loadAll().projects.find((p) => p.id === id);
}
export function getProjectsByTheme(themeId: string): Project[] {
  return loadAll().projects.filter((p) => p.themeIds.includes(themeId));
}

// --- Publication ----------------------------------------------------------------
export function getPublications(): Publication[] {
  return loadAll().publications;
}
export function getPublicationById(id: string): Publication | undefined {
  return loadAll().publications.find((p) => p.id === id);
}
export function getPublicationsByCategory(
  category: PublicationCategory
): Publication[] {
  return loadAll()
    .publications.filter((p) => p.category === category)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}
export function getFeaturedPublications(): Publication[] {
  return loadAll()
    .publications.filter((p) => p.featured)
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
}
export function getPublicationsByTheme(themeId: string): Publication[] {
  return loadAll()
    .publications.filter((p) => p.themeIds.includes(themeId))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

// --- Post (news + blog) ---------------------------------------------------------
export function getAllPosts(): Post[] {
  return [...loadAll().posts].sort((a, b) => (a.date < b.date ? 1 : -1));
}
export function getPostsByKind(kind: "news" | "blog"): Post[] {
  return getAllPosts().filter((p) => p.kind === kind);
}
export function getPostById(id: string): Post | undefined {
  return loadAll().posts.find((p) => p.id === id);
}

// --- Recognition ----------------------------------------------------------------
export function getAllRecognitions(): Recognition[] {
  return loadAll().recognitions;
}
export function getRecognitionsByPerson(personId: string): Recognition[] {
  return loadAll().recognitions.filter((r) => r.personId === personId);
}

// --- ServiceRecord --------------------------------------------------------------
export function getAllServiceRecords(): ServiceRecord[] {
  return loadAll().service;
}

// --- Course -----------------------------------------------------------------
export function getAllCourses(): Course[] {
  return loadAll().courses;
}

// --- Sponsor ------------------------------------------------------------------
export function getAllSponsors(): Sponsor[] {
  return loadAll().sponsors;
}

// --- Derived stats (avoid a stored "150+ publications" field that could drift) --
export function getStats() {
  const all = loadAll();
  return {
    publicationCount: all.publications.length,
    peopleCount: all.people.length,
    currentPeopleCount: getCurrentPeople().length,
    projectCount: all.projects.length,
    recognitionCount: all.recognitions.length,
  };
}
