import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import type { CanonicalPayload, CanonicalRun } from "../../types/canonical.types";
import { RunRecapCard } from "./RunRecapCard";
import { RetainingWallVariationDisclosure } from "./RetainingWallVariationDisclosure";

interface RetainingWallVariationSidebarProps {
  payload: CanonicalPayload;
  dispatch: React.Dispatch<any>;
  lastBom: any;
  onChangeFenceType: () => void;
}

export function RetainingWallVariationSidebar({
  payload,
  dispatch,
  lastBom,
  onChangeFenceType,
}: RetainingWallVariationSidebarProps) {
  const [openSettingsRunId, setOpenSettingsRunId] = useState<string | null>(null);

  // Auto-expand the first run settings by default
  useEffect(() => {
    if (payload.runs.length > 0 && !openSettingsRunId) {
      setOpenSettingsRunId(payload.runs[0].runId);
    }
  }, [payload.runs, openSettingsRunId]);

  const handleAddSection = (run: CanonicalRun) => {
    const nextSegments = [
      ...run.segments,
      {
        segmentId: crypto.randomUUID(),
        sortOrder: run.segments.length + 1,
        segmentKind: "panel" as const,
        segmentWidthMm: 2400, // standard default section
        targetHeightMm: Number(run.variables?.target_height_mm ?? payload.variables.target_height_mm ?? 600),
      },
    ];
    dispatch({
      type: "UPSERT_RUN",
      run: { ...run, segments: nextSegments },
    });
  };

  const handleUpdateJobVariables = (updatedVars: Record<string, any>) => {
    dispatch({
      type: "SET_PAYLOAD",
      payload: {
        ...payload,
        variables: {
          ...payload.variables,
          ...updatedVars,
        },
      },
    });
  };

  const handleUpdateRunVariables = (runId: string, updatedVars: Record<string, any>) => {
    const run = payload.runs.find((r) => r.runId === runId);
    if (!run) return;

    let nextSegments = run.segments;
    if (updatedVars.target_height_mm) {
      const height = Number(updatedVars.target_height_mm);
      nextSegments = run.segments.map((seg) => ({
        ...seg,
        targetHeightMm: height,
      }));
    }

    dispatch({
      type: "UPSERT_RUN",
      run: {
        ...run,
        variables: {
          ...run.variables,
          ...updatedVars,
        },
        segments: nextSegments,
      },
    });
  };

  return (
    <aside className="af-sidebar w-80 bg-brand-bg text-brand-text h-full border-r border-brand-border/60 flex flex-col shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-brand-border/40 shrink-0">
        <button
          type="button"
          onClick={onChangeFenceType}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-transparent px-3 py-1.5 text-xs font-bold text-brand-muted hover:border-[#DD6E1B] hover:text-[#DD6E1B] transition-colors"
          data-testid="change-fence-type"
        >
          <ChevronLeft size={14} />
          Change type
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:thin]">
        {payload.runs.length === 0 ? (
          <div className="text-center py-8 text-xs text-brand-muted font-medium">
            Draw a run on the map or click + Add run below.
          </div>
        ) : (
          payload.runs.map((run, idx) => {
            const isOpen = openSettingsRunId === run.runId;
            return (
              <div key={run.runId} className="space-y-2">
                <RunRecapCard
                  run={run}
                  runIdx={idx}
                  payload={payload}
                  onAddSection={() => handleAddSection(run)}
                  onAddGate={undefined} // Retaining walls do not support gates
                  onRemoveRun={() => dispatch({ type: "REMOVE_RUN", runId: run.runId })}
                  isOpen={isOpen}
                  onToggle={() => setOpenSettingsRunId(isOpen ? null : run.runId)}
                  bomResult={lastBom}
                />
                {isOpen && (
                  <RetainingWallVariationDisclosure
                    run={run}
                    payload={payload}
                    onUpdateJobVariables={handleUpdateJobVariables}
                    onUpdateRunVariables={(vars) => handleUpdateRunVariables(run.runId, vars)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
