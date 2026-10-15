"use client";

// Inline notices, replacing window.alert() across Studio.
//
// An alert steals focus, hides the screen it is talking about, and vanishes without a
// trace; a notice sits next to the thing it describes and stays until the person is done
// reading. Same visual language as the existing "Submitted for review" toast so nothing
// here looks foreign.
import type { ReactNode } from "react";

export type NoticeKind = "ok" | "info" | "warn" | "error";

const STYLE: Record<NoticeKind, { box: string; title: string }> = {
  ok: { box: "border-brand-soft-border bg-brand-soft-bg", title: "text-brand-strong" },
  info: { box: "border-border bg-bg-alt", title: "text-foreground" },
  warn: { box: "border-brand-orange-soft-border bg-brand-orange-soft-bg", title: "text-brand-orange-strong" },
  error: { box: "border-brand-orange/40 bg-brand-orange/5", title: "text-brand-orange" },
};

export function Notice({
  kind = "info",
  title,
  children,
  onDismiss,
  actions,
  className = "",
}: {
  kind?: NoticeKind;
  /** One short line that says what happened. */
  title?: ReactNode;
  /** What it means and what to do next. */
  children?: ReactNode;
  onDismiss?: () => void;
  /** Buttons/links rendered under the text. */
  actions?: ReactNode;
  className?: string;
}) {
  const s = STYLE[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-sm border px-3 py-2.5 text-sm ${s.box} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {title && <p className={`font-medium ${s.title}`}>{title}</p>}
          {children && (
            <div className={`text-[12.5px] leading-relaxed text-text-faint ${title ? "mt-0.5" : ""}`}>{children}</div>
          )}
          {actions && <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 px-1 text-text-faint hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/** A compact action button that matches Studio's existing mono-label buttons. */
export function ActionButton({
  onClick,
  children,
  primary,
  disabled,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        primary
          ? "rounded-sm bg-invert-bg px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-invert-fg uppercase disabled:opacity-50"
          : "rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase hover:border-brand disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
