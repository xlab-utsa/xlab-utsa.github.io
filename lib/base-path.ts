// Single source of truth for where this site actually lives on GitHub Pages.
//
// The repo is `xlab-utsa/xlab-utsa.github.io` — the repo name matches the org name,
// which makes it an organization ROOT Pages site served at https://xlab-utsa.github.io/
// with no path prefix at all. (Migrated 2026-08-23 from the personal project page
// bhargava1424.github.io/xlab.github.io/ — see SPEC.md decision #9.)
//
// If the site ever moves again — a custom domain, a rename, back to a project page —
// this file is the only place in the app that needs to change. lib/studio/config.ts
// re-exports from here rather than redeclaring, so the two cannot drift.
// The Worker keeps its own copy in workers/xlab-gate/wrangler.jsonc (it is deployed
// separately and cannot import TypeScript from this app); keep the two in sync.
export const GITHUB_OWNER = "xlab-utsa";
export const REPO_NAME = "xlab-utsa.github.io";

// Empty because this is a root site, not a project page. Deliberately kept as a named
// constant rather than deleted: withBasePath() below is applied at 13 call sites, and
// re-deriving them all is exactly the bug decision #9 recorded last time this moved.
export const BASE_PATH = "";
export const SITE_URL = `https://${GITHUB_OWNER}.github.io${BASE_PATH}/`;

// next/image does NOT auto-prepend basePath to local asset src when
// images.unoptimized is true (a static-export requirement); every <Image src>
// built from a content/ path (not a Next.js-processed import) must route
// through this, or it 404s if the site is ever served under a subpath again.
export function withBasePath(assetPath: string): string {
  if (/^https?:\/\//.test(assetPath)) return assetPath;
  return `${BASE_PATH}${assetPath}`;
}
