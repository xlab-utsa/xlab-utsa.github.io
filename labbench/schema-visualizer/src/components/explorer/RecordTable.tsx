import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { SyntheticRecord } from "../../lib/synthetic-data";
import { getDisplayLabel, getQuickFacts } from "../../lib/synthetic-data";

export function RecordTable({
  entityId,
  records,
  selectedId,
  onSelect,
}: {
  entityId: string;
  records: SyntheticRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.covers.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return records.filter(({ record, covers }) => {
      if (tagFilter && !covers.includes(tagFilter)) return false;
      if (!q) return true;
      const label = getDisplayLabel(entityId, record).toLowerCase();
      const id = String(record.id).toLowerCase();
      return label.includes(q) || id.includes(q) || covers.some((c) => c.toLowerCase().includes(q));
    });
  }, [records, query, tagFilter, entityId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800 p-2">
        <div className="relative flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records..."
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pl-7 pr-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <select
          value={tagFilter ?? ""}
          onChange={(e) => setTagFilter(e.target.value || null)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All coverage tags ({allTags.length})</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-[11px] text-zinc-500">
          {filtered.length}/{records.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(({ record, covers }) => {
          const id = String(record.id);
          const active = id === selectedId;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`flex w-full flex-col gap-1 border-b border-zinc-800/60 px-3 py-2 text-left transition-colors ${
                active ? "bg-zinc-800" : "hover:bg-zinc-900/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-zinc-100">{getDisplayLabel(entityId, record)}</span>
                <span className="shrink-0 font-mono text-[10px] text-zinc-600">{id}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {getQuickFacts(entityId, record).map((f) => (
                  <span key={f} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {covers.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagFilter(c);
                    }}
                    className="cursor-pointer rounded-full border border-amber-700/40 bg-amber-900/20 px-1.5 py-0.5 text-[9px] text-amber-400 hover:bg-amber-900/40"
                  >
                    {c}
                  </span>
                ))}
                {covers.length > 4 && <span className="text-[9px] text-zinc-600">+{covers.length - 4} more</span>}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="p-4 text-center text-xs text-zinc-600">No records match.</p>}
      </div>
    </div>
  );
}
