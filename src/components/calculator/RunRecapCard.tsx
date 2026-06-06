import { ChevronDown, ChevronUp, Plus, Trash2, ShieldAlert } from "lucide-react";
import type { CanonicalRun, CanonicalPayload } from "../../types/canonical.types";
import { Button } from "../shared/Button";
import { ConfirmButton } from "../shared/ConfirmButton";

interface RunRecapCardProps {
  run: CanonicalRun;
  runIdx: number;
  payload: CanonicalPayload;
  onAddSection: () => void;
  onAddGate: () => void;
  onRemoveRun: () => void;
  isOpen: boolean;
  onToggle: () => void;
  bomResult: any;
}

export function RunRecapCard({
  run,
  runIdx,
  payload,
  onAddSection,
  onAddGate,
  onRemoveRun,
  isOpen,
  onToggle,
  bomResult,
}: RunRecapCardProps) {
  // Calculate total run length in metres
  const totalLengthMm = run.segments.reduce((sum, seg) => sum + (seg.segmentWidthMm ?? 0), 0);
  const lengthM = (totalLengthMm / 1000).toFixed(1);

  // Extract variables
  const runVars = {
    ...(payload.variables ?? {}),
    ...(run.variables ?? {}),
  };

  const style = runVars.paling_style === "lapped_capped" ? "Lapped & Capped" : "Butted";
  const material = runVars.timber_type === "hardwood" ? "Hardwood" : "CCA Pine H4";
  const height = runVars.target_height_mm ?? 1800;
  const color = runVars.colour ?? "Natural Timber";
  const railProfile = (runVars.rail_profile as string || "75x38").replace(/_/g, " ");
  const mounting = runVars.post_mounting === "core_drilled" ? "Core-drilled" : "In-ground";
  const maxSpacing = runVars.max_panel_width_mm ?? 2400;

  // Calculate posts count and gates count
  const gatesCount = run.segments.filter((s) => s.segmentKind === "gate_opening").length;
  
  // Try to find computed post count, otherwise fall back to estimate
  let postsCount = 0;
  if (bomResult?.computed?.[run.runId]) {
    const computedRun = bomResult.computed[run.runId];
    // Sum posts across segments
    postsCount = Object.values(computedRun).reduce((sum: number, seg: any) => {
      return sum + (seg.qty_post ?? 0);
    }, 0);
  }
  if (postsCount === 0) {
    // Basic estimate: panels + 1 + any gates
    const panels = Math.max(1, Math.ceil(totalLengthMm / Number(maxSpacing)));
    postsCount = panels + 1 + gatesCount;
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-bg/50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-black text-brand-text">Run {runIdx + 1}</span>
            <span className="font-mono text-lg font-bold text-[#DD6E1B]">{lengthM}m</span>
          </div>
          <div className="mt-1 text-xs text-brand-muted font-medium">
            Timber Paling · {style} · {material}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-border text-brand-muted hover:border-[#DD6E1B] hover:text-[#DD6E1B] transition-colors"
          aria-label={isOpen ? "Collapse settings" : "Expand settings"}
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* 2-column Spec Grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-brand-border/40 pt-3">
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Height</span>
          <span className="font-semibold text-brand-text">{height}mm</span>
        </div>
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Color</span>
          <span className="font-semibold text-brand-text capitalize">{String(color).replace(/-/g, " ")}</span>
        </div>
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Paling</span>
          <span className="font-semibold text-brand-text">100x16mm</span>
        </div>
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Rail</span>
          <span className="font-semibold text-brand-text capitalize">{railProfile}</span>
        </div>
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Post</span>
          <span className="font-semibold text-brand-text capitalize">{runVars.post_size || "100x75"} {runVars.timber_type === "hardwood" ? "HWD" : "Pine"}</span>
        </div>
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Mounting</span>
          <span className="font-semibold text-brand-text">{mounting}</span>
        </div>
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Max spacing</span>
          <span className="font-semibold text-brand-text">{maxSpacing}mm</span>
        </div>
        <div className="flex justify-between border-b border-brand-border/20 pb-1">
          <span className="text-brand-muted">Posts × Gates</span>
          <span className="font-semibold text-brand-text">
            {postsCount} Posts · {gatesCount} Gate{gatesCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Council Height Alert if Height > 1800mm */}
      {Number(height) > 1800 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-[11px] text-amber-500 border border-amber-500/20">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span>Council cap advisory: Fences exceeding 1800mm may require local planning approval.</span>
        </div>
      )}

      {/* Action Row */}
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-brand-border/40 pt-3">
        <Button onClick={onAddSection} icon={Plus} variant="ghost" size="small">
          Add section
        </Button>
        <Button onClick={onAddGate} icon={Plus} variant="ghost" size="small">
          Add gate
        </Button>
        <ConfirmButton
          onConfirm={onRemoveRun}
          confirmLabel={<><Trash2 size={14} /> Confirm remove</>}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-danger/30 px-2 py-1 text-[11px] font-semibold text-brand-danger transition-colors hover:bg-brand-danger/10"
        >
          <Trash2 size={14} />
          Remove
        </ConfirmButton>
      </div>
    </div>
  );
}
