// Email hashing, password hashing, and the password store (SPEC.md §8.4).
//
// WHERE THINGS LIVE
//   * The roster (public repo) holds only HMAC(EMAIL_HASH_SECRET, address) — never an address.
//   * Passwords live ONLY in this Worker's KV namespace, and only as a slow salted hash:
//       PBKDF2-SHA256( HMAC(PASSWORD_PEPPER, password), random 16-byte salt, 100 000 rounds )
//     The pepper is a Worker secret, so a copy of KV alone is not enough to start guessing
//     passwords offline. 100 000 is the most PBKDF2 rounds Cloudflare's Web Crypto allows.
//   * Each account has a credential version. Setting a password, or an admin revoking
//     access, bumps it; every session carries the version it was issued under and is
//     refused once it is stale. That is how "change password" signs out other devices.
//
// Pure Web Crypto — no dependencies, no Node builtins.
import { b64urlDecode, b64urlEncode } from "./crypto";

const enc = new TextEncoder();

export const PBKDF2_ITERATIONS = 100_000;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256;

async function hmac(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

/** The roster's stored form of an address. Case and surrounding space never matter. */
export async function hashEmail(email: string, secret: string): Promise<string> {
  if (!secret) throw new Error("EMAIL_HASH_SECRET is not set");
  return `hmac-sha256:${b64urlEncode(await hmac(secret, email.trim().toLowerCase()))}`;
}

async function derive(password: string, salt: Uint8Array, iterations: number, pepper: string): Promise<string> {
  if (!pepper) throw new Error("PASSWORD_PEPPER is not set");
  const peppered = await hmac(pepper, password);
  const key = await crypto.subtle.importKey("raw", peppered, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return b64urlEncode(bits);
}

export interface PasswordRecord {
  /** Scheme marker, so the hashing can be upgraded later without guessing. */
  alg: "pbkdf2-sha256+pepper";
  iterations: number;
  salt: string;
  hash: string;
  /** Credential version — see the header comment. */
  version: number;
  updatedAt: string;
}

export async function makePasswordRecord(password: string, pepper: string, version: number): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    alg: "pbkdf2-sha256+pepper",
    iterations: PBKDF2_ITERATIONS,
    salt: b64urlEncode(salt),
    hash: await derive(password, salt, PBKDF2_ITERATIONS, pepper),
    version,
    updatedAt: new Date().toISOString(),
  };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(password: string, record: PasswordRecord, pepper: string): Promise<boolean> {
  const hash = await derive(password, b64urlDecode(record.salt), record.iterations, pepper);
  return safeEqual(hash, record.hash);
}

/**
 * Spend the same time as a real check when there is no account to check against, so the
 * response time does not reveal whether an address is on the roster.
 */
export async function burnPasswordCheck(password: string, pepper: string): Promise<void> {
  await derive(password, new Uint8Array(16), PBKDF2_ITERATIONS, pepper || "x");
}

// --- policy --------------------------------------------------------------------------

/** The most common passwords — enough to stop the obvious ones without shipping a list. */
const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword",
  "12345678", "123456789", "1234567890", "12341234", "11111111", "00000000", "87654321",
  "qwertyui", "qwerty123", "qwertyuiop", "1q2w3e4r", "1qaz2wsx", "zaq12wsx", "asdfghjk",
  "abcd1234", "abc12345", "abcdefgh", "iloveyou", "sunshine", "princess", "football",
  "baseball", "welcome1", "welcome123", "letmein1", "trustno1", "superman", "starwars",
  "computer", "michelle", "jennifer", "whatever", "dragon12", "monkey12", "shadow12",
  "changeme", "default1", "secret12", "admin123", "administrator", "xlab1234", "xlabstudio",
  "studio123", "utsa1234", "buffalo1",
]);

/** Why a password is refused, or undefined when it is acceptable. */
export function passwordProblem(password: string, context: string[] = []): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > MAX_PASSWORD_LENGTH) return `use at most ${MAX_PASSWORD_LENGTH} characters`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "that password is too common — pick something less guessable";
  if (/^(.)\1+$/.test(password)) return "that password is a single repeated character";
  for (const word of context) {
    if (word && word.length >= 4 && lower === word.toLowerCase()) return "don't use your name or address as the password";
  }
  return undefined;
}

// --- store (KV) ----------------------------------------------------------------------

const pwKey = (accountId: string) => `pw:${accountId}`;

export async function readPassword(kv: KVNamespace, accountId: string): Promise<PasswordRecord | undefined> {
  const raw = await kv.get(pwKey(accountId));
  return raw ? (JSON.parse(raw) as PasswordRecord) : undefined;
}

export async function writePassword(kv: KVNamespace, accountId: string, record: PasswordRecord): Promise<void> {
  await kv.put(pwKey(accountId), JSON.stringify(record));
}

/**
 * The account's current credential version: the password record's, or a standalone counter
 * for accounts revoked before they ever set a password. 0 when nothing was ever recorded.
 */
export async function credentialVersion(kv: KVNamespace, accountId: string): Promise<number> {
  const record = await readPassword(kv, accountId);
  const standalone = Number((await kv.get(`cv:${accountId}`)) ?? "0");
  return Math.max(record?.version ?? 0, standalone);
}

/** Invalidate every existing session for an account. */
export async function bumpCredentialVersion(kv: KVNamespace, accountId: string): Promise<number> {
  const next = (await credentialVersion(kv, accountId)) + 1;
  await kv.put(`cv:${accountId}`, String(next));
  const record = await readPassword(kv, accountId);
  if (record) await writePassword(kv, accountId, { ...record, version: next });
  return next;
}
