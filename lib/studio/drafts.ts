// Unsaved edits, kept in localStorage.
//
// A researcher who typed a bio and lost it to a closed tab will not type it twice — they
// will stop. Every form in Studio therefore keeps what was typed, per record, until it is
// submitted or explicitly discarded. Images are not kept: they are large and re-picking one
// is a single click.
"use client";

type Rec = Record<string, unknown>;

export interface Draft {
  savedAt: string;
  record: Rec;
  /** true when this is the copy of what was last SENT, not an unsaved edit. */
  sent?: boolean;
}

const PREFIX = "xlab-studio-draft:";

export function draftKeyFor(entityKey: string, isNew: boolean, id: string | undefined): string {
  return `${PREFIX}${entityKey}:${isNew ? "new" : "edit"}:${id ?? ""}`;
}

/** Where the last submitted version is kept, so a returned submission can be fixed, not retyped. */
const sentKey = (key: string) => `${key}:sent`;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What to offer when a form opens: unsaved edits first; otherwise the version last sent
 * from this browser, if it differs from the live record (i.e. it was returned, or is still
 * in review). Nothing, when either would just reproduce what the form opens with anyway.
 */
export function readDraft(key: string, initial: Rec): Draft | undefined {
  return readOne(key, initial) ?? readOne(sentKey(key), initial);
}

function readOne(key: string, initial: Rec): Draft | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const draft = JSON.parse(raw) as Draft;
    if (!draft?.record || typeof draft.savedAt !== "string") return undefined;
    return same(draft.record, initial) ? undefined : draft;
  } catch {
    return undefined;
  }
}

/** Called on a successful submit: the unsaved draft is cleared and the sent copy kept. */
export function markSent(key: string, record: Rec): void {
  clearDraft(key);
  try {
    window.localStorage.setItem(sentKey(key), JSON.stringify({ savedAt: new Date().toISOString(), record, sent: true } satisfies Draft));
  } catch {
    /* ignore */
  }
}

export function writeDraft(key: string, record: Rec, initial: Rec): void {
  try {
    // Nothing typed yet: keep storage clean rather than offering an empty "draft" later.
    if (same(record, initial)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), record } satisfies Draft));
  } catch {
    /* storage full or blocked — losing the safety net is not worth an error */
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Forget both the unsaved and the sent copy — "Discard" on the restore notice. */
export function forgetDraft(key: string): void {
  clearDraft(key);
  clearDraft(sentKey(key));
}
