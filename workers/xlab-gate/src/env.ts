// Runtime bindings. Values in `vars` come from wrangler.jsonc; everything marked SECRET
// is set with `wrangler secret put NAME` and exists only inside Cloudflare — never in the
// repo, never in a build artifact, never in a log line.
export interface Env {
  SESSIONS: KVNamespace;

  // --- config (wrangler.jsonc vars) ---
  SITE_ORIGIN: string;
  STUDIO_URL: string;
  REPO_OWNER: string;
  REPO_NAME: string;
  REPO_BRANCH: string;
  ALLOWED_WRITE_PREFIXES: string;
  MAX_PAYLOAD_BYTES: string;

  // --- secrets ---
  /** SECRET — GitHub App numeric id. */
  GITHUB_APP_ID: string;
  /** SECRET — the .pem contents GitHub gave you. PKCS#1 or PKCS#8, either is handled. */
  GITHUB_APP_PRIVATE_KEY: string;
  /** SECRET — GitHub App OAuth client id, for admin sign-in. */
  GITHUB_CLIENT_ID: string;
  /** SECRET — GitHub App OAuth client secret. */
  GITHUB_CLIENT_SECRET: string;
  /** SECRET — random 32+ byte string; signs session and set-password tokens. */
  SESSION_SECRET: string;
  /**
   * SECRET — random 32+ byte string; keys the HMAC that turns an address into the roster's
   * emailHashes. Separate from SESSION_SECRET on purpose: rotating sessions must not change
   * every stored hash. Rotating THIS one locks everyone out until the roster is re-hashed.
   */
  EMAIL_HASH_SECRET: string;
  /** SECRET — random 32+ byte string mixed into every password hash (a "pepper"). Never rotate. */
  PASSWORD_PEPPER: string;
}

export type Role = "admin" | "editor" | "member";

export interface Identity {
  /** Who signed in, and how: "account:<id>" (password) or "github:<login>". */
  sub: string;
  /** The roster account id (access/roster.json `id`). */
  account: string;
  /** The address typed at sign-in, if any. Shown back to the user; never written to the repo. */
  email: string;
  name: string;
  role: Role;
  /** content/people/<personId>.yaml this user owns, when they are a lab member. */
  personId?: string;
}
