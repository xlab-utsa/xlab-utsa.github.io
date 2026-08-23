"use client";

// The approval layer. Every change — from anyone, including admins — arrives here as a pull
// request with a real diff before it can reach the live site.
//
// Alongside the raw patch, each submission carries a plain-language reading of its relations:
// which ids resolve and to whom, which authors look like unlinked lab members, whether the
// paper already exists. See lib/studio/submission-review.ts for why that is presentation and
// not a second rulebook.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type DiffFile, type QueueItem, type Snapshot } from "@/lib/studio/api";
import {
  loadChangedRecords,
  reviewSubmission,
  type Finding,
  type FindingLevel,
  type SubmissionReview,
} from "@/lib/studio/submission-review";

const CHECK_LABEL: Record<QueueItem["checks"], { text: string; className: string }> = {
  success: { text: "validated", className: "text-brand-strong" },
  failure: { text: "validation failed", className: "text-brand-orange" },
  pending: { text: "validating…", className: "text-text-faint" },
  unknown: { text: "unknown", className: "text-text-faint" },
};

const FINDING_STYLE: Record<FindingLevel, { mark: string; className: string }> = {
  error: { mark: "✕", className: "text-brand-orange" },
  warn: { mark: "!", className: "text-brand-orange" },
  info: { mark: "·", className: "text-text-faint" },
  ok: { mark: "→", className: "text-brand-strong" },
};

export function ReviewQueue({ canApprove, snapshot }: { canApprove: boolean; snapshot: Snapshot }) {
  const [items, setItems] = useState<QueueItem[]>();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<number>();
  const [files, setFiles] = useState<DiffFile[]>();
  const [busy, setBusy] = useState(false);
  /** Relation reading per PR number, computed once each time the queue loads. */
  const [reviews, setReviews] = useState<Record<number, SubmissionReview>>({});

  const refresh = useCallback(async () => {
    try {
      setItems((await api.queue()).queue);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the queue.");
    }
  }, []);

  useEffect(() => {
    // Fetching remote state on mount and polling it is the case effects exist for; the
    // setState happens in an async continuation, not synchronously during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Poll while the tab is open so a submission's CI result appears without a manual reload.
    const t = setInterval(() => void refresh(), 20000);
    return () => clearInterval(t);
  }, [refresh]);

  // The relation reading is what makes an id in the diff mean anything, so it is computed for
  // the whole queue rather than only for whichever row happens to be expanded.
  const pending = useMemo(
    () => (items ?? []).filter((item) => !(item.number in reviews)),
    [items, reviews]
  );

  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        pending.map(async (item) => {
          try {
            const { files: diff } = await api.queueFiles(item.number);
            const { records, skipped } = await loadChangedRecords(diff, item.branch);
            return [item.number, reviewSubmission(records, snapshot, skipped)] as const;
          } catch {
            return undefined;
          }
        })
      );
      if (cancelled) return;
      const next = Object.fromEntries(results.filter((r): r is NonNullable<typeof r> => Boolean(r)));
      if (Object.keys(next).length) setReviews((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, snapshot]);

  async function showDiff(n: number) {
    if (open === n) {
      setOpen(undefined);
      return;
    }
    setOpen(n);
    setFiles(undefined);
    try {
      setFiles((await api.queueFiles(n)).files);
    } catch {
      setFiles([]);
    }
  }

  async function act(n: number, action: "approve" | "reject") {
    const reason =
      action === "reject" ? (prompt("Why is this being returned? The submitter will see this.") ?? "") : "";
    if (action === "reject" && !reason.trim()) return;
    setBusy(true);
    try {
      if (action === "approve") await api.approve(n);
      else await api.reject(n, reason);
      setOpen(undefined);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-brand-orange">{error}</p>;
  if (!items) return <p className="text-sm text-text-faint">Loading queue…</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border py-12 text-center">
        <p className="text-sm font-medium text-foreground">Nothing waiting for review</p>
        <p className="mt-1 text-[12.5px] text-text-faint">Submissions appear here the moment they are made.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const check = CHECK_LABEL[item.checks];
        const review = reviews[item.number];
        return (
          <div key={item.number} className="rounded-sm border border-border">
            <div className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-text-faint">
                  #{item.number} · {item.author} · {new Date(item.createdAt).toLocaleString()} ·{" "}
                  <span className={check.className}>{check.text}</span>
                  {review && (
                    <>
                      {" · "}
                      <ReviewChip review={review} />
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => void showDiff(item.number)} className="font-mono text-[11px] text-text-faint hover:text-foreground">
                  {open === item.number ? "Hide changes" : "View changes"}
                </button>
                {canApprove && (
                  <>
                    <button
                      onClick={() => void act(item.number, "approve")}
                      disabled={busy || item.checks === "failure" || item.checks === "pending"}
                      title={
                        item.checks === "failure"
                          ? "Validation is failing — this cannot be approved"
                          : item.checks === "pending"
                            ? "Validation is still running"
                            : undefined
                      }
                      className="rounded-sm bg-invert-bg px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-invert-fg uppercase disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void act(item.number, "reject")}
                      disabled={busy}
                      className="font-mono text-[11px] text-brand-orange hover:underline disabled:opacity-40"
                    >
                      Return
                    </button>
                  </>
                )}
              </div>
            </div>

            {review && review.findings.length > 0 && <ReviewPanel review={review} />}

            {open === item.number && (
              <div className="border-t border-hairline bg-bg-alt p-3">
                {!files ? (
                  <p className="text-[12.5px] text-text-faint">Loading diff…</p>
                ) : files.length === 0 ? (
                  <p className="text-[12.5px] text-text-faint">No diff available.</p>
                ) : (
                  files.map((f) => (
                    <div key={f.filename} className="mb-3 last:mb-0">
                      <p className="font-mono text-[11px] text-text-faint">
                        {f.status} · {f.filename} (+{f.additions}/−{f.deletions})
                      </p>
                      {f.patch && (
                        <pre className="mt-1 max-h-72 overflow-auto rounded-sm border border-hairline bg-background p-2 font-mono text-[11.5px] leading-relaxed">
                          {f.patch.split("\n").map((line, i) => (
                            <div
                              key={i}
                              className={
                                line.startsWith("+") && !line.startsWith("+++")
                                  ? "text-brand-strong"
                                  : line.startsWith("-") && !line.startsWith("---")
                                    ? "text-brand-orange"
                                    : "text-text-faint"
                              }
                            >
                              {line || " "}
                            </div>
                          ))}
                        </pre>
                      )}
                    </div>
                  ))
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-brand-strong hover:underline"
                >
                  Open on GitHub ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** One-glance verdict on the collapsed row. */
function ReviewChip({ review }: { review: SubmissionReview }) {
  const errors = review.findings.filter((f) => f.level === "error").length;
  const warns = review.findings.filter((f) => f.level === "warn").length;
  if (errors) return <span className="text-brand-orange">{errors} broken link{errors === 1 ? "" : "s"}</span>;
  if (warns) return <span className="text-brand-orange">{warns} thing{warns === 1 ? "" : "s"} to check</span>;
  return <span className="text-brand-strong">links look right</span>;
}

/**
 * The relation reading, shown above the patch rather than inside it.
 *
 * Ordered worst-first, and "ok" lines are kept: seeing `personId → Jinjun Xiong` is the whole
 * point. An id a reviewer cannot resolve is an id they cannot check.
 */
function ReviewPanel({ review }: { review: SubmissionReview }) {
  const order: FindingLevel[] = ["error", "warn", "info", "ok"];
  const sorted = [...review.findings].sort(
    (a, b) => order.indexOf(a.level) - order.indexOf(b.level)
  );
  const byPath = new Map<string, Finding[]>();
  for (const f of sorted) byPath.set(f.path, [...(byPath.get(f.path) ?? []), f]);

  return (
    <div className="border-t border-hairline px-3 py-2">
      {[...byPath.entries()].map(([path, findings]) => (
        <div key={path} className="mb-2 last:mb-0">
          <p className="font-mono text-[10.5px] tracking-wider text-text-placeholder uppercase">{path}</p>
          <ul className="mt-1 space-y-1">
            {findings.map((f, i) => {
              const style = FINDING_STYLE[f.level];
              return (
                <li key={i} className="text-[12.5px] leading-snug">
                  <span className={`mr-1.5 font-mono ${style.className}`}>{style.mark}</span>
                  <span className={f.level === "error" || f.level === "warn" ? "text-foreground" : "text-text-faint"}>
                    {f.message}
                  </span>
                  {f.detail && (
                    <ul className="mt-0.5 ml-5 space-y-0.5">
                      {f.detail.map((d, j) => (
                        <li key={j} className="font-mono text-[11px] leading-snug text-text-faint">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
