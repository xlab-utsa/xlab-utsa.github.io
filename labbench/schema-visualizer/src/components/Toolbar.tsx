import { Search, KeyRound, Link2, Diamond } from "lucide-react";
import { Badge } from "./ui/Badge";

export function Toolbar({
  query,
  onQueryChange,
  showSecondary,
  onToggleSecondary,
  totalEntities,
  visibleEntities,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  showSecondary: boolean;
  onToggleSecondary: () => void;
  totalEntities: number;
  visibleEntities: number;
}) {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 flex w-[300px] flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
      <div>
        <h1 className="text-sm font-semibold text-zinc-50">X-Lab Schema Visualizer</h1>
        <p className="text-[11px] text-zinc-500">
          {visibleEntities}/{totalEntities} entities shown &middot; drag, scroll to zoom, click a card for details
        </p>
      </div>

      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search entities or fields..."
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pl-7 pr-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <label className="flex cursor-pointer items-center justify-between text-xs text-zinc-300">
        <span className="flex items-center gap-1.5">
          Show secondary entities <Badge variant="secondary">secondary</Badge>
        </span>
        <input
          type="checkbox"
          checked={showSecondary}
          onChange={onToggleSecondary}
          className="h-3.5 w-3.5 accent-indigo-500"
        />
      </label>

      <div className="border-t border-zinc-800 pt-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Legend</p>
        <div className="space-y-1 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <KeyRound size={11} className="text-zinc-500" /> primary key (id)
          </div>
          <div className="flex items-center gap-1.5">
            <Link2 size={11} className="text-amber-500" /> foreign key field
          </div>
          <div className="flex items-center gap-1.5">
            <Diamond size={7} fill="currentColor" className="text-zinc-500" /> required field
          </div>
          <div className="flex items-center gap-1.5">
            <Diamond size={7} fill="none" className="text-zinc-500" /> optional field
          </div>
        </div>
      </div>
    </div>
  );
}
