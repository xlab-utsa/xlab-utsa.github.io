# xlab-gate

The auth and repo-write gateway for X-Lab Studio. Runs on Cloudflare Workers (free tier).

This is the **only** component in the system that holds a GitHub credential. No human — not
even the site owner — needs write access to the repo.

## Why it is built the way it is

**It is deliberately schema-blind.** It checks who you are, which path you may write, and
how large the payload is. It knows nothing about Person, Publication, or any other content
type. Schema correctness is enforced in CI on the pull request it opens
(`.github/workflows/validate.yml`).

That is what makes "set it up once and never touch it again" literally true: adding a field
or a whole content type to the site never requires redeploying this Worker.

**Every write is a pull request.** There is no "commit straight to main" function in the
codebase, not even for admins. Every change is therefore reviewable, diffable, and
revertable by construction rather than by policy.

**A GitHub App, not a personal access token.** Fine-grained PATs expire after at most 366
days; App private keys do not. A PAT would mean the write path silently breaks a year after
setup, which is exactly the failure mode this project is meant to avoid.

## One-time setup

### 1. Cloudflare

```bash
npx wrangler login
```

Register a `workers.dev` subdomain (once per account) at
**Workers & Pages → Overview → Manage subdomain** in the dashboard. Until you do, the Worker
deploys successfully but its URL does not resolve.

The KV namespace is already created and bound in `wrangler.jsonc`. It holds only
short-lived state — password hashes, set-password links and rate-limit counters. The source of truth for
content and roster is the git repo, so losing this namespace costs nothing but in-flight
sign-in links.

### 2. GitHub App

Create it **owned by the organisation**, not by a person, at
**github.com/organizations/xlab-utsa/settings/apps/new** (requires org-owner rights). An
org-owned App survives whoever set it up leaving the lab; a personally-owned one does not.

| Setting | Value |
|---|---|
| Name | `X-Lab Studio Gate` |
| Homepage URL | `https://xlab-utsa.github.io/` |
| Callback / Redirect URI | `https://xlab-gate.xlab-studio.workers.dev/auth/github/callback` |
| Expire user authorization tokens | unchecked |
| Webhook → Active | **unchecked** |
| Repository permission: Contents | Read and write |
| Repository permission: Pull requests | Read and write |
| Repository permission: **Workflows** | **No access** (deliberate — nothing here can alter CI) |
| Where can this be installed | Only on this account |

The callback URI must match the deployed Worker's origin exactly — the Worker builds its
redirect from `new URL(req.url).origin` (`src/index.ts`), so a mismatch fails at GitHub's
end with `redirect_uri_mismatch`, not in any log here.

Then **Install App** onto `xlab-utsa/xlab-utsa.github.io` only, and collect: App ID,
Client ID, a generated client secret, and a generated private key (`.pem`).

The `.pem` GitHub gives you is PKCS#1. No conversion needed — the Worker wraps it into
PKCS#8 at runtime (`src/crypto.ts`), because Web Crypto only imports PKCS#8 and an
`openssl` step is easy to get wrong and easy to forget.

### 3. No email — by decision

The system never sends email (SPEC.md §8.4). People sign in with **email + password**.
First passwords and resets go through a **one-time set-password link** that an admin
creates in Studio (Roster → *Set-password link*) and hands over however they already talk
to the person. Approve/reject sends no notice; members see returned submissions, with the
reviewer's note, inside Studio.

### 4. Secrets

Run from this directory. These go straight from your machine into Cloudflare — they never
touch the repo, a build artifact, or a log line.

```bash
npx wrangler secret put GITHUB_APP_ID           # the numeric App ID
npx wrangler secret put GITHUB_APP_PRIVATE_KEY  # paste the whole .pem, BEGIN/END lines included
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET          # random 32+ chars — signs sessions and set-password links
npx wrangler secret put EMAIL_HASH_SECRET       # random 32+ chars — turns addresses into the roster's emailHashes
npx wrangler secret put PASSWORD_PEPPER         # random 32+ chars — mixed into every password hash
```

Generate each with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

What rotating each one does — read before you ever do it:

| Secret | If rotated |
|---|---|
| `SESSION_SECRET` | Everyone is signed out and outstanding set-password links die. Passwords keep working. |
| `EMAIL_HASH_SECRET` | **Nobody can sign in with a password** until every roster address is re-hashed (Roster → *+ address*, per person). Don't. |
| `PASSWORD_PEPPER` | **Every password stops working**; everyone needs a new set-password link. Don't. |

Store the last two somewhere safe (a password manager). Losing them is the same as rotating them.

### 5. Roster

`access/roster.json` in the repo root lists who may sign in. It holds no addresses — only
`emailHashes`, which only this Worker can compute — and no passwords. Manage it from Studio
(Roster & access): adding someone takes their email, the Worker hashes it, and the change
goes through review like any other. Admins who also sign in with GitHub need `githubLogin`.

**Switching an existing roster to hashes** (one time, after this Worker is deployed with
`EMAIL_HASH_SECRET`): sign in as an admin with GitHub, open Roster, click **Hash them now**,
approve the PR. Sign-in works throughout. Older plain-text versions remain in git history.

### 6. Deploy

```bash
npm run deploy      # typecheck, deploy, then the smoke test
```

**Order when sign-in changes ship:** set the two new secrets → deploy this Worker → then
merge the site change. A site built for passwords talking to an old Worker tells users that
password sign-in isn't switched on yet; admins can still use GitHub.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | Email + password → session. Same answer and timing whether or not the address exists; rate-limited per IP; an account locks for 15 minutes after 10 wrong passwords |
| GET | `/auth/set-password` | — | Show the "choose a password" form for a set-password link. Spends **nothing** — link previews and mail scanners GET every URL they see |
| POST | `/auth/set-password` | — | Set the password (min 8 chars, common ones refused), burn the link, end the account's older sessions, sign in |
| GET | `/auth/verify` | — | Retired (pre-password sign-in links). Shows a "ask for a set-password link" page |
| GET | `/auth/github/start` · `/callback` | — | Admin sign-in via GitHub, so admin access can rest on GitHub 2FA |
| GET | `/me` | session | Current identity and role |
| POST | `/submit` | session | Open a submission PR |
| GET | `/file?path=content/…` | session | Exact current text of one content file (for one-line self-link submissions) |
| GET | `/queue` | session | Open submissions (members see only their own) |
| GET | `/returned` | session | Recently returned submissions with the reviewer's note (members see only their own) |
| GET | `/queue/:n/files` | admin/editor | Field-level diff for one submission |
| POST | `/approve` · `/reject` | admin/editor | Merge or close |
| GET | `/roster` | admin | The roster in force |
| POST | `/hash-email` | admin | Hash an address for the roster |
| POST | `/invite` | admin | One-time set-password link for a roster account (`{ account }`) |
| POST | `/revoke-invites` | admin | Cancel an account's links **and** sign it out everywhere |
| GET | `/status` | session | Latest deploy run |

## Security properties

- No GitHub credential ever reaches a browser. Sessions are HMAC-signed bearer tokens.
- Passwords exist only in KV, only as PBKDF2-SHA256 (100 000 rounds, the most Workers'
  Web Crypto allows) over an HMAC with `PASSWORD_PEPPER`, with a random salt per record. A
  copy of KV alone is not enough to start guessing.
- Each account has a credential version. A new password, or *Sign out everywhere*, bumps it,
  and every older session is refused on its next request.
- The public repo never holds an address: the roster stores HMACs, and PRs name the
  submitter by account id.
- Path allowlist (`content/`, `public/images/`, `access/`) plus traversal rejection is applied
  *before* any GitHub token is minted.
- Members may edit their own person record; create publications, awards, posts and projects;
  edit only records that already name them; and add *their own* id under an unlinked author
  on a paper (one inserted line, nothing else). All of it is resolved server-side from the
  repo, never trusted from the client. Members can never delete.
- Set-password links are single-use and expire after 14 days; they are spent only by the
  form's POST.
- Every authenticated request re-checks the caller against the live roster (cached 60 s):
  deactivating someone signs them out within a minute.
- OAuth uses single-use `state` values for CSRF protection.
- Approval refuses to merge a submission whose CI gate is failing.
- Errors are logged in full but returned generically, so GitHub API internals are not echoed.

## Local development

```bash
npm run dev        # wrangler dev
npm run typecheck
npm test           # (from the REPO ROOT) token forgery/expiry, PKCS#1 key import, path authorization matrix
npm run tail       # live production logs
```
