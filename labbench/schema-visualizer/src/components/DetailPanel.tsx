import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { entities, edges, type EntityDef } from "../lib/schema-graph";
import { Badge } from "./ui/Badge";

export function DetailPanel({
  entity,
  count,
  onClose,
}: {
  entity: EntityDef;
  count: number | null;
  onClose: () => void;
}) {
  const outgoing = edges.filter((e) => e.source === entity.id);
  const incoming = edges.filter((e) => e.target === entity.id);
  const byId = (id: string) => entities.find((e) => e.id === id);

  return (
    <div className="pointer-events-auto absolute right-4 top-4 bottom-4 w-[380px] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950/95 shadow-2xl backdrop-blur">
      <div className="sticky top-0 flex items-start justify-between gap-2 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-50">{entity.label}</h2>
            <Badge variant={entity.tier}>{entity.tier}</Badge>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{entity.filePath}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div>
          <p className="text-sm text-zinc-300">{entity.summary}</p>
          {count !== null && (
            <p className="mt-1 text-xs text-zinc-500">
              <span className="tabular-nums text-zinc-300">{count}</span> record{count === 1 ? "" : "s"} currently in content/
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Why it's shaped this way</h3>
          <p className="text-xs leading-relaxed text-zinc-400">{entity.rationale}</p>
        </div>

        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Fields ({entity.fields.length})
          </h3>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            {entity.fields.map((f, i) => (
              <div
                key={f.name}
                className={`flex flex-col gap-0.5 border-b border-zinc-800/70 px-2.5 py-1.5 last:border-b-0 ${
                  i % 2 === 0 ? "bg-zinc-900/60" : "bg-zinc-900/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-100">{f.name}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">{f.required ? "required" : "optional"}</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500">{f.type}</span>
                {f.note && <span className="text-[10px] italic text-zinc-500">{f.note}</span>}
              </div>
            ))}
          </div>
        </div>

        {(outgoing.length > 0 || incoming.length > 0) && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Relationships</h3>
            <div className="space-y-1">
              {outgoing.map((e) => (
                <div key={e.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <ArrowRight size={12} className="shrink-0 text-amber-500" />
                  <span className="font-mono text-zinc-300">{e.sourceField}</span>
                  <span>&rarr;</span>
                  <span className="text-zinc-200">{byId(e.target)?.label ?? e.target}</span>
                </div>
              ))}
              {incoming.map((e) => (
                <div key={e.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <ArrowLeft size={12} className="shrink-0 text-emerald-500" />
                  <span className="text-zinc-200">{byId(e.source)?.label ?? e.source}</span>
                  <span>via</span>
                  <span className="font-mono text-zinc-300">{e.sourceField}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
