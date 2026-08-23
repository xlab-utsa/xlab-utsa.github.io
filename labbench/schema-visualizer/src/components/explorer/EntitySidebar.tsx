import { entities } from "../../lib/schema-graph";
import { getRecordsForEntity } from "../../lib/synthetic-data";
import { Badge } from "../ui/Badge";

export function EntitySidebar({
  selectedEntityId,
  onSelect,
}: {
  selectedEntityId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-zinc-800 bg-zinc-950/60 p-2">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Entities</p>
      {entities.map((e) => {
        const count = getRecordsForEntity(e.id).length;
        const active = e.id === selectedEntityId;
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={`flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
              active ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              {e.label}
              <Badge variant={e.tier}>{e.tier}</Badge>
            </span>
            <span className="ml-2 shrink-0 tabular-nums text-xs text-zinc-500">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
