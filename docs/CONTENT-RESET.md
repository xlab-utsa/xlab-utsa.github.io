# Starting the content over

How to clear the site's content and have lab members re-enter their own, without breaking
anything and without losing what was there.

This was the original plan for the site (the existing records were bulk-scraped from the old
Hugo site, `xlab-ub.com`, and LinkedIn, and were always treated as provisional). It was
**deliberately not done** — as of 2026-08-13 the decision is to curate the existing records
through Studio instead. This document exists so that if the decision changes, the reset is a
known, safe operation rather than something improvised at the wrong moment.

---

## The one rule

**`access/roster.json` is never part of a content reset.**

That file is who can sign in — including your own admin account. It lives outside `content/`,
so it is out of scope by construction. `scripts/reset-content.mjs` also warns if it is missing
before starting and re-checks that it still exists afterwards.

If you ever do lose it:

```bash
git checkout HEAD -- access/roster.json
```

If that fails too, edit the file by hand and push — it is plain JSON, and the Worker re-reads
it within a minute.

---

## Why a reset is safe now (it was not always)

Two things had to be fixed first, and both are done:

1. **An empty blog used to fail the entire build.** `output: "export"` rejects an empty
   `generateStaticParams()`, so deleting the last blog post took the whole site down — not
   just `/blog`. `app/blog/[slug]/page.tsx` now falls back to a sentinel slug that renders as
   a 404. Verified by building against a 4-record content tree.
2. **Every homepage section guards on `length === 0`.** News, research, featured publications,
   sponsors and the alumni grid all return `null` when empty rather than rendering a broken
   shell. Stat counters read `0`, not `NaN`.

And the safety net underneath: if a build ever does fail, **GitHub Pages keeps serving the
last successful deploy**. A reset cannot take the live site down.

---

## Doing it

### 1. See what would happen

```bash
node scripts/reset-content.mjs
```

Dry run. Prints how many records of each kind would be archived, which are kept, and confirms
the roster is untouched. Nothing changes.

### 2. Do it

```bash
node scripts/reset-content.mjs --apply
```

Everything in `content/` **moves** to `content-archive/`. Nothing is deleted — the archive
stays in git, so any record can be brought back later.

What is kept, because the site must still build:

| Kept | Why |
|---|---|
| `content/site.yaml` | Title, nav, contact. The site cannot render without it |
| `content/institutions/*` | Referenced by people's affiliations and `site.primaryInstitutionId` |
| `content/themes/*` | The six research thrusts — structural, not per-person data |
| `content/people/jinjun-xiong.yaml` | So the site is not a blank page while members re-enter theirs |

Keep different people with `--keep-people=id-one,id-two`.

`public/images/**` is left alone on purpose, so an archived record restored later still has its
photo. The validator will report the now-unreferenced images as **warnings**, which is correct
and harmless — they are not errors and will not block anything.

### 3. Check, then commit

```bash
npm run validate:content   # what remains must still be coherent
npm run build              # and must still build
git add -A && git commit -m "Reset content; archive previous records"
```

### 4. Invite everyone

In Studio → **Roster & access**, add each member (name + email; the profile id fills in from
the name) and send them their invite link. On first sign-in they create their own profile.

Every submission still comes to you for approval, so the site fills up under review rather than
all at once.

---

## Undoing it

Before committing:

```bash
git checkout HEAD -- content content-archive
```

After committing — find the reset commit and revert it:

```bash
git log --oneline
git revert <the-reset-commit>
```

Or restore individual records from `content-archive/` through Studio, which is usually what you
actually want: bring back the twenty publications that still matter rather than all 301.

---

## What this does not do

- Does not touch `access/roster.json` (see above).
- Does not touch `public/images/**`.
- Does not delete anything — `content-archive/` is a move, and it stays in git.
- Does not change the schema. Archived records are schema v2 and restore without conversion.
