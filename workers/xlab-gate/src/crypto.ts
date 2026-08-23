// Token signing and key handling. Pure Web Crypto — no Node builtins, no dependencies.
//
// Sessions are stateless signed bearer tokens rather than cookies: Studio is served from
// github.io and this Worker lives on workers.dev, so a cookie would be cross-site and at
// the mercy of third-party-cookie blocking. A bearer token in an Authorization header has
// no such problem.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Timing-safe comparison — a plain === on a signature leaks it byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Sign an arbitrary JSON payload. Used for both sessions and single-use magic links. */
export async function signToken(payload: object, secret: string): Promise<string> {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64urlEncode(sig)}`;
}

/**
 * Verify and decode. Returns undefined on any failure — bad signature, malformed token, or
 * expiry — so callers cannot accidentally treat a rejected token as valid.
 */
export async function verifyToken<T extends { exp?: number }>(
  token: string,
  secret: string
): Promise<T | undefined> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return undefined;

  const expected = b64urlEncode(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body))
  );
  if (!safeEqual(sig, expected)) return undefined;

  let payload: T;
  try {
    payload = JSON.parse(dec.decode(b64urlDecode(body)));
  } catch {
    return undefined;
  }
  if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) return undefined;
  return payload;
}

export function randomId(bytes = 16): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

// --- GitHub App JWT ------------------------------------------------------------

function derLength(len: number): number[] {
  if (len < 0x80) return [len];
  const out: number[] = [];
  let n = len;
  while (n > 0) {
    out.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | out.length, ...out];
}

/**
 * GitHub hands out PKCS#1 keys ("BEGIN RSA PRIVATE KEY"), but Web Crypto only imports
 * PKCS#8 ("BEGIN PRIVATE KEY"). Rather than making setup include an openssl conversion
 * step that is easy to get wrong and easy to forget, wrap PKCS#1 in the PKCS#8 envelope
 * here: SEQUENCE { INTEGER 0, AlgorithmIdentifier(rsaEncryption, NULL), OCTET STRING(key) }.
 */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = [0x02, 0x01, 0x00];
  // AlgorithmIdentifier: OID 1.2.840.113549.1.1.1 (rsaEncryption) + NULL params
  const algId = [
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ];
  const octet = [0x04, ...derLength(pkcs1.length), ...pkcs1];
  const body = [...version, ...algId, ...octet];
  return Uint8Array.from([0x30, ...derLength(body.length), ...body]);
}

async function importAppKey(pem: string): Promise<CryptoKey> {
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const der = b64urlDecode(
    pem
      .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "")
      .replace(/-----END (?:RSA )?PRIVATE KEY-----/, "")
      .replace(/\s+/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
  );
  return crypto.subtle.importKey(
    "pkcs8",
    (isPkcs1 ? pkcs1ToPkcs8(der) : der) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * Mint the short-lived JWT that proves we are the GitHub App. Exchanged immediately for an
 * installation token; never stored. GitHub rejects anything older than 10 minutes, so this
 * asks for 9 and back-dates `iat` by 60s to tolerate clock skew.
 */
export async function appJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64urlEncode(
    enc.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }))
  );
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await importAppKey(privateKeyPem),
    enc.encode(signingInput)
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}
