// Typed client for the xlab-gate Worker, plus session handling.
//
// The session is a bearer token in localStorage rather than a cookie: Studio is served from
// github.io and the gate lives on workers.dev, so a cookie would be cross-site and subject
// to third-party-cookie blocking. A bearer token in a header has no such problem.
"use client";

import { GATE_URL, SNAPSHOT_PATH, TOKEN_KEY } from "./config";
import { withBasePath } from "@/lib/base-path";
import type { SnapshotReport } from "@/lib/content/report";
import type {
  Course,
  Institution,
  Person,
  Post,
  Project,
  Publication,
  Recognition,
  ResearchTheme,
  ServiceRecord,
  SiteMeta,
  Sponsor,
} from "@/lib/content/schema";

// --- session -------------------------------------------------------------------

export interface Identity {
  sub: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "member";
  personId?: string;
}

export function getToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(TOKEN_KEY) ?? undefined;
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * The gate redirects back with `#token=...` after sign-in. Capture it, store it, and strip
 * it from the URL so the token does not sit in the address bar or leak via a shared link.
 */
export function captureTokenFromHash(): { error?: string } {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  const token = params.get("token");
  const error = params.get("error") ?? undefined;
  if (token) setToken(token);
  if (token || error) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  return { error };
}

export const signInWithGitHubUrl = `${GATE_URL}/auth/github/start`;

// --- gate calls ----------------------------------------------------------------

export class GateError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${GATE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A dead session should sign the user out rather than leave the UI in a broken state.
    if (res.status === 401) clearToken();
    throw new GateError((data as { error?: string }).error ?? `request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  me: () => call<Identity>("/me"),

  health: () =>
    call<{ checks: { github: string; roster: string; email: string } }>("/health"),

  queue: () => call<{ queue: QueueItem[] }>("/queue"),

  queueFiles: (n: number) => call<{ files: DiffFile[] }>(`/queue/${n}/files`),

  submit: (payload: SubmitPayload) =>
    call<{ ok: true; pr: { number: number; url: string; branch: string } }>("/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  approve: (number: number) =>
    call<{ ok: true }>("/approve", { method: "POST", body: JSON.stringify({ number }) }),

  reject: (number: number, reason: string) =>
    call<{ ok: true }>("/reject", { method: "POST", body: JSON.stringify({ number, reason }) }),

  status: () =>
    call<{ deploy?: { status: string; conclusion: string | null; createdAt: string; url: string } }>(
      "/status"
    ),

  /** Admin only — the gate refuses this for editors and members. */
  roster: () => call<{ members: RosterEntry[] }>("/roster"),

  /**
   * Admin only. Mints a single-use sign-in link for someone already on the roster, which
   * the admin delivers by hand. This is what lets members sign in with no email provider
   * configured at all.
   */
  invite: (email: string) =>
    call<{ link: string; expiresInDays: number; name: string; reusable: boolean }>("/invite", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /** Admin only — invalidates every outstanding sign-in link for one address. */
  revokeInvites: (email: string) =>
    call<{ ok: true; revoked: number }>("/revoke-invites", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};

export interface RosterEntry {
  email: string;
  name: string;
  role: "admin" | "editor" | "member";
  personId?: string;
  githubLogin?: string;
  active: boolean;
}

export const ROSTER_PATH = "access/roster.json";

export interface QueueItem {
  number: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  url: string;
  branch: string;
  labels: string[];
  checks: "success" | "failure" | "pending" | "unknown";
}

export interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface FileChange {
  path: string;
  content?: string;
  contentBase64?: string;
  delete?: boolean;
}

export interface SubmitPayload {
  title: string;
  summary?: string;
  files: FileChange[];
}

// --- content snapshot ----------------------------------------------------------

export interface SnapshotContent {
  siteMeta: SiteMeta;
  institutions: Institution[];
  people: Person[];
  researchThemes: ResearchTheme[];
  projects: Project[];
  publications: Publication[];
  posts: Post[];
  recognitions: Recognition[];
  service: ServiceRecord[];
  courses: Course[];
  sponsors: Sponsor[];
}

export interface Snapshot {
  generatedAt: string;
  commit: string;
  schemaVersion: number;
  counts: Record<string, number>;
  /**
   * The integrity verdict, computed by the real validator at build time.
   *
   * Optional only so a snapshot published before this field existed still loads; every
   * snapshot built from this commit onwards carries it.
   */
  report?: SnapshotReport;
  content: SnapshotContent;
}

export async function loadSnapshot(): Promise<Snapshot> {
  // Cache-bust so an approved change is visible as soon as Pages finishes deploying,
  // rather than after the browser's HTTP cache happens to expire.
  const res = await fetch(`${withBasePath(SNAPSHOT_PATH)}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`could not load content snapshot (${res.status})`);
  return res.json();
}
