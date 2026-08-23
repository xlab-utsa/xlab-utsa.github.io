import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { getRecordsForEntity } from "../../lib/synthetic-data";
import { EntitySidebar } from "./EntitySidebar";
import { RecordTable } from "./RecordTable";
import { RecordDetail } from "./RecordDetail";
import { CoverageDashboard } from "./CoverageDashboard";

export function DataExplorerView() {
  const [entityId, setEntityId] = useState("person");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);

  const records = getRecordsForEntity(entityId);

  const handleSelectEntity = (id: string) => {
    setEntityId(id);
    setSelectedId(null);
  };

  const handleNavigate = (targetEntityId: string, targetId: string) => {
    setEntityId(targetEntityId);
    setSelectedId(targetId);
  };

  return (
    <div className="relative flex h-full w-full bg-[#0a0a0c] text-zinc-100">
      <EntitySidebar selectedEntityId={entityId} onSelect={handleSelectEntity} />

      <div className="flex min-w-0 flex-1">
        <div className="flex w-[420px] shrink-0 flex-col border-r border-zinc-800">
          <RecordTable entityId={entityId} records={records} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="min-w-0 flex-1">
          {selectedId ? (
            <RecordDetail entityId={entityId} id={selectedId} onNavigate={handleNavigate} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              Select a record to see its full fields and resolved relationships.
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowCoverage(true)}
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur hover:bg-zinc-900"
      >
        <LayoutGrid size={13} /> Coverage dashboard
      </button>

      {showCoverage && <CoverageDashboard onClose={() => setShowCoverage(false)} />}
    </div>
  );
}
