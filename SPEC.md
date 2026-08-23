# X-Lab Website — Spec

Single source of truth for what this site is, how it's built, and what goes where.

**Supersedes and replaces** `docs/PLAN.md`, `docs/SCHEMA.md`, `docs/content-placement/*` (12 files), and `content/README.md`. Those are deleted — don't recreate them, and don't split this back out into per-entity files. `lib/content/schema.ts` is the literal field-level source of truth for data shapes; this doc explains what those fields mean and where they render on the site, it doesn't restate every field.

`JOBS.md` is the execution checklist that implements this spec, phase by phase. If the two ever disagree, this file wins — fix JOBS.md.

All decisions below are locked as of 2026-08-10 — §3.8 (Publication.id scheme) and §5 (`/research`/`/team` as Home-only anchors) were the last two open items and are now resolved.

---

## 1. What this is

X-Lab is an academic AI-systems research lab site. The PI's affiliation spans two institutions — University at Buffalo, and, as of March 2026, Founding Dean of UT San Antonio's new College of AI, Cyber and Computing. The site's institutional identity is **UTSA** (decision #1 below).

Structural inspiration is [poloclub.github.io](https://poloclub.github.io/) (Georgia Tech): one long-scroll homepage with anchor nav, data-driven cards fed by structured files instead of hand-written HTML per entry, and a couple of standalone pages for the handful of things that genuinely don't fit in a scroll. We're borrowing that structure, not poloclub's Bootstrap/gold visual theme.

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
- **Hard constraint: fully static.** No API routes, no server actions, no middleware, no ISR, no request-time SSR. Anything that needs to feel dynamic (search/filter, animations, stat counters) runs client-side against the static bundle, not a backend.
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
- `labbench/` (dev-only tooling, e.g. `schema-visualizer`) stays fully outside the root build/workspace — has its own `package.json`/`node_modules`, `next build` must never touch it.

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Which institution represents the live site's identity/address? | **UTSA.** `content/site-meta.yaml`: `primaryInstitutionId: utsa`, `contact.address` = UTSA's address. |
| 2 | Is `/blog` a separate route from `/news`? | **News has no route at all.** It's a Home-only section (`#news` anchor), recent items only, no archive page. **`/blog` is a real separate route** (+ always-generated `/blog/<slug>`), matching poloclub's own pattern of mixing in-page anchors with a couple of standalone pages in the same navbar. |
| 3 | Publications: tabs on one page, or separate nav entries? | Stays **one `/publications` page, 6 category tabs.** This is the one place a dedicated route is clearly justified — ~301 entries can't live in a home scroll. General rule going forward: default to Home content, poloclub-style; only add a route when content genuinely can't fit inline. The old `docs/content-placement` docs leaned toward a route per entity — don't keep following that instinct. |
| 4 | Team member detail pages — what's the threshold? | **No `/team/<slug>` pages, for anyone, for now.** Every card is a plain outbound redirect. `links.redirectUrl`, if set, is used directly (manual override — updated 2026-08-11). Otherwise, priority order: `links.website` → `links.linkedin` → `links.github` → `links.scholar` → fallback: auto-generated Google Scholar search for their name (`scholar.google.com/scholar?q=<name>`). Real links get collected and filled in over time; the fallback just means launch isn't blocked on having them all. |
| 5 | Where do Recognition / ServiceRecord / Course render, given #4? | Not on a per-person page — there isn't one. **Updated 2026-08-11 (Phase 5):** the "possible future PI page" this decision originally deferred to now exists, inline — the mockup's PI layer in `#team` surfaces `Person.bio`, `profile.education`, and `affiliations` ("Appointments") for the lab lead, plus **Recognition**, summarized per-category via `getRecognitionsByPerson` ("Honors" — e.g. "7 Best Paper Awards"), finally giving that data a real UI home. **`ServiceRecord` still has no site placement** — the Honors summary doesn't have a service-record equivalent, and this still isn't the `xlab-ub.com` CV-page structure. **`Course`/Teaching was removed entirely** (Phase 5, per product direction) — no nav item, no section; `content/teaching.yaml` stays, unused, same footing as `ServiceRecord`. |
| 6 | SyncTREE / QuadraNet have no real repo — what do the links do? | **Placeholder**, until real repos are known: point `links.code` at a Google search for `"<title> GitHub"` instead of the current (wrong) personal-profile URL. Swap for the real repo the moment it's confirmed. |
| 7 | Sponsor data? | `content/sponsors.yaml` gets **one placeholder entry: UTSA** — standing in until real grant sponsors are collected. |
| 8 | Publication.id scheme? | **Decided:** `{category}-{year}-{slug of the first ~5 significant words of the title}`, e.g. `conference-2023-quadranet-hardware-aware`. Year falls back to `filedDate`/`issuedDate` year for patents, or `undated` in the rare case no year exists at all. On a collision (two entries would generate the same id), append `-2`, `-3`, ... in encounter order. Simple, deterministic, human-readable in diffs — no reason to reach for anything fancier (hashes, sequence counters) for ~301 records. Frozen from first use in the Phase 1 bulk import. |
| 9 | What URL does the site actually deploy to? (**Added 2026-08-11, Phase 6 · RESOLVED 2026-08-23**) | **`https://xlab-utsa.github.io/` — an organisation root site, `basePath` = `""`.** *Original decision (2026-08-11):* `xlab.github.io` was unavailable — the GitHub account `xlab` belongs to an unrelated third party — so the site shipped as a project page at `https://bhargava1424.github.io/xlab.github.io/` under a personal account, with `basePath`/`assetPrefix` = `/xlab.github.io`. *Superseded 2026-08-23:* the `xlab-utsa` **organisation** was created and the repo moved to `xlab-utsa/xlab-utsa.github.io`. Because the repo name matches the org name, GitHub Pages serves it at the org root — which is exactly the escape hatch this decision deferred to, at no cost and with no custom domain. The path prefix is gone; `BASE_PATH` is now `""`. The move also takes the lab's site off a personal account. **Keep `withBasePath()` anyway** — the bug this decision recorded is still real: `next/image` does not auto-prepend `basePath` to local asset `src` when `images.unoptimized: true` (a static-export requirement), so every photo/thumbnail/logo 404s under a subpath unless routed through it. It is a no-op today and the one-line safety net if a custom domain or subpath is ever adopted. |

## 4. Content model

**"Mongo, not SQL"**: every relationship between entities is an optional id reference — never required, never validated for referential integrity at write time. A record can exist with the reference unset; content gets added incrementally, imported in bulk, and linked up later without a migration.

Entities (`lib/content/schema.ts` is the literal field source; this is what each one is *for*):

- **Institution** — lookup table for `Person`/`Course` references. Not a general org registry — award-granting orgs like "IBM Research" stay free text on `Recognition`.
- **Person** — one file per person, `content/people/<slug>.yaml`. `photo` is always an explicit path, never fuzzy-filename-matched. `labTenure` (is this person a current lab member) is independent of `affiliations` (which institution(s), historically) — collapsing the two breaks the moment someone's institutional tie outlives their lab involvement, or the reverse.
- **PersonProfile** — the rich bio extension (education, research philosophy, research agenda). No stored "150+ publications" summary field — derived at build time from `Publication`/`Recognition` counts so it can't drift.
- **ResearchTheme** — a titled research area, can hold zero or more `Project`s.
- **Project** — the poloclub card unit. `collaborationWith` is a free-text **external** org name; `contributors` is the actual `Person` link (lab members) — populate only when confirmed, never guessed.
- **Publication** — one shape across all 6 categories, discriminated by `category`. `id` is generated once, then immutable (§3.8) — other entities reference it. `authors` is `{name, personId?}[]`: `name` is always the display source of truth, `personId` is set only for confirmed lab members (mixed linked/plain-text author lists are normal, not a bug).
- **Post** — News and Blog unified via `kind`.
- **SiteMeta** — singleton, sitewide chrome (nav/header/footer/SEO), not page content.
- **Recognition** — the sole authority for "this won an award" (`Publication.note` is for non-award annotations only — "in press", "Spotlight" — so award facts never live in two places).
- **ServiceRecord** — `periodDisplay` is the required, real source of truth (irregular real periods like "2010–2012, 2015, 2018–2019"); `startYear`/`endYear` are best-effort only, populated only when a record cleanly parses as one range.
- **Course** — simple list, no invented enrollment data.
- **Sponsor** — logo grid entity.

File layout:

File layout (**schema v2**, 2026-08-13):

```
content/
  site.yaml
  institutions/<id>.yaml
  people/<id>.yaml
  themes/<id>.yaml
  projects/<id>.yaml
  publications/<id>.yaml
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
  logos/...
  sponsors/<slug>.png
```

**One record per file, for every entity.** v1 used per-category array files for
`publications/`/`recognitions/`, which meant two people editing different papers both
modified `conferences.yaml` and hit a merge conflict. Per-record files make concurrent
edits touch disjoint files, and make duplicate ids structurally impossible — the filename
*is* the primary key, and `lib/content/index.ts` enforces `filename === id`.

YAML for structured data, MDX for `posts/` where a real markdown body exists.

`lib/content/schema.ts` is the **single source of truth** for every shape; the app's
TypeScript types are `z.infer`red from it, so a type and its validator cannot drift.
(v1 kept a hand-written mirror at `types/content.ts`; the two had already diverged, and
that file is deleted — do not reintroduce it.)

`lib/content/validate.ts` adds the cross-record constraints a per-record schema cannot
express: referential integrity for every foreign key, asset existence for every referenced
image, and id uniqueness. Run via `npm run validate:content`; enforced in CI by
`.github/workflows/validate.yml` on every PR and again on `main` before deploy.

Provenance lives in a structured `_meta { source, note }` field on each record, **not in
YAML comments**. v1 kept the entire decision record in comments, which any programmatic
writer destroys — moving it into the data is what allows Studio to write records safely.

## 5. Information architecture

```
/                     Home — single long scroll, poloclub-style. Sections below are
                      in-page anchors (#id), not routes, unless noted otherwise.
  ├─ Hero             SiteMeta.title/tagline/logo + computed stats
  ├─ #research        ResearchTheme × N, each with its Project cards inline.
                      No separate /research page — short + long description
                      both live here (6 themes fit fine in a scroll).
  ├─ #team            Person, three layers (Phase 5): the PI (rich bio/education/
                      appointments/honors), current members (dense grid), alumni
                      (hidden while empty). Every non-PI card redirects out per
                      decision #4. No separate /team page, same reasoning as above.
  ├─ #news            Post (kind=news), most recent N. No archive, no route —
                      this is the entire News presence on the site (decision #2).
  ├─ Featured Publications   Publication (featured=true), highlight strip
  ├─ #sponsors        Sponsor × all — logo grid + grantNumbers blurb, plus an
                      inverted CTA panel carrying recruitingNotice (moved here from
                      next-to-#team in Phase 5, matching the mockup's layout)
  └─ Footer           SiteMeta.contact / socialLinks / copyright

/publications         Publication, 6 category tabs (Patents / Journals /
                      Conferences / Workshops / Invited Papers / Book Chapters),
                      sorted year-desc within each tab

/blog                 Post (kind=blog), full chronological archive
  └─ /blog/<slug>      Always generated — blog posts are expected to have a body

(no page)             Institution, Sponsor, Project — resolved/rendered inline
                      wherever referenced, never their own browsable route
```

Nav bar mixes anchor links (`#research`, `#team`, `#news`, `#sponsors` — scroll within Home) with real routes (`/publications`, `/blog`) — same pattern poloclub uses in its own navbar.

## 6. Page-by-page placement

**Institution** — lookup only, never its own page. Resolved inline in a Person's affiliation history and a Course's institution line. `shortName` in compact spots (team card tag), `name` elsewhere. `logo` has no UI slot currently.

**Person** — `#team`, three layers (Phase 5, see decision #5): **PI** gets the rich treatment — photo, `roleTitle`, `bio` ("About"), `profile.education`, `links` as contact buttons, `affiliations` as "Appointments", `getRecognitionsByPerson` summarized as "Honors". **Current members** (everyone else with `labTenure.leftYear` null/absent) render as a flat dense grid (no `personType` sub-grouping, matching the mockup) — photo, name, short role label, whole-tile redirect per decision #4. **Alumni** (`labTenure.leftYear` set) — same tile, circular photo; section hidden entirely while empty (true of all 17 people today). `secondaryTitles`, `office`, `profile.researchPhilosophy`/`researchInterests`/`researchAgenda`/`futureVision`/`quote` are still collected but not rendered — only `bio`/`profile.education`/`affiliations` graduated to real UI, and only for the PI. `sortWeight` is internal ordering only. Institution `shortName` tag and tenure years from the earlier single-card design were dropped in the Phase 5 restyle (not in the mockup's compact tile).

**ResearchTheme** — `#research` section: icon + title + `shortDescription` + `longDescription`, both together (no separate `/research` page, §5). A theme with zero `Project`s still renders fine as heading + description.

**Project** — a card inside its theme's tab-focused grid on `#research` (Phase 5: the section became a click-to-switch thrust browser, one `ResearchTheme` in focus at a time — client-side tab state, no route change). `title`/`tagline`/`thumbnail` (or a diagonal-stripe placeholder when missing), `status` label ("Deployed"), `collaborationWith` as a plain text line ("Collaboration with X"), `contributors` (linked name list, populate only when confirmed), link row (`paperUrl`/`publicationId` → resolved paper link, `code`, `demo`, `video`, `poster`, `website` — mono text links, not icon buttons, in the Phase 5 restyle). `description` is not shown, matching poloclub's own card omission. **No detail page, ever** — cards link out. Note: `Publication` has no `themeId` FK, so unlike the mockup's card grid (which mixes Projects and Publications per thrust), this browser shows Projects only — `Publication`s stay on `/publications` and the Featured Publications strip.

**Publication** — `/publications`, one list per category tab, year-desc. Entry: title, authors (mixed linked/plain-text — only authors with a confirmed `personId` link out), venue (italic), year/`dateDisplay`/`month`, location (conference/workshop only), `note` badge ("Spotlight"/"in press" — never award info, see Recognition), doi/url/pdfUrl icons. Category-specific line: patent metadata / `volumeIssue` / book+editors+publisher. `featured` publications also appear in Home's Featured Publications strip, ordered there by `featuredOrder` (independent of the chronological `/publications` order).

**Post** — `kind=news` → Home `#news` only (decision #2): feed entry, no detail page ever, regardless of whether `body` is set. `kind=blog` → `/blog` archive + always-generated `/blog/<slug>`. Fields: `date`, `title`, `summary`, `body` (blog only), `image`, `authorId` ("by [Name]" byline — rare on news), `tags` (blog archive filter), `sourceUrl` ("Read more →"), `relatedPublicationId` (inline citation link).

**SiteMeta** — sitewide chrome, not page content. `title`/`logo` → `<title>` + header; `tagline` → hero headline; `description`/`keywords` → SEO meta + hero intro paragraph; `nav[]` → navbar (§5); `contact` → footer; `primaryInstitutionId` → `utsa`, resolved to `Institution.name` for the header's mono institution tag, convenience-only, never the literal source of the address text; `recruitingNotice` → inverted CTA panel inside `#sponsors` (moved from next-to-`#team` in Phase 5); `socialLinks` → footer link row; `logo.light`/`logo.dark` → theme-aware header/hero swap (`.dark`-driven now that a real toggle exists, not just latent CSS).

**Recognition** — no per-record placement, but (Phase 5, decision #5) summarized per-category via `getRecognitionsByPerson` into the PI's "Honors" list on `#team` — the first real UI use of this data. **ServiceRecord** — still no site placement.

**Course** — no site placement (Teaching was removed entirely in Phase 5, per product direction). `content/teaching.yaml` stays populated but unused, same footing as `ServiceRecord`.

**Sponsor** — Home `#sponsors` logo grid + `grantNumbers` text blurb underneath, bottom of the scroll. No dedicated page.

## 7. Deferred / open items

Things intentionally left for later — don't block on these, but don't lose track of them either:

- **Recognition attribution** — whose achievement is it when the PI isn't first author (e.g. "C. Li et al.")? Decide per-entry during the Phase 1 merge; don't default them all to the PI.
- **PhD students with no `joined`/`left` year in the source data** — backfill approximate years, or leave blank? Leaning: leave blank rather than invent; revisit if the Team section looks sparse.
- **Alumni "current employer" display** — schema has no dedicated field; poloclub shows this prominently. Add a field or infer from the most recent `affiliations` entry, during the Phase 1 merge.
- **`Institution.logo`** — no planned UI slot; revisit only if an "affiliated institutions" strip is ever wanted.
- **Real SyncTREE/QuadraNet repos** — replace the §3.6 placeholder once known.
- **Real sponsor data** beyond the UTSA placeholder (§3.7).
- ~~Possible future one-off PI bio page~~ — **done differently than originally imagined**: rather than a bespoke route, the PI's `bio`/`profile.education`/`affiliations`/`Recognition` now render inline in `#team`'s PI layer (Phase 5, decision #5). `profile.researchPhilosophy`/`researchInterests`/`researchAgenda`/`futureVision`/`quote` and `ServiceRecord` are still unused — a dedicated PI route remains a real possibility if that richer content ever needs a home.
