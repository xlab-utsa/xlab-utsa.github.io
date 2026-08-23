import { ArrowRight, ArrowLeft } from "lucide-react";
import { entities } from "../../lib/schema-graph";
import { getDisplayLabel, getRelatedRefs, getIncomingRefs, findRecordById } from "../../lib/synthetic-data";
import { FieldValue } from "./FieldValue";

function labelFor(entityId: string) {
  return entities.find((e) => e.id === entityId)?.label ?? entityId;
}

export function RecordDetail({
  entityId,
  id,
  onNavigate,
}: {
  entityId: string;
  id: string;
  onNavigate: (entityId: string, id: string) => void;
}) {
  const found = findRecordById(entityId, id);
  if (!found) {
    return <div className="p-4 text-xs text-zinc-500">Record not found.</div>;
  }
  const { record, covers } = found;
  const outgoing = getRelatedRefs(entityId, record);
  const incoming = getIncomingRefs(entityId, id);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-50">{getDisplayLabel(entityId, record)}</h2>
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
          {labelFor(entityId)} &middot; {id}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {covers.map((c) => (
            <span key={c} className="rounded-full border border-amber-700/40 bg-amber-900/20 px-1.5 py-0.5 text-[10px] text-amber-400">
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-3">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Fields</h3>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            {Object.entries(record).map(([key, value], i) => (
              <div key={key} className={`flex flex-col gap-0.5 border-b border-zinc-800/70 px-2.5 py-1.5 last:border-b-0 ${i % 2 === 0 ? "bg-zinc-900/60" : "bg-zinc-900/20"}`}>
                <span className="font-mono text-[11px] text-zinc-300">{key}</span>
                <FieldValue value={value} onNavigate={onNavigate} />
              </div>
            ))}
          </div>
        </div>

        {(outgoing.length > 0 || incoming.length > 0) && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Relationships</h3>
            <div className="space-y-1">
              {outgoing.map((ref, i) => {
                const target = findRecordById(ref.targetEntityId, ref.targetId);
                return (
                  <button
                    key={i}
                    onClick={() => onNavigate(ref.targetEntityId, ref.targetId)}
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-zinc-400 hover:bg-zinc-900"
                  >
                    <ArrowRight size={12} className="shrink-0 text-amber-500" />
                    <span className="font-mono text-zinc-500">{ref.fieldLabel}</span>
                    <span>&rarr;</span>
                    <span className="text-zinc-200">{labelFor(ref.targetEntityId)}:</span>
                    <span className="truncate text-zinc-100">{target ? getDisplayLabel(ref.targetEntityId, target.record) : ref.targetId}</span>
                  </button>
                );
              })}
              {incoming.map((ref, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(ref.fromEntityId, ref.fromRecordId)}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-zinc-400 hover:bg-zinc-900"
                >
                  <ArrowLeft size={12} className="shrink-0 text-emerald-500" />
                  <span className="text-zinc-200">{labelFor(ref.fromEntityId)}:</span>
                  <span className="truncate text-zinc-100">
                    {getDisplayLabel(ref.fromEntityId, findRecordById(ref.fromEntityId, ref.fromRecordId)?.record ?? {})}
                  </span>
                  <span className="text-zinc-600">via</span>
                  <span className="font-mono text-zinc-500">{ref.fieldLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
