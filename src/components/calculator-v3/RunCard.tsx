import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useCalculator } from "../../context/CalculatorContext";
import type { CanonicalRun, CanonicalSegment } from "../../types/canonical.types";
import { defaultGateVariables } from "../../lib/gateOptionRules";
import {
  clampPostSpacing,
  maxPanelWidthForSystem,
} from "../../lib/productOptionRules";
import type { DerivedHeight } from "../../lib/heights";
import {
  GATE_SEGMENT_STUB_KEYS,
  patchSegmentVariables,
} from "../../lib/segmentTermination";
import { systemDisplayName } from "../../lib/systemDisplay";
import { SegmentRow } from "./SegmentRow";
import { colourName } from "./ColourPalette";
import { RunSettingsEditor } from "./RunSettingsEditor";
import { RUN_DEFAULTS_TEACHING_KEY } from "../../lib/uiCopy";
import { ConfirmButton } from "../shared/ConfirmButton";
import { InlineHeightEditor } from "./InlineHeightEditor";

const GATE_PRODUCT_CODE = "QS_GATE";
const RUN_SETTINGS_AUTO_COLLAPSE_MS = 60000;

const MOUNTING_LABELS: Record<string, string> = {
  in_ground: "Concreted in ground",
  base_plate: "Base plated",
  core_drill: "Core drilled",
};

interface Props {
  run: CanonicalRun;
  runIdx: number;
  autoOpenFirstSection?: boolean;
  onAutoOpenConsumed?: () => void;
}

const calcTotalLength = (run: CanonicalRun) =>
  run.segments.reduce((acc, seg) => {
    const qty =
      run.productCode === "BAYG" && seg.segmentKind !== "gate_opening"
        ? Math.max(1, Math.round(Number(seg.variables?.panel_quantity ?? 1)))
        : 1;
    return acc + (seg.segmentWidthMm ?? 0) * qty;
  }, 0);

function firstFenceSegment(run: CanonicalRun) {
  return run.segments.find((segment) => segment.segmentKind !== "gate_opening");
}

function runMasterVariables(
  run: CanonicalRun,
  jobVariables: Record<string, string | number | boolean> | undefined,
) {
  return {
    ...(jobVariables ?? {}),
    ...(run.variables ?? {}),
  };
}

export function RunCard({ run, runIdx, autoOpenFirstSection = false, onAutoOpenConsumed }: Props) {
  const { state, dispatch } = useCalculator();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runSettingsOpen, setRunSettingsOpen] = useState(false);
  const [teachingDismissed, setTeachingDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(RUN_DEFAULTS_TEACHING_KEY) === "true",
  );
  const runCollapseRef = useRef<number | null>(null);

  const runVariables = useMemo(
    () => runMasterVariables(run, state.payload?.variables),
    [run, state.payload?.variables],
  );
  const jobMax = clampPostSpacing(
    runVariables.max_panel_width_mm ?? maxPanelWidthForSystem(run.productCode),
    maxPanelWidthForSystem(run.productCode),
  );
  const firstSegment = firstFenceSegment(run);
  const runLengthM = (calcTotalLength(run) / 1000).toFixed(2);
  const runHeight = Number(runVariables.target_height_mm ?? firstSegment?.targetHeightMm ?? 1800);
  const slatSize = Number(runVariables.slat_size_mm ?? 65);
  const slatGap = Number(runVariables.slat_gap_mm ?? 5);
  const mounting = String(runVariables.mounting_method ?? runVariables.mounting_type ?? "in_ground").replace(/_/g, " ");
  const isBayg = run.productCode === "BAYG";

  useEffect(
    () => () => {
      if (runCollapseRef.current) window.clearTimeout(runCollapseRef.current);
    },
    [],
  );

  useEffect(() => {
    if (runCollapseRef.current) window.clearTimeout(runCollapseRef.current);
    if (!runSettingsOpen) return;
    runCollapseRef.current = window.setTimeout(() => setRunSettingsOpen(false), RUN_SETTINGS_AUTO_COLLAPSE_MS);
  }, [runSettingsOpen]);

  useEffect(() => {
    if (!autoOpenFirstSection || !firstSegment) return;
    setRunSettingsOpen(false);
    setExpandedId(firstSegment.segmentId);
    onAutoOpenConsumed?.();
  }, [autoOpenFirstSection, firstSegment, onAutoOpenConsumed]);

  function dismissRunDefaultsTeaching() {
    setTeachingDismissed(true);
    window.localStorage.setItem(RUN_DEFAULTS_TEACHING_KEY, "true");
  }

  function keepRunSettingsOpen() {
    if (runCollapseRef.current) window.clearTimeout(runCollapseRef.current);
  }

  function scheduleRunSettingsCollapse() {
    if (runCollapseRef.current) window.clearTimeout(runCollapseRef.current);
    runCollapseRef.current = window.setTimeout(() => setRunSettingsOpen(false), RUN_SETTINGS_AUTO_COLLAPSE_MS);
  }

  function resetRunSettingsCollapse() {
    if (!runSettingsOpen) return;
    scheduleRunSettingsCollapse();
  }

  function upsertSegment(segment: CanonicalSegment) {
    dispatch({ type: "UPSERT_SEGMENT", runId: run.runId, segment });
  }

  function segmentInheritsRunHeight(segment: CanonicalSegment) {
    const segmentHeight = Number(segment.targetHeightMm ?? runHeight);
    const variables = segment.variables ?? {};
    const hasHeightOverride =
      variables.target_height_mm != null ||
      variables.slat_count != null ||
      variables[GATE_SEGMENT_STUB_KEYS.gateHeightMm] != null;
    return !hasHeightOverride || segmentHeight === runHeight;
  }

  function updateRunHeight(heightMm: number, entry?: DerivedHeight) {
    const nextVariables: CanonicalRun["variables"] = {
      ...(run.variables ?? {}),
      target_height_mm: heightMm,
    };
    if (entry) nextVariables.slat_count = entry.N;
    else delete nextVariables.slat_count;

    dispatch({
      type: "UPSERT_RUN",
      run: {
        ...run,
        variables: nextVariables,
        segments: run.segments.map((segment) => {
          if (!segmentInheritsRunHeight(segment)) return segment;
          const cleared = patchSegmentVariables(segment, {
            target_height_mm: null,
            slat_count: null,
            [GATE_SEGMENT_STUB_KEYS.gateHeightMm]: null,
          });
          return {
            ...cleared,
            targetHeightMm: heightMm,
          };
        }),
      },
    });
  }

  function addFenceSegment() {
    upsertSegment({
      segmentId: crypto.randomUUID(),
      sortOrder: run.segments.length + 1,
      segmentKind: "panel",
      segmentWidthMm: 0,
      targetHeightMm: Number(runVariables.target_height_mm ?? 1800),
      variables: isBayg ? { panel_quantity: 1 } : undefined,
    });
  }

  function addGateSegment() {
    const masterVariables = runMasterVariables(run, state.payload?.variables);
    const targetHeight = Number(masterVariables.target_height_mm ?? 1800);
    const segmentId = crypto.randomUUID();
    upsertSegment({
      segmentId,
      sortOrder: run.segments.length + 1,
      segmentKind: "gate_opening",
      segmentWidthMm: 900,
      targetHeightMm: targetHeight,
      gateProductCode: GATE_PRODUCT_CODE,
      variables: defaultGateVariables({ ...masterVariables, productCode: run.productCode }, targetHeight),
    });
    setExpandedId(segmentId);
  }

  const gateCount = run.segments.filter((s) => s.segmentKind === "gate_opening").length;
  const sectionCount = run.segments.filter((s) => s.segmentKind !== "gate_opening").length;
  const postCount = isBayg ? 0 : (sectionCount + gateCount + 1 + (run.corners?.length ?? 0));

  const specItems = useMemo(() => {
    const items = [];
    
    // Target Height
    items.push({
      label: "Height",
      value: (
        <InlineHeightEditor
          productCode={run.productCode}
          variables={runVariables}
          valueMm={runHeight}
          ariaLabel={`Run ${runIdx + 1} default height`}
          onChange={updateRunHeight}
        />
      ),
      mono: true,
    });

    if (run.productCode === "AF_TIMBER_PALING") {
      items.push({
        label: "Timber",
        value: runVariables.timber_type === "hardwood" ? "Hardwood" : "Treated Pine",
      });
      items.push({
        label: "Style",
        value: runVariables.paling_style === "lapped_capped" ? "Lapped & Capped" : "Butted",
      });
      items.push({
        label: "Rail",
        value: runVariables.rail_profile ? String(runVariables.rail_profile) : "75x38",
      });
      items.push({
        label: "Post size",
        value: runVariables.post_size ? String(runVariables.post_size) : "100x75",
      });
    } else if (run.productCode === "AF_COLORBOND") {
      items.push({
        label: "Colour",
        value: colourName(runVariables.colour || runVariables.colour_code),
      });
      items.push({
        label: "Mounting",
        value: isBayg ? "Not required" : (MOUNTING_LABELS[mounting] ?? mounting),
      });
    } else {
      // Fallback for aluminum slat systems (QSHS, VS, XPL, BAYG)
      items.push({
        label: "Colour",
        value: colourName(runVariables.colour_code),
      });
      items.push({
        label: run.productCode === "DF_CCA_PAL" ? "Paling" : "Slat size",
        value: run.productCode === "DF_CCA_PAL" ? (runVariables.paling_type ? String(runVariables.paling_type) : "CCA Pine") : `${slatSize}mm`,
      });
      items.push({
        label: run.productCode === "DF_CCA_PAL" ? "Rail" : "Gap size",
        value: run.productCode === "DF_CCA_PAL" ? (runVariables.rail_type ? String(runVariables.rail_type) : "3 Rails") : `${slatGap}mm`,
      });
    }

    // Common items
    if (run.productCode !== "AF_TIMBER_PALING" && run.productCode !== "AF_COLORBOND") {
      items.push({
        label: "Mounting",
        value: isBayg ? "Not required" : (MOUNTING_LABELS[mounting] ?? mounting),
      });
    }
    
    items.push({
      label: "Max spacing",
      value: `${jobMax}mm`,
    });

    items.push({
      label: isBayg ? "Panels" : "Posts × Gates",
      value: isBayg ? "0" : `${postCount} × ${gateCount}`,
    });

    return items;
  }, [run.productCode, runVariables, runHeight, slatSize, slatGap, mounting, jobMax, postCount, gateCount, isBayg, runIdx]);

  return (
    <div className="space-y-2">
      {runIdx === 0 && (
        <button
          type="button"
          onClick={() => {
            if (state.payload) {
              dispatch({
                type: "SET_PAYLOAD",
                payload: {
                  ...state.payload,
                  runs: [],
                  productCode: "",
                },
              });
            }
          }}
          className="text-xs font-semibold text-[#DD6E1B] hover:text-[#c96215] transition-colors mb-2 inline-flex items-center gap-1"
        >
          &larr; Change fence type
        </button>
      )}

      <div className="rounded-xl border border-[#E9E5DD] bg-white p-3.5 shadow-sm space-y-3">
        {/* Card Header */}
        <div className="flex items-baseline justify-between border-b border-[#E9E5DD] pb-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[15px] font-bold text-[#11161D]">
              {run.productCode === "AF_TIMBER_PALING"
                ? `Timber Run ${runIdx + 1}`
                : run.productCode === "AF_COLORBOND"
                  ? `Colorbond Run ${runIdx + 1}`
                  : run.productCode === "AF_RETAINING_WALL"
                    ? `Wall Run ${runIdx + 1}`
                    : run.productCode === "AF_PERMASTEEL"
                      ? `Permasteel Run ${runIdx + 1}`
                      : run.productCode === "AF_CHAINWIRE_SECURITY"
                        ? `Chainwire Run ${runIdx + 1}`
                        : run.productCode === "AF_TIMBER_SLAT_SCREEN"
                          ? `Slat Run ${runIdx + 1}`
                          : `Run ${runIdx + 1}`}
            </span>
            <span className="text-[12px] text-[#6E7681] truncate">({systemDisplayName(run.productCode)})</span>
          </div>
          <span className="af-sidebar-mono text-[#DD6E1B] font-semibold text-[13.5px] shrink-0">
            {runLengthM}m
          </span>
        </div>

        {/* Spec Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#6E7681]">
          {specItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center gap-1">
              <span className="font-medium">{item.label}:</span>
              <span className={`text-[#11161D] font-semibold truncate max-w-[140px] ${item.mono ? "af-sidebar-mono" : ""}`} title={typeof item.value === 'string' ? item.value : undefined}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Run Settings Toggle Button */}
        <div
          className="flex justify-end pt-1"
          onMouseEnter={keepRunSettingsOpen}
          onMouseLeave={scheduleRunSettingsCollapse}
        >
          <button
            type="button"
            onClick={() =>
              setRunSettingsOpen((value) => {
                const next = !value;
                if (next) setExpandedId(null);
                return next;
              })
            }
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              runSettingsOpen
                ? "border-[#DD6E1B] bg-[#FCF1E6] text-[#DD6E1B] shadow-sm font-bold"
                : "border-[#E9E5DD] bg-white text-[#6E7681] hover:border-[#DD6E1B]/50 hover:text-[#DD6E1B]"
            }`}
            aria-label={runSettingsOpen ? "Collapse run settings" : "Open run settings"}
            title={runSettingsOpen ? "Collapse run settings" : "Run settings"}
          >
            <span>Run Settings</span>
            {runSettingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {runSettingsOpen && (
          <div
            onPointerDown={resetRunSettingsCollapse}
            onKeyDown={resetRunSettingsCollapse}
            onScroll={resetRunSettingsCollapse}
            onInput={resetRunSettingsCollapse}
            onChange={resetRunSettingsCollapse}
            className="border-t border-[#E9E5DD] pt-3"
          >
            <RunSettingsEditor run={run} onCollapse={() => setRunSettingsOpen(false)} />
          </div>
        )}

        {!runSettingsOpen && (
          <div className="border-t border-[#E9E5DD] pt-3 space-y-3">
            {run.segments.length === 0 && (
              <p className="text-xs italic text-[#6E7681]">
                No sections yet. Draw on canvas or add manually.
              </p>
            )}

            <div className="space-y-2">
              {run.segments
                .filter((segment) => segment.segmentKind !== "gate_opening")
                .map((seg, segIdx) => (
                  <SegmentRow
                    key={seg.segmentId}
                    runId={run.runId}
                    seg={seg}
                    segIdx={segIdx}
                    runIdx={runIdx}
                    displayLabel={`R${runIdx + 1}S${segIdx + 1}`}
                    open={expandedId === seg.segmentId}
                    showRunDefaultsTeaching={
                      expandedId === seg.segmentId &&
                      seg.segmentId === firstSegment?.segmentId &&
                      !teachingDismissed &&
                      !state.bomResult
                    }
                    onDismissRunDefaultsTeaching={dismissRunDefaultsTeaching}
                    onToggle={() =>
                      setExpandedId((id) => {
                        const next = id === seg.segmentId ? null : seg.segmentId;
                        if (id === seg.segmentId && seg.segmentId === firstSegment?.segmentId) {
                          dismissRunDefaultsTeaching();
                        }
                        return next;
                      })
                    }
                  />
                ))}
              {!isBayg && run.segments.some((segment) => segment.segmentKind === "gate_opening") && (
                <div className="pt-2 border-t border-[#E9E5DD]/60">
                  <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#6E7681]">
                    <CheckCircle2 size={16} />
                    Gates
                  </p>
                  <div className="space-y-2">
                    {run.segments
                      .filter((segment) => segment.segmentKind === "gate_opening")
                      .map((seg, gateIdx) => (
                        <SegmentRow
                          key={seg.segmentId}
                          runId={run.runId}
                          seg={seg}
                          segIdx={gateIdx}
                          runIdx={runIdx}
                          displayLabel={`R${runIdx + 1}G${gateIdx + 1}`}
                          open={expandedId === seg.segmentId}
                          onToggle={() =>
                            setExpandedId((id) => (id === seg.segmentId ? null : seg.segmentId))
                          }
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9E5DD]/60 pt-2">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={addFenceSegment}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#DD6E1B] hover:text-[#c96215] transition-colors px-2 py-1.5 rounded hover:bg-[#FCF1E6]/50"
                >
                  <Plus size={14} />
                  {run.productCode === "AF_TIMBER_PALING"
                    ? "Add Timber Section"
                    : run.productCode === "AF_COLORBOND"
                      ? "Add Colorbond Panel"
                      : run.productCode === "AF_RETAINING_WALL"
                        ? "Add Wall Section"
                        : run.productCode === "AF_PERMASTEEL"
                          ? "Add Permasteel Panel"
                          : run.productCode === "AF_CHAINWIRE_SECURITY"
                            ? "Add Chainwire Section"
                            : run.productCode === "AF_TIMBER_SLAT_SCREEN"
                              ? "Add Slat Section"
                              : isBayg
                                ? "Add panel"
                                : "Add Section"}
                </button>
                {!isBayg && (
                  <button
                    type="button"
                    onClick={addGateSegment}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#DD6E1B] hover:text-[#c96215] transition-colors px-2 py-1.5 rounded hover:bg-[#FCF1E6]/50"
                  >
                    <Plus size={14} />
                    {run.productCode === "AF_TIMBER_PALING"
                      ? "Add Timber Gate"
                      : run.productCode === "AF_COLORBOND"
                        ? "Add Colorbond Gate"
                        : "Add Gate"}
                  </button>
                )}
              </div>
              <ConfirmButton
                onConfirm={() => dispatch({ type: "REMOVE_RUN", runId: run.runId })}
                confirmLabel="Confirm Remove"
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors px-2 py-1.5 rounded hover:bg-red-50"
              >
                <Trash2 size={14} />
                Remove Run
              </ConfirmButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
