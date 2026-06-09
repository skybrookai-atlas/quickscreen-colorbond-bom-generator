import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib";
import { useCalculatorV4 } from "../../../context/CalculatorContextV4";
import { BomActions } from "./BomActions";
import { BomHeader } from "./BomHeader";
import { BomTable } from "./BomTable";
import { Tabs } from "../shared/Tabs";
import { BomTotals } from "./BomTotals";
import { ExtraItemsPanel } from "./ExtraItemsPanel";
import { SuggestedAccessoriesPanel } from "./SuggestedAccessoriesPanel";
import { useBomViewModel, type BomViewLine } from "./useBomViewModel";

const GST_RATE = 0.1;

function totalsFromLines(lines: BomViewLine[]) {
  const pricedLines = lines.filter((l) => l.unitPrice !== null && l.unitPrice > 0);
  const tbcCount = lines.filter((l) => l.unitPrice === null).length;
  const subtotal = pricedLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const gst = subtotal * GST_RATE;
  return { subtotal, gst, grandTotal: subtotal + gst, tbcCount };
}

interface Props {
  isPending: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Right-column BOM panel. Layout (top to bottom):
 *   - BomHeader (gradient — fixed)
 *   - BomActions (Generate / CSV / PDF — fixed)
 *   - BomTabs (All / Run N / Gates — fixed)
 *   - Errors/warnings alert (when present — opens dialog — fixed)
 *   - Scroll area: BomTable (grouped by category)
 *   - SuggestedAccessoriesPanel (fixed footer — scroll BOM table on Add)
 *   - ExtraItemsPanel (fixed footer)
 *   - BomTotals (fixed footer)
 */
export function BomPanel({
  isPending,
  onGenerate,
  canGenerate,
  errors,
  warnings,
}: Props) {
  const { state, dispatch } = useCalculatorV4();
  const view = useBomViewModel();
  const [activeTab, setActiveTab] = useState("all");
  const bomTableScrollRef = useRef<HTMLDivElement>(null);

  const scrollBomTableToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = bomTableScrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    });
  }, []);

  const tabs = useMemo(() => {
    const list = [
      { id: "all", label: "All items", count: view.allLines.length },
    ];
    view.runResults.forEach((r, i) => {
      list.push({
        id: `run-${r.runId}`,
        label: `Run ${i + 1}`,
        count: r.items.length,
      });
    });
    list.push({
      id: "gates",
      label: "Gates",
      count: view.gateItems.length,
    });
    return list;
  }, [view.allLines.length, view.runResults, view.gateItems.length]);

  const visibleLines = useMemo(() => {
    if (activeTab === "all") return view.allLines;
    if (activeTab === "gates") return view.gateItems;
    if (activeTab.startsWith("run-")) {
      const runId = activeTab.slice(4);
      const run = view.runResults.find((r) => r.runId === runId);
      return run?.items ?? [];
    }
    return view.allLines;
  }, [activeTab, view]);

  const scopedTotals = useMemo(
    () => totalsFromLines(visibleLines),
    [visibleLines],
  );

  const totalsScopeLabel = useMemo(() => {
    if (activeTab === "all") return "Whole job";
    if (activeTab === "gates") return "Gates only";
    if (activeTab.startsWith("run-")) {
      const runId = activeTab.slice(4);
      const idx = view.runResults.findIndex((r) => r.runId === runId);
      return idx >= 0 ? `Run ${idx + 1} only` : "This run";
    }
    return "Whole job";
  }, [activeTab, view.runResults]);

  const headerSummary = useMemo(() => {
    const payload = state.payload;
    if (!payload) {
      return { primary: "No job loaded", secondary: undefined as string | undefined };
    }
    const runs = payload.runs.length;
    const segments = payload.runs.reduce((n, r) => n + r.segments.length, 0);
    const primary = `${runs} ${runs === 1 ? "run" : "runs"} · ${segments} segment${segments === 1 ? "" : "s"}`;

    if (!view.hasResult || view.runResults.length === 0) {
      return { primary, secondary: undefined as string | undefined };
    }

    const money = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    });
    const parts = view.runResults.map((r, i) => {
      const sub = r.items.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
      return `Run ${i + 1} ${money.format(sub)}`;
    });
    const secondary =
      parts.length <= 4 ? parts.join(" · ") : `${parts.slice(0, 3).join(" · ")} · +${parts.length - 3} more`;

    return { primary, secondary };
  }, [state.payload, view.hasResult, view.runResults]);

  return (
    <div className="rounded-[var(--brand-radius)] border border-brand-border bg-brand-card overflow-hidden flex flex-col h-full shadow-sm">
      <BomHeader
        summaryPrimary={headerSummary.primary}
        summarySecondary={headerSummary.secondary}
        grandTotal={scopedTotals.grandTotal}
        totalsScopeLabel={
          activeTab === "all" ? undefined : totalsScopeLabel
        }
        isPending={isPending}
        isStale={state.bomStale}
        hasBom={!!state.bomResult}
      />

      <BomActions
        view={view}
        jobName={state.jobName}
        quoteDetails={state.quoteDetails}
        isPending={isPending}
        onGenerate={onGenerate}
        canGenerate={canGenerate}
        errors={errors}
        warnings={warnings}
      />

      {state.bomResult && (
        <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
      )}

      {state.removedSkus.size > 0 && (
        <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 text-xs flex-shrink-0">
          <span className="text-amber-700 dark:text-amber-400 font-medium">
            {state.removedSkus.size} BOM{" "}
            {state.removedSkus.size === 1 ? "line" : "lines"} hidden from totals
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "RESTORE_ALL_BOM_LINES" })}
            className="text-amber-700 dark:text-amber-400 underline hover:opacity-90"
          >
            Restore all
          </button>
        </div>
      )}

      {/* Scrollable middle: table — dim when engine returned blocking errors (v3 parity). */}
      <div
        ref={bomTableScrollRef}
        className={cn(
          "flex-1 overflow-y-auto min-h-0 transition-opacity",
          errors.length > 0 && state.bomResult && "opacity-55",
        )}
      >
        <BomTable lines={visibleLines} />
      </div>

      {/* Fixed footers */}
      <SuggestedAccessoriesPanel onAddedSuggestion={scrollBomTableToBottom} />
      <ExtraItemsPanel />
      <BomTotals
        total={scopedTotals.subtotal}
        gst={scopedTotals.gst}
        grandTotal={scopedTotals.grandTotal}
        scopeLabel={activeTab === "all" ? undefined : totalsScopeLabel}
        tbcCount={scopedTotals.tbcCount}
      />
    </div>
  );
}
