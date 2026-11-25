# X-Lab Website — Spec

Single source of truth for what this site is, how it's built, and what goes where.

**Supersedes and replaces** `docs/PLAN.md`, `docs/SCHEMA.md`, `docs/content-placement/*` (12 files), and `content/README.md`. Those are deleted — don't recreate them, and don't split this back out into per-entity files. `lib/content/schema.ts` is the literal field-level source of truth for data shapes; this doc explains what those fields mean and where they render on the site, it doesn't restate every field.

The execution plan lives in **§10 (Phases)** of this file — there is no separate `JOBS.md`.

**Status of this revision (2026-11-25, "the redesign").** The site is moving from a single long-scroll homepage to one page per section, with the homepage reduced to summaries; the content model moves to **schema v3**; Studio moves from invite links to a password login. Those decisions were taken in the 2026-11-23 website meeting (Utkarsh Kumar, Sri Bhargava Bhamidi) and the planning discussion that followed. **Phases 1–4 (schema v3, the new pages, linking, password sign-in) are implemented — the Worker changes from Phases 3–4 await a deploy; Phases 5–6 are still the target** — §10 tracks which phase delivers what. Superseded decisions are struck through, not deleted, so the history stays readable.

---

## 1. What this is

X-Lab is an academic AI-systems research lab site. The PI's affiliation spans two institutions — University at Buffalo, and, as of March 2026, Founding Dean of UT San Antonio's new College of AI, Cyber and Computing. The site's institutional identity is **UTSA** (decision #1 below).

Structural inspiration was originally [poloclub.github.io](https://poloclub.github.io/) (Georgia Tech): one long-scroll homepage with anchor nav and data-driven cards fed by structured files. **Redesign (2026-11-25):** the data-driven cards stay; the single scroll does not. Every section becomes its own page, and the homepage becomes a summary of all of them, each summary linking to its full page (§5).

**Visual design (Phase 5, done 2026-08-11):** the real look comes from `Polo Club Website Inspiration/X-Lab Homepage.dc.html` (a Pencil design-canvas mockup, option "1A" — the only fully fleshed-out option in that file), recolored from its original cream/blue/orange palette to pure black/white/gray per product direction, with a real switchable light/dark mode (`next-themes`, `.dark` class). Instrument Sans (body) + JetBrains Mono (labels/meta/mono accents). No accent hue anywhere — emphasis comes from weight/size/spacing/mono-vs-sans and fill-vs-outline, not color. Design tokens live in `app/globals.css` (`--bg-alt`, `--text-faint`, `--text-placeholder`, `--hairline`, `--invert-bg`/`--invert-fg` extend the shadcn base set). **The `Polo Club Website Inspiration/` folder is no longer in this repo** — it, and the `data-extraction/` source scrape, were left behind in the archived `Bhargava1424/xlab.github.io` when the site moved to this org on 2026-08-23. Neither was ever read by a build step; the design they informed now lives in the code. This note exists so the citation above still resolves to somewhere real.

## 2. Stack & hosting (locked)

- **Next.js**, static export (`output: 'export'`), TypeScript, App Router.
- **Tailwind CSS** + **shadcn/ui** (retuned to the black/white design system, Phase 5 — see §1).
- **GitHub Pages**, organisation root site, served at `https://xlab-utsa.github.io/`
  with an **empty** `basePath`/`assetPrefix` (see decision #9). `lib/base-path.ts` is the
  single source of truth for the org/repo name and `BASE_PATH` — update it there if any of
  them ever change, and `lib/studio/config.ts` re-exports from it rather than redeclaring.
  The one place that must be kept in sync **by hand** is `workers/xlab-gate/wrangler.jsonc`
  (`SITE_ORIGIN`, `STUDIO_URL`, `REPO_OWNER`, `REPO_NAME`), because the Worker deploys
  separately and cannot import TypeScript from this app.
- **Hard constraint: fully static.** No API routes, no server actions, no middleware, no ISR, no request-time SSR. Anything that needs to feel dynamic (search/filter, animations, stat counters, charts) runs client-side against the static bundle or is computed at build time, not by a backend. This includes **redirects**: there is no server to issue a 301, so a moved route is kept as a static stub page (canonical link + meta refresh + a plain link).
- No backend / FastAPI in scope. Revisit only if a genuine server-side need shows up later (e.g. a contact form) — don't let one creep in via a Next.js feature that assumes a server.
- **Amendment 2026-08-13 — X-Lab Studio.** The lab's content must be maintainable by
  distributed members without editing the repo, which needs authentication and a write
  path. This is a *documented, bounded* exception, not a loosening of the rule above:
  - The **public site stays exactly as constrained**: still `output: "export"`, still no
    API routes, server actions, middleware, ISR, or request-time SSR. Nothing in the
    section above changes for any page a visitor sees.
  - Studio lives at `app/studio/**` as **client-only** routes in the same static export,
    marked `noindex`. It reads `public/content-snapshot.json` (generated at build time) and
    talks to an external service; it never makes the site itself dynamic.
  - All auth and repo writes happen in a separate **Cloudflare Worker** (`workers/xlab-gate/`),
    outside this Next.js app. It holds the only GitHub credential and is deliberately
    schema-blind, so content-model changes never require redeploying it.
  - Every write becomes a pull request validated by `.github/workflows/validate.yml` and
    merged only on admin approval. If validation fails, Pages keeps serving the last good
    deploy — bad data cannot take the site down.
  - Hard boundary: `app/studio/**` may import `lib/content/schema.ts` (pure Zod, client-safe)
    but **never** `lib/content/index.ts` or `loader.ts`, which use `fs`.
  - **Worker deploys are manual and the owner's** (`cd workers/xlab-gate && npm run deploy`).
    Site changes go live on merge to `main`; Worker changes go live only when deployed. Any
    phase that touches the Worker is not done until that deploy has happened.
  - **Amendment 2026-11-25 — accounts and the Worker's private store.** Studio sign-in
    becomes email + password (§8). Password hashes, sign-in links, sessions' revocation
    counters and rate-limit counters live in the Worker's **KV namespace** — private,
    never in git. The Worker stops being *purely* stateless here, but it is still
    schema-blind: nothing in KV is content.
- `labbench/` (dev-only tooling, e.g. `schema-visualizer`) stays fully outside the root build/workspace — has its own `package.json`/`node_modules`, `next build` must never touch it.

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Which institution represents the live site's identity/address? | **UTSA.** `content/site.yaml`: `primaryInstitutionId: utsa`, `contact.address` = UTSA's address. |
| 2 | Is `/blog` a separate route from `/news`? | **Superseded 2026-11-25 by #10.** ~~News has no route at all. It's a Home-only section (`#news` anchor), recent items only, no archive page.~~ `/blog` is a real separate route (+ always-generated `/blog/<slug>`) — that part stands. News now gets its own `/news` archive page as well; news items still never get a detail page. |
| 3 | Publications: tabs on one page, or separate nav entries? | **Amended 2026-11-25 by #10.** Still **one page, 6 category tabs** — but that page is now `/research` ("Research & Publications"), with a research summary banner above the tabbed list. `/publications` remains only as a redirect stub (§2). ~~General rule going forward: default to Home content, poloclub-style; only add a route when content genuinely can't fit inline.~~ The rule is now the reverse: every section has its own page and Home summarises. |
| 4 | Team member detail pages — what's the threshold? | **No `/team/<slug>` or `/people/<slug>` pages, for anyone, for now.** Every card is a plain outbound redirect. `links.redirectUrl`, if set, is used directly (manual override — updated 2026-08-11). Otherwise, priority order: `links.website` → `links.linkedin` → `links.github` → `links.scholar` → fallback: auto-generated Google Scholar search for their name (`scholar.google.com/scholar?q=<name>`). Real links get collected and filled in over time; the fallback just means launch isn't blocked on having them all. *(Unchanged by the redesign — the People page is a group page, not per-person pages.)* |
| 5 | Where do Recognition / ServiceRecord / Course render, given #4? | Not on a per-person page — there isn't one. **Updated 2026-08-11 (Phase 5):** the PI layer surfaces `Person.bio`, `profile.education`, and `affiliations` ("Appointments") for the lab lead, plus **Recognition**, summarized per-category via `getRecognitionsByPerson` ("Honors"). **Redesign (2026-11-25):** that full PI layer moves from Home to the `/people` page; Home keeps only the PI's photo and long-form bio (§5). **`ServiceRecord` still has no site placement.** **`Course`/Teaching was removed entirely** (Phase 5) — `content/courses/` stays, unused. |
| 6 | SyncTREE / QuadraNet have no real repo — what do the links do? | **Placeholder**, until real repos are known: point `links.code` at a Google search for `"<title> GitHub"` instead of the current (wrong) personal-profile URL. Swap for the real repo the moment it's confirmed. |
| 7 | Sponsor data? | ~~One placeholder entry: UTSA.~~ **Updated 2026-11-25:** **Tenstorrent** is a confirmed sponsor (logo to add). IBM, Microsoft and others are pending confirmation from the PI. The UTSA placeholder is removed once a real sponsor is present. Sponsors render as logos only, on Home and on `/sponsors`, until the PI asks for amounts/grant detail. |
| 8 | Publication.id scheme? | **Decided:** `{category}-{year}-{slug of the first ~5 significant words of the title}`, e.g. `conference-2023-quadranet-hardware-aware`. Year falls back to `filedDate`/`issuedDate` year for patents, or `undated` in the rare case no year exists at all. On a collision, append `-2`, `-3`, ... in encounter order. Frozen from first use in the Phase 1 bulk import. |
| 9 | What URL does the site actually deploy to? (**RESOLVED 2026-08-23**) | **`https://xlab-utsa.github.io/` — an organisation root site, `basePath` = `""`.** The repo moved to the `xlab-utsa` org on 2026-08-23; because the repo name matches the org name, Pages serves it at the org root. **Keep `withBasePath()` anyway** — `next/image` does not auto-prepend `basePath` to local asset `src` when `images.unoptimized: true`, so every photo/thumbnail/logo would 404 under a subpath unless routed through it. It is a no-op today and the one-line safety net if a custom domain or subpath is ever adopted. |
| 10 | Single scroll or one page per section? (**2026-11-25**) | **One page per section, in this nav order:** Research & Publications (`/research`), Projects (`/projects`), People (`/people`), News (`/news`), Location & Lab Culture (`/lab`), Blog (`/blog`), Sponsors (`/sponsors`). Home (`/`) summarises each one and links through. Full layout in §5. |
| 11 | How are people's roles over time modelled? (**2026-11-25**) | **A list of lab roles per person** (`labRoles[]`, §4) replaces the single `personType` + `labTenure`. "Current member", "alumni", "which group on /people" and "joined/left" are all *derived*. A person's career outside the lab (e.g. "Assistant Professor, Penn State") lives in `affiliations[]`, which v3 lets name a free-text organisation when no `Institution` record exists. |
| 12 | Venues — free text or records? (**2026-11-25**) | **Records.** `content/venues/<id>.yaml`, seeded from DBLP venue keys (`conf/iccad`, `journals/tcad`, …), with hand-made records for what DBLP lacks (patents have no venue; ASHA, book series). Each publication carries `venueId`; the old free-text `venue` stays during migration as display fallback. |
| 13 | Studio sign-in (**2026-11-25**) | **Email + password**, implemented in the Worker, for current roster members. **No Google/OAuth sign-in** (rejected: setup burden, member reluctance). First password and resets go through an **admin-minted one-time "set password" link** (the existing invite mechanism, repurposed). **Email is never sent by the system** — this stays true. Admins may additionally keep GitHub sign-in. Alumni and inactive people do **not** get Studio access; they use a Google Form (§8.5). Details §8. |
| 14 | How are people linked to papers/projects/posts? (**2026-11-25**) | **Each relation is stored on exactly one side** (the work names the person) and the reverse is computed. Studio **suggests** links in both directions at creation time and on demand; **nothing is ever linked automatically**. Details §9. |

## 4. Content model

**"Mongo, not SQL"**: every relationship between entities is an optional id reference — never required at write time. A record can exist with the reference unset; content gets added incrementally, imported in bulk, and linked up later. `validate.ts` still enforces that a reference which *is* set resolves.

### 4.1 Entities (current — schema v2, as in `lib/content/schema.ts` today)

- **Institution** — lookup table for `Person`/`Course` references. Not a general org registry — award-granting orgs like "IBM Research" stay free text on `Recognition`.
- **Person** — one file per person, `content/people/<slug>.yaml`. `photo` is always an explicit path, never fuzzy-filename-matched. `labTenure` (is this person a current lab member) is independent of `affiliations` (which institution(s), historically).
- **PersonProfile** — the rich bio extension (education, research philosophy, research agenda). No stored "150+ publications" summary field — derived at build time.
- **ResearchTheme** — a titled research area (7 today). Every publication carries ≥1 `themeIds` entry.
- **Project** — the card unit. `collaborationWith` is a free-text **external** org name; `contributors` is the actual `Person` link (lab members) — populate only when confirmed, never guessed.
- **Publication** — one shape across 6 categories, discriminated by `category`. `id` is generated once, then immutable (§3.8). `authors` is `{name, personId?}[]`: `name` is always the display source of truth, `personId` is set only for confirmed lab members.
- **Post** — News and Blog unified via `kind`.
- **SiteMeta** — singleton, sitewide chrome (nav/header/footer/SEO), not page content.
- **Recognition** — the sole authority for "this won an award" (`Publication.note` is for non-award annotations only).
- **ServiceRecord** — `periodDisplay` is the required, real source of truth; `startYear`/`endYear` best-effort only.
- **Course** — simple list, no invented enrollment data.
- **Sponsor** — logo grid entity.

### 4.2 Schema v3 — the target (Phase 1)

Field names below are the plan; `lib/content/schema.ts` makes them literal in Phase 1 and wins if the two differ. Every change ships with a migration script that rewrites existing records, so no record is edited by hand.

| Entity | Change | Why |
|---|---|---|
| **Person** | `personType` + `labTenure` → **`labRoles[]`**: `{ role, start?, end?, title?, note? }`. `role` ∈ `lab-lead`, `postdoc`, `visiting-faculty`, `research-staff`, `phd-student`, `masters-student`, `undergrad-student`. `grad-collaborator` is **removed**. An open role (no `end`) = current member; no open role = alumni. | One person passes through several roles (PhD → alumni; postdoc → alumni). A single snapshot field could not say that. Adds visiting faculty. |
| **Person** | `affiliations[].institutionId` becomes optional; add `organization` (free text) — one of the two is required. | Alumni "now at" lines ("Assistant Professor, Penn State"; "PhD student, University of Maryland"; "back in Turkey") rarely have an `Institution` record, and making one for every employer is not worth it. |
| **Person** | Add **`aliases[]`** (name spellings used in author lists, e.g. "C. Xu") and **`ids`**: `{ orcid?, scholarId?, dblpPid? }`. | Makes person↔paper matching near-deterministic (§9) instead of fuzzy. |
| **Person** | Rendered link icons narrow to **email, Google Scholar, website, LinkedIn** (meeting decision). `universityProfile`/`github` stay in the schema, unrendered. | — |
| **Venue** (new) | `{ id, shortName, name, kind: conference \| journal \| workshop \| other, dblpKey?, url? }`. | §3.12. 235 distinct free-text venue strings today (ICCAD alone 9 spellings); DBLP collapses the matched ones to 91. |
| **Publication** | Add `venueId?`, `dblpKey?`. `doi`/`url` already exist and are empty on all 405 records — filled in Phase 5. | Venue chart, filtering, stable identity, outbound links. |
| **Project** | `links.publicationId` (one) → **`publicationIds[]`**. Add `icon?` (asset path). `description` becomes the rendered markdown write-up on `/projects`. | Projects routinely have several papers; the Projects page shows short write-ups with icons and live links. |
| **Post** | `authorId` → **`authorIds[]`**; add **`mentions`**: `{ personIds[], projectIds[], publicationIds[] }`. | Multi-author blog posts; news items about people/projects/papers become linkable both ways. |
| **GalleryPhoto** (new) | `{ id, image, caption?, date?, personIds[], source? }` in `content/gallery/`. | The Home photo banner, managed in Studio rather than hard-coded. |
| **Roster** (not content) | `access/roster.json` entries: `email` → **`emailHashes[]`** (keyed HMAC, §8.4), several per person. **Ships with Phase 4**, not Phase 1 — the Worker reads the roster. | One person, several addresses; and no readable emails in the public repo. |

Parked, not in v3: paper **versions** (arXiv → conference → journal of the same work; today they are unrelated records — v3 only guarantees we don't import duplicates), a **Grant** entity tying sponsors to projects.

### 4.3 File layout

```
content/
  site.yaml
  institutions/<id>.yaml
  people/<id>.yaml
  themes/<id>.yaml
  projects/<id>.yaml
  publications/<id>.yaml
  venues/<id>.yaml          (v3, Phase 1)
  gallery/<id>.yaml         (v3, Phase 1)
  posts/<id>.mdx
  recognitions/<id>.yaml
  service/<id>.yaml
  courses/<id>.yaml
  sponsors/<id>.yaml

access/roster.json        # Studio members + roles. NOT content/ — never in the public snapshot.

public/images/
  people/<slug>.jpg
  projects/<slug>/thumbnail.jpg
  posts/<slug>.jpg
  gallery/<slug>.jpg       (v3)
  logos/...
  sponsors/<slug>.png
```

**One record per file, for every entity.** Per-record files make concurrent edits touch disjoint files, and make duplicate ids structurally impossible — the filename *is* the primary key, and `lib/content/index.ts` enforces `filename === id`.

YAML for structured data, MDX for `posts/` where a real markdown body exists.

`lib/content/schema.ts` is the **single source of truth** for every shape; the app's TypeScript types are `z.infer`red from it, so a type and its validator cannot drift. Do not reintroduce a hand-written mirror type file.

`lib/content/validate.ts` adds the cross-record constraints a per-record schema cannot express: referential integrity for every foreign key, asset existence for every referenced image, and id uniqueness — plus, in v3, the linking warnings of §9.4. Run via `npm run validate:content`; enforced in CI by `.github/workflows/validate.yml` on every PR and again on `main` before deploy.

Provenance lives in a structured `_meta { source, note }` field on each record, **not in YAML comments** — that is what allows Studio to write records safely.

### 4.4 External data sources

- **The PI's CV** — the original source of all 405 publications.
- **DBLP export** (`jinjun-xiong.bib`, downloaded 2026-11-25; 373 entries). Matched by title against the site: 262/405 site records match (conference 178/217, journal 44/60, workshop 32/55, invited 6/9, patents 2/60, book chapters 0/4); 236 of those carry a DOI. Known traps: (a) a conference paper and its journal extension can share a title, so a match must agree on year and category, not just title; (b) 19 site records match only DBLP's arXiv (`journals/corr`) record — never take a venue from those. 113 DBLP entries are arXiv-only preprints not on the site; whether to import them is open (§7).
- **`publication-data-gaps.xlsx`** — a fill-in sheet (one tab per category) for the fields DBLP cannot supply: venue + short name, location, DOI, URL, volume/issue, patent numbers and dates. Being filled by Utkarsh Kumar; imported in Phase 5. Neither this file nor the `.bib` is read by the build.

## 5. Information architecture (target — Phase 2)

```
/              Home — summaries only; every block links to its full page.
  ├─ Hero          SiteMeta.title/tagline/logo + computed stats band
  ├─ Photo banner  GalleryPhoto × N, auto-scrolling strip directly below the stats;
  │                pauses under prefers-reduced-motion and on hover/focus
  ├─ Research      Left: radar chart, publications per ResearchTheme.
  │                Right: ranked bar list of top venues (Venue.shortName × count).
  │                Both computed at build time; all papers for now (later: date filters).
  │                → /research
  ├─ Projects      short summary / highlighted projects → /projects
  ├─ PI            PI photo (left) + long-form bio (right, from the old xlab-ub.com
  │                biography) + "Meet the group" button → /people
  ├─ News          most recent N items → /news
  ├─ Blog          most recent posts → /blog
  └─ Sponsors      logos only → /sponsors

/research      Research & Publications. Top: summary banner (write-up + diagrams from
               Utkarsh; placeholders until then). Below: the full publication list, 6 category
               tabs + research-area filter (today's /publications page, moved).
/publications  Redirect stub → /research (§2: static, no server redirect).
/projects      Project × all: write-up, icon/thumbnail, contributors, live/demo/code links.
/people        PI layer (photo, bio, education, appointments, honors — today's #team PI
               block, moved), then four groups:
                 1. Postdocs & Visiting Faculty   (role ∈ postdoc, visiting-faculty, research-staff)
                 2. PhD Students                  (phd-student)
                 3. Masters & Undergraduates      (masters-student, undergrad-student — one
                                                   group on the page, separate in the data)
                 4. Alumni                        (no open lab role; shows the "now at" line
                                                   from the current affiliation)
/news          Post (kind=news), full archive, newest first. No per-item pages.
/lab           Location & Lab Culture. Placeholder content + map until written.
/blog          Post (kind=blog), full archive
  └─ /blog/<slug>   Always generated
/studio        Studio (client-only, noindex) — §8
```

The header nav lists the seven section pages in the §3.10 order, all as real routes (no more `/#anchor` links). The header GitHub link points to the lab org, `https://github.com/xlab-utsa`.

## 6. Page-by-page placement

**Institution** — lookup only, never its own page. Resolved inline in a Person's affiliation history and a Course's institution line. `shortName` in compact spots, `name` elsewhere. `logo` has no UI slot.

**Person** — `/people` (§5). **PI** gets the rich treatment — photo, `roleTitle`, `bio`, `profile.education`, link buttons, `affiliations` as "Appointments", Recognition summarized as "Honors". Everyone else renders as a tile — photo, name, short role label, link icons (email / Scholar / website / LinkedIn), whole tile redirects per decision #4 — in the group their current (or, for alumni, last) lab role puts them in. Alumni tiles add the "now at" line. Home shows only the PI block described in §5. `secondaryTitles`, `office`, `profile.researchPhilosophy`/`researchInterests`/`researchAgenda`/`futureVision`/`quote` are collected but not rendered. `sortWeight` is internal ordering only.

**ResearchTheme** — the radar chart's axes on Home; the research-area filter and summary banner on `/research`. A theme with zero publications still renders fine.

**Project** — a card on `/projects` with its write-up. `title`/`tagline`/`thumbnail` or `icon` (or a diagonal-stripe placeholder), `projectStatus` label, `collaborationWith` as plain text, `contributors` (linked names, confirmed only), link row (`publicationIds` → resolved paper links, `code`, `demo`, `video`, `poster`, `website`). **No per-project detail page, ever** — the card plus its write-up is the whole presence.

**Publication** — `/research`, one list per category tab, year-desc. Entry: title, authors (only confirmed `personId` authors link out), venue (italic; `Venue.name` once linked, free text before), year/`dateDisplay`/`month`, location (conference/workshop only), `note` badge, doi/url/pdfUrl links. Category-specific line: patent metadata / `volumeIssue` / book+editors+publisher. `featured` publications also feed the research summary, ordered by `featuredOrder`.

**Post** — `kind=news` → `/news` archive + Home's recent strip; no detail page. `kind=blog` → `/blog` archive + `/blog/<slug>`. Fields: `date`, `title`, `summary`, `body` (blog only), `image`, `authorIds` (byline), `tags`, `sourceUrl` ("Read more →"), `mentions` (inline links to people/projects/papers).

**SiteMeta** — sitewide chrome: `title`/`logo` → `<title>` + header; `tagline` → hero headline; `description`/`keywords` → SEO meta + hero intro; `nav[]` → navbar (§5); `contact` → footer; `primaryInstitutionId` → header's institution tag; `socialLinks` → footer row; `logo.light`/`logo.dark` → theme-aware swap.

**Venue** — no page. Resolved inline on publication entries; aggregated into Home's top-venues list.

**GalleryPhoto** — Home photo banner only.

**Recognition** — summarized per category into the PI's "Honors" on `/people`. **ServiceRecord** — no site placement.

**Course** — no site placement.

**Sponsor** — logo grid on Home and `/sponsors` (identical for now).

## 7. Deferred / open items

Things intentionally left for later — don't block on these, but don't lose track of them either:

- **Recognition attribution** — whose achievement is it when the PI isn't first author? Decide per entry; don't default them all to the PI.
- **Missing role dates** — most people have no sourced start/end year. Leave blank rather than invent; Utkarsh is supplying years and levels.
- **`Institution.logo`** — no planned UI slot.
- **Real SyncTREE/QuadraNet repos** — replace the §3.6 placeholder once known.
- **More sponsors** — IBM, Microsoft, others: awaiting the PI (§3.7).
- **Publication versions** (arXiv/conference/journal of one work) and a **Grant** entity — parked out of v3 (§4.2).
- **arXiv-only DBLP entries** (113) — import recent ones, all, or none? Undecided.
- **Own-profile edits without review** — everything is reviewed for now (§8.3); revisit once members are using Studio.
- **Passkeys** as an alternative to passwords — later, if wanted.
- **Studio import screen for the alumni form** — v1 is a script (§8.5); build a screen only if the script proves to be a bottleneck.
- **Date ranges for the research summary** (e.g. "since joining UTSA") — all papers for now.
- `ServiceRecord`, `Course`, and `profile.researchPhilosophy`/`researchInterests`/`researchAgenda`/`futureVision`/`quote` remain collected but unrendered — Studio still manages them (`UNRENDERED_ENTITIES` in `lib/studio/entities.ts`).

## 8. Studio access (target — Phase 4)

### 8.1 Who gets access

- **Current lab members on the roster** get a Studio account.
- **Alumni and inactive people do not.** They use the alumni Google Form (§8.5). When someone leaves the lab, their roster entry is set `active: false` (signing them out within a minute — existing behaviour) and their profile moves to Alumni through the normal reviewed edit.

### 8.2 Roles

`admin`, `editor`, `member` — unchanged names. Utkarsh Kumar will be added as **admin**.

| Content | member | editor | admin |
|---|---|---|---|
| Own person record | edit | all | all |
| Publications | create; edit records that name them as author | all | all |
| Projects | create; edit records that list them as contributor *(new rule)* | all | all |
| Blog posts | create; edit their own | all | all |
| Self-linking (§9.3) | add **their own** id to a matching author slot | — | — |
| News, Sponsors, Themes, Venues, Gallery, Site settings | — | all | all |
| Approve / reject submissions | — | yes | yes |
| Roster & access, set-password links | — | — | yes |

Members can never delete. "Does this record name them?" is resolved by the Worker from the repo, never trusted from the client (existing behaviour).

### 8.3 Review

**Every change is a pull request and needs approval**, including a member's edit to their own profile. (Possible relaxation later — §7.)

### 8.4 Sign-in: email + password

- **Where passwords live:** the Worker's KV namespace, never the repo. Only a hash is stored: **PBKDF2-SHA256** with a random per-user salt, plus a **pepper** — a Worker secret mixed in, so a copy of KV alone is not enough to start guessing passwords offline. (Workers' Web Crypto caps PBKDF2 iterations; confirm the limit and use the maximum when building.)
- **First password and resets:** an admin mints a one-time **set-password link** in Studio (Roster & access). The member opens it, chooses a password, and signs in with email + password thereafter. Links are single-use and expire; redemption is a POST, never a GET (link-preview bots), as today. **No email is ever sent.**
- **Password rule:** minimum **8 characters**; a short list of the most common passwords is rejected.
- **Rate limiting and lockout** per email and per IP; error messages are identical whether or not the email is on the roster, so sign-in cannot enumerate members.
- **Revocation:** each account has a credential version in KV; changing a password or deactivating the account bumps it, which invalidates every existing session.
- **Admins** may also keep GitHub sign-in (GitHub's 2FA).
- **Roster privacy:** `access/roster.json` stores **`emailHashes[]`** — an HMAC of each lowercased email under a Worker secret — not the address itself. The repo keeps names, roles and history ("who had access when") without exposing addresses; sign-in hashes the typed email and looks it up. Several addresses per person are allowed.

### 8.5 Alumni Google Form

A Google Form whose fields mirror the v3 Person shape (name, role while in the lab, years, current position/organisation, links, photo, short bio). Responses land in a Google Sheet — personal data stays out of the repo. v1 import is a script: CSV export → duplicate detection (same email/name; keep the most complete) → co-authorship suggestions against the publication list (§9) → **draft** person records submitted as a normal reviewed PR. No one edits a live record through the form.

## 9. Linking people ↔ work (target — Phase 3)

### 9.1 Storage

Each relation is stored once, on the work:

- Publication → `authors[].personId`
- Project → `contributors[]`
- Post → `authorIds[]`, `mentions`

"This person's papers / projects / posts" is always computed from those (`lib/content/relations.ts` declares every relation once; CI, Studio and the site all read it).

### 9.2 Suggestions, both directions

One shared, client-safe module in `lib/` (built on the existing `lib/content/matching.ts`) answers two questions:

- **Given a person** (new or existing): which unlinked author slots, projects and posts are probably theirs? Inputs: name, `aliases`, `ids`, DBLP author lists. Shown when a person record is created (including a member's first profile) and on demand from their page: *"These 12 papers, 2 projects and 1 post look like yours"* — tick, then one submission updates every ticked file.
- **Given a work** (new or edited publication, project, post): which lab members are its authors/contributors? Each author string is pre-matched with a confidence label; a project's contributors are suggested from the authors of its linked publications.

Matches are tiered by confidence (id match > exact name/alias > full-name fuzzy > initials-only). **Nothing is applied without a human tick.** Initials-only and multi-candidate matches are never pre-selected.

### 9.3 Self-linking permission

A member may submit a change whose **only** effect on a record is setting `personId` to their own id on an author slot whose name matches their name or an alias. The Worker verifies that this is the only change; review still applies (§8.3).

### 9.4 Guards in CI (warnings, not failures)

- A `personId` whose person's name/aliases do not plausibly match the author string it sits on.
- An unlinked author string that strongly matches a lab member (catches links nobody ever made).

### 9.5 One-time backfill

`scripts/dblp-author-backfill.ts` matches DBLP entries to site papers (same title, year within one, published record preferred over arXiv) and proposes a link only when DBLP's full name is an exact/alias match for exactly one member AND the site's own author string fits that member; `--apply` inserts one `personId:` line per proposal, so the diff is the review. **Run 2026-11-25: 0 proposals.** The raw gap DBLP suggested (e.g. Dancheng 31 vs 18) turned out to be DBLP duplicates (arXiv + published) and arXiv-only papers not on the site — every site paper DBLP confirms was already linked. The remaining unlinked candidates are initials-only matches on old papers by other people (e.g. "Y. Hu", 2007) and correctly stay unlinked; the two "Y. Akemoglu" alias matches were linked by hand.

## 10. Phases

| Phase | Scope | Depends on | Status |
|---|---|---|---|
| **0. Spec** | This revision of SPEC.md. | — | **Done 2026-11-25** |
| **1. Schema v3 + migration** | §4.2 in `schema.ts` (`labRoles`, free-text `organization` on affiliations, `aliases`/`ids`, Venue, GalleryPhoto, `venueId`/`dblpKey`, `publicationIds`, `authorIds`/`mentions`); role rules in `lib/content/people.ts`; `validate.ts`, relations, Studio registry + profile form, snapshot (schema v3); `scripts/migrate-content-v3.mjs`; the meeting's people changes (Meihuan Liu, Wenyan Zhou, Ziyue Bai removed; Chenhui Xu and Qingxiao Zheng → alumni with "now at"; Yusuf Akemoğlu added as alumni visiting faculty). **Not in this phase:** Christian and Anika (surnames and details still needed), Aashish Dhakal (already on the roster — creates his own profile on first sign-in), Sri Bhargava Bhamidi (adds himself once the site is live). The roster `emailHashes` change and the Worker's ownership rule for `authorIds` lists move to Phase 4, since both need a Worker deploy. | 0 | **Done 2026-11-25** |
| **2. Pages + Home** | §5 and §6: seven routes, nav, `/publications` stub (keeps `?theme=`), Home summaries (radar, PI block, photo banner, projects, news, blog, sponsor logos); the venue list shows a placeholder until Phase 5, and the photo banner stays hidden until gallery photos exist. Location & Lab Culture has no Home summary until its content exists. | 1 | **Done 2026-11-25** |
| **3. Linking** | §9: `lib/content/suggestions.ts` (both directions, aliases, confidence tiers); CI warnings `author-link-mismatch` / `author-probably-unlinked`; Studio "papers that look like yours" on the member home (one-line self-link submissions, built by `lib/studio/self-link.ts`) and author/contributor suggestions in the record editor; DBLP backfill script (see §9.5). **Pulled forward from Phase 4, because linking needs them:** the Worker's self-link rule, ownership through `authorIds:`/`contributors:` lists, members editing projects they contribute to, and a read-only `GET /file` endpoint — mirrored in `scripts/mock-gate.mjs`. **Needs a Worker deploy by the owner** before members can use the claim flow or edit their own posts. Posts have no author *strings*, so they get no name-based suggestions. | 1 | **Done 2026-11-25** (Worker deploy pending) |
| **4. Studio sign-in + roles** | §8: email + password sign-in (`POST /auth/login`, generic failures, per-IP rate limit, 10-strike account lockout); one-time set-password links (`/invite` by account id → `/auth/set-password` form; GET spends nothing); passwords in KV as PBKDF2-SHA256 ×100 000 over a peppered HMAC; credential versions so a new password or *Sign out everywhere* ends older sessions; roster v2 (`id`, `emailHashes`; legacy `email` accepted with a CI warning, converted by Studio's *Hash them now*); PRs name the submitter by account id, never an address; Studio sign-in form and roster screen; old sign-in links and the unused email code removed; mock gate mirrors all of it. **Deploy order (owner):** set `EMAIL_HASH_SECRET` + `PASSWORD_PEPPER` → `npm run deploy` in `workers/xlab-gate` → merge the site → Studio Roster → *Hash them now* → approve → hand out set-password links. Plain-text addresses remain in git history. | 1 | **Done 2026-11-25** (Worker deploy pending) |
| **5. Publication data import** | DBLP + `publication-data-gaps.xlsx` → Venue records, `venueId`, DOI, URL, patent fields; turn on Home's venue list. | 1, and the filled sheet | Blocked on the sheet |
| **6. Content** | News (ASHA convention trip, Qingxiao Zheng's professorship, Christian's SIGMOD paper — confirm venue, Tenstorrent; ask the PI for more), Tenstorrent logo, project write-ups (Sri's projects; RAI, MLModelScope from Utkarsh), gallery photos, `/research` write-up and diagrams, `/lab` content, alumni form + import. | 2, and content from Utkarsh/the PI | Rolling |

Phases 2, 3 and 4 touch largely separate code (pages and components; `lib/` + Studio; the Worker) and can proceed in parallel once Phase 1 has landed.
