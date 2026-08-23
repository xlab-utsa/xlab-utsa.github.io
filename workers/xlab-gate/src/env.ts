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
  EMAIL_PROVIDER: "brevo" | "resend";
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
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
  /** SECRET — Brevo or Resend API key. */
  EMAIL_API_KEY: string;
  /** SECRET — random 32+ byte string; signs session and magic-link tokens. */
  SESSION_SECRET: string;
}

export type Role = "admin" | "editor" | "member";

export interface Identity {
  /** Stable subject: the member's email, or "github:<login>" for admin sign-in. */
  sub: string;
  email: string;
  name: string;
  role: Role;
  /** content/people/<personId>.yaml this user owns, when they are a lab member. */
  personId?: string;
}
