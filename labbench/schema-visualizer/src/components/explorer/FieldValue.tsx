import { ArrowUpRight } from "lucide-react";
import { entities } from "../../lib/schema-graph";
import { resolveId } from "../../lib/synthetic-data";

function labelFor(entityId: string) {
  return entities.find((e) => e.id === entityId)?.label ?? entityId;
}

/** A single string value, resolved inline if it happens to be a known record id —
 * this is what makes an id like "fake-inst-beta" show its actual name the moment you
 * see it, instead of only in a separate Relationships list further down the page. */
function StringValue({ value, onNavigate }: { value: string; onNavigate: (entityId: string, id: string) => void }) {
  const resolved = resolveId(value);
  if (!resolved) return <span className="font-mono text-[11px] text-zinc-100">{value}</span>;
  return (
    <button
      onClick={() => onNavigate(resolved.entityId, value)}
      className="inline-flex items-center gap-1 rounded border border-emerald-700/40 bg-emerald-900/20 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300 hover:bg-emerald-900/40"
      title={`${value} — click to open`}
    >
      {resolved.label}
      <span className="text-emerald-500/70">({labelFor(resolved.entityId)})</span>
      <ArrowUpRight size={10} />
    </button>
  );
}

/** Recursively renders any field value — primitive, array, or nested object — walking
 * every string leaf through id-resolution, so a foreign key buried inside an array
 * (Person.affiliations[].institutionId) resolves exactly the same way a top-level one
 * does (Project.themeId). No special-casing per entity needed. */
export function FieldValue({ value, onNavigate, depth = 0 }: { value: unknown; onNavigate: (entityId: string, id: string) => void; depth?: number }) {
  if (value === null) return <span className="font-mono text-[11px] text-zinc-600">null</span>;
  if (value === undefined) return <span className="font-mono text-[11px] text-zinc-600">—</span>;

  if (typeof value === "string") return <StringValue value={value} onNavigate={onNavigate} />;
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono text-[11px] text-zinc-100">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="font-mono text-[11px] text-zinc-600">[]</span>;
    return (
      <div className="flex flex-col gap-1" style={{ marginLeft: depth > 0 ? 12 : 0 }}>
        {value.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-zinc-600">[{i}]</span>
            <div className="min-w-0 flex-1">
              <FieldValue value={item} onNavigate={onNavigate} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="font-mono text-[11px] text-zinc-600">{"{}"}</span>;
    return (
      <div className="flex flex-col gap-1 rounded border border-zinc-800/70 bg-zinc-950/40 p-1.5" style={{ marginLeft: depth > 0 ? 12 : 0 }}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-zinc-500">{k}:</span>
            <div className="min-w-0 flex-1">
              <FieldValue value={v} onNavigate={onNavigate} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="font-mono text-[11px] text-zinc-100">{String(value)}</span>;
}
