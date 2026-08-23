"use client";

// Renders one field from a FieldSpec derived off the Zod schema. Because the spec comes
// from the schema rather than a hand-written config, a new content field gets a working
// input here the moment it is added to lib/content/schema.ts.
import { useState } from "react";
import type { FieldSpec } from "@/lib/studio/schema-fields";
import { withBasePath } from "@/lib/base-path";

/** Uploads a chosen file and returns the site-relative path it will live at. */
export type AssetPicker = (fieldKey: string, file: File) => Promise<string>;

const inputClass =
  "w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-bg-alt disabled:text-text-faint";

const labelClass = "block font-mono text-[11px] font-bold tracking-wider text-text-faint uppercase";

function get(obj: unknown, key: string): unknown {
  return (obj as Record<string, unknown> | undefined)?.[key];
}

export function FieldInput({
  spec,
  value,
  onChange,
  error,
  suggestions,
  onAssetPick,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (next: unknown) => void;
  error?: string;
  /** Known ids for reference fields (personId, themeIds, …), so users pick instead of type. */
  suggestions?: Record<string, { id: string; label: string }[]>;
  onAssetPick?: AssetPicker;
}) {
  const refOptions = suggestions?.[spec.key];

  if (spec.asset && onAssetPick) {
    return (
      <AssetField
        spec={spec}
        value={value}
        onChange={onChange}
        error={error}
        onAssetPick={onAssetPick}
      />
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className={labelClass}>
          {spec.label}
          {!spec.optional && spec.defaultValue === undefined && (
            <span className="ml-1 text-brand-orange">*</span>
          )}
        </label>
        {spec.readOnly && <span className="font-mono text-[10px] text-text-placeholder">read-only</span>}
      </div>

      <FieldControl
        spec={spec}
        value={value}
        onChange={onChange}
        refOptions={refOptions}
        suggestions={suggestions}
        onAssetPick={onAssetPick}
      />

      {spec.help && <p className="text-[11.5px] leading-snug text-text-faint">{spec.help}</p>}
      {error && <p className="text-[11.5px] font-medium text-brand-orange">{error}</p>}
    </div>
  );
}

/**
 * Image field: preview, upload, remove.
 *
 * The stored path is derived from the record's id, not chosen by the user — that convention
 * is what keeps assets findable and makes "photo uploaded but the field never set" (a real
 * bug in this repo's history, affecting three people) impossible to reproduce.
 */
function AssetField({
  spec,
  value,
  onChange,
  error,
  onAssetPick,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (next: unknown) => void;
  error?: string;
  onAssetPick: AssetPicker;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const path = typeof value === "string" ? value : undefined;

  return (
    <div className="space-y-1">
      <label className={labelClass}>
        {spec.label}
        {!spec.optional && spec.defaultValue === undefined && <span className="ml-1 text-brand-orange">*</span>}
      </label>

      <div className="flex items-start gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-bg-alt">
          {path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={path.startsWith("data:") ? path : withBasePath(path)}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="font-mono text-[10px] text-text-placeholder">none</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setFailure(undefined);
              try {
                onChange(await onAssetPick(spec.key, file));
              } catch (err) {
                setFailure(err instanceof Error ? err.message : "Could not process that image.");
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
            className="block w-full text-[12px] text-text-faint file:mr-2 file:rounded-sm file:border file:border-border file:bg-background file:px-2 file:py-1 file:font-mono file:text-[11px]"
          />
          {path && (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-faint">{path}</code>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="font-mono text-[11px] text-brand-orange hover:underline"
              >
                Remove
              </button>
            </div>
          )}
          {busy && <p className="font-mono text-[11px] text-text-faint">Processing…</p>}
        </div>
      </div>

      {spec.help && <p className="text-[11.5px] leading-snug text-text-faint">{spec.help}</p>}
      {(failure || error) && (
        <p className="text-[11.5px] font-medium text-brand-orange">{failure ?? error}</p>
      )}
    </div>
  );
}

function FieldControl({
  spec,
  value,
  onChange,
  refOptions,
  suggestions,
  onAssetPick,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (next: unknown) => void;
  refOptions?: { id: string; label: string }[];
  suggestions?: Record<string, { id: string; label: string }[]>;
  onAssetPick?: AssetPicker;
}) {
  const disabled = spec.readOnly;

  // A reference field with a known target list becomes a picker rather than free text —
  // this is what stops dangling foreign keys being typed in the first place.
  if (refOptions && spec.kind === "string") {
    return (
      <select
        className={inputClass}
        disabled={disabled}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">— none —</option>
        {refOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  switch (spec.kind) {
    case "enum":
      return (
        <select
          className={inputClass}
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          {spec.optional && <option value="">— none —</option>}
          {(spec.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            disabled={disabled}
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-text-faint">{value ? "yes" : "no"}</span>
        </label>
      );

    case "number":
      return (
        <input
          type="number"
          className={inputClass}
          disabled={disabled}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );

    case "text":
      return (
        <textarea
          rows={6}
          className={`${inputClass} font-sans leading-relaxed`}
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );

    case "array":
      return (
        <ArrayField spec={spec} value={value} onChange={onChange} refOptions={refOptions} suggestions={suggestions} />
      );

    case "object":
      return (
        <div className="space-y-3 border-l border-hairline pl-3">
          {(spec.fields ?? []).map((f) => (
            <FieldInput
              key={f.key}
              spec={f}
              value={get(value, f.key)}
              onChange={(next) =>
                onChange({ ...((value as object) ?? {}), [f.key]: next })
              }
              suggestions={suggestions}
              onAssetPick={onAssetPick}
            />
          ))}
        </div>
      );

    default:
      return (
        <input
          type="text"
          className={inputClass}
          disabled={disabled}
          value={typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value)}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
  }
}

function ArrayField({
  spec,
  value,
  onChange,
  refOptions,
  suggestions,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (next: unknown) => void;
  refOptions?: { id: string; label: string }[];
  suggestions?: Record<string, { id: string; label: string }[]>;
}) {
  const items = Array.isArray(value) ? value : [];
  const element = spec.element;
  const [adding, setAdding] = useState("");

  const replace = (next: unknown[]) => onChange(next.length ? next : undefined);

  // Multi-select for arrays of references (themeIds, contributors) — same anti-dangling-FK
  // reasoning as the single reference picker above.
  if (refOptions) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {refOptions.map((o) => {
          const on = items.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => replace(on ? items.filter((i) => i !== o.id) : [...items, o.id])}
              className={`rounded-sm border px-2 py-1 font-mono text-[11px] transition-colors ${
                on
                  ? "border-brand-soft-border bg-brand-soft-bg text-brand-strong"
                  : "border-border text-text-faint hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            {element && (element.kind === "object" || element.kind === "array") ? (
              <FieldInput
                spec={{ ...element, label: `${spec.label} ${i + 1}` }}
                value={item}
                onChange={(next) => replace(items.map((v, j) => (j === i ? next : v)))}
                suggestions={suggestions}
              />
            ) : (
              <input
                type="text"
                className={inputClass}
                value={typeof item === "string" ? item : String(item ?? "")}
                onChange={(e) => replace(items.map((v, j) => (j === i ? e.target.value : v)))}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => replace(items.filter((_, j) => j !== i))}
            className="mt-1 px-1.5 font-mono text-[11px] text-text-faint hover:text-brand-orange"
            aria-label={`Remove item ${i + 1}`}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          type="text"
          className={inputClass}
          placeholder={element?.kind === "object" ? "Add an entry…" : "Add a value…"}
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (!adding.trim() && element?.kind !== "object") return;
            replace([...items, element?.kind === "object" ? {} : adding.trim()]);
            setAdding("");
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!adding.trim() && element?.kind !== "object") return;
            replace([...items, element?.kind === "object" ? {} : adding.trim()]);
            setAdding("");
          }}
          className="shrink-0 rounded-sm border border-border px-2.5 font-mono text-[11px] text-text-faint hover:text-foreground"
        >
          Add
        </button>
      </div>
    </div>
  );
}
