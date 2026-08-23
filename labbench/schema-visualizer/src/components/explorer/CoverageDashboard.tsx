import { X } from "lucide-react";
import { entities } from "../../lib/schema-graph";
import { getAllCoverage } from "../../lib/synthetic-data";

export function CoverageDashboard({ onClose }: { onClose: () => void }) {
  const coverage = getAllCoverage();
  const totalRecords = Object.values(coverage).reduce((sum, c) => sum + c.totalRecords, 0);

  return (
    <div className="absolute inset-4 z-10 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950/98 p-5 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">Coverage Dashboard</h2>
          <p className="text-xs text-zinc-500">
            {totalRecords} synthetic records across {Object.keys(coverage).length} entities &mdash; every tag below is a
            deliberately-covered use case, not a random sample.
          </p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {entities.map((entity) => {
          const c = coverage[entity.id];
          if (!c) return null;
          const sortedTags = Object.entries(c.tagCounts).sort((a, b) => b[1] - a[1]);
          return (
            <div key={entity.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">{entity.label}</h3>
                <span className="tabular-nums text-xs text-zinc-500">{c.totalRecords} records</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {sortedTags.map(([tag, count]) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-300"
                  >
                    {tag}
                    <span className="tabular-nums text-zinc-500">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
