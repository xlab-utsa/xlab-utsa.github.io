// Studio client configuration.
//
// CLIENT-SAFE. Nothing in lib/studio/** may import lib/content/index.ts or
// lib/content/loader.ts — those use fs and would break the browser bundle. Import
// lib/content/schema.ts instead; it is pure Zod.

/** The xlab-gate Worker. Holds the only GitHub credential; see workers/xlab-gate/. */
export const GATE_URL = "https://xlab-gate.xlab-studio.workers.dev";

/**
 * Build-time snapshot of all content, published as a static asset by
 * scripts/build-snapshot.ts. A static site has no runtime filesystem, so this is how
 * Studio reads what is currently live. It includes drafts; the public site filters them.
 */
export const SNAPSHOT_PATH = "/content-snapshot.json";

/**
 * The public repo, used to read a submission's proposed file contents straight from its
 * branch via raw.githubusercontent.com.
 *
 * The diff the gate returns is a patch — enough to show what changed, not enough to check
 * whether the resulting record's links resolve. Reading the whole file needs no credential
 * (the repo is public), no account, and no change to the Worker.
 *
 * Re-exported from lib/base-path.ts rather than redeclared: these used to be a third
 * independent copy of the owner/repo pair, and a rename had to find all of them. That file
 * is pure constants with no fs import, so it is safe for the client bundle. The Worker's
 * REPO_OWNER/REPO_NAME in workers/xlab-gate/wrangler.jsonc must still match by hand — it
 * deploys separately and cannot import from this app.
 */
export { GITHUB_OWNER as REPO_OWNER, REPO_NAME } from "@/lib/base-path";

/** localStorage key for the session bearer token. */
export const TOKEN_KEY = "xlab-studio-token";
