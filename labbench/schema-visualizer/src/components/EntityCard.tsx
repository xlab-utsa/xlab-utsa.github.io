import { Handle, Position, type NodeProps } from "@xyflow/react";
import { KeyRound, Link2, Diamond } from "lucide-react";
import type { EntityDef } from "../lib/schema-graph";
import { HEADER_HEIGHT, ROW_HEIGHT, CARD_WIDTH, ID_FIELD_INDEX, rowHandleId } from "../lib/schema-graph";
import { Badge } from "./ui/Badge";

export interface EntityNodeData extends Record<string, unknown> {
  entity: EntityDef;
  count: number | null;
  dimmed: boolean;
  matched: boolean;
}

const headerByTier = {
  core: "bg-emerald-800/70 border-emerald-600/40",
  secondary: "bg-indigo-900/60 border-indigo-600/40",
};

export function EntityCard({ data, selected }: NodeProps & { data: EntityNodeData }) {
  const { entity, count, dimmed, matched } = data;

  return (
    <div
      style={{ width: CARD_WIDTH }}
      className={[
        "rounded-lg border shadow-lg transition-opacity duration-150",
        "bg-zinc-900/95 backdrop-blur-sm",
        selected ? "border-white/60 ring-1 ring-white/30" : "border-zinc-700",
        dimmed ? "opacity-25" : "opacity-100",
        matched ? "ring-2 ring-amber-400" : "",
      ].join(" ")}
    >
      {/* header */}
      <div
        style={{ height: HEADER_HEIGHT }}
        className={`flex items-center justify-between rounded-t-lg border-b px-3 ${headerByTier[entity.tier]}`}
      >
        <span className="truncate text-sm font-semibold text-zinc-50">{entity.label}</span>
        <div className="flex items-center gap-1.5">
          {count !== null && (
            <span className="text-[10px] tabular-nums text-zinc-300/80">{count} rec</span>
          )}
          <Badge variant={entity.tier}>{entity.tier}</Badge>
        </div>
      </div>

      {/* field rows */}
      <div>
        {entity.fields.map((field, index) => {
          const isId = index === ID_FIELD_INDEX;
          return (
            <div
              key={field.name}
              style={{ height: ROW_HEIGHT }}
              className={[
                "relative flex items-center gap-1.5 border-b border-zinc-800/70 px-3 last:rounded-b-lg last:border-b-0",
                index % 2 === 0 ? "bg-zinc-900/95" : "bg-zinc-900/60",
              ].join(" ")}
              title={field.note}
            >
              {isId && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={rowHandleId(entity.id, index, "target")}
                  className="!bg-emerald-400"
                />
              )}
              {field.fk && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={rowHandleId(entity.id, index, "source")}
                  className="!bg-amber-400"
                />
              )}

              <span className="shrink-0 text-zinc-500">
                {isId ? (
                  <KeyRound size={11} />
                ) : field.fk ? (
                  <Link2 size={11} className="text-amber-500" />
                ) : (
                  <Diamond size={7} fill={field.required ? "currentColor" : "none"} />
                )}
              </span>

              <span className="truncate font-mono text-[11px] text-zinc-200">{field.name}</span>
              <span className="ml-auto truncate font-mono text-[10px] text-zinc-500">{field.type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
