import { useMemo } from "react";
import {
  useCalculatorV4,
  type AddedSuggestion,
  type ExtraItem,
} from "../../../context/CalculatorContextV4";
import type { BOMLineItem } from "../../../types/bom.types";

export interface BomViewLine {
  sku: string;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  category: string;
  /** Source of the line. */
  source: "engine" | "suggestion" | "extra";
  /** Used for the extras to map back to remove. */
  extraId?: string;
  /** Tag — runId for engine lines (segment lines may have a runId tag). */
  runId?: string;
  /** True if this line was added by the user from a suggestion. */
  isAddedSuggestion?: boolean;
}

/** Stable key for qty overrides (SKU or `extra:${id}`). */
export function bomLineQtyKey(
  line: Pick<BomViewLine, "source" | "sku" | "extraId">,
): string {
  if (line.source === "extra" && line.extraId) return `extra:${line.extraId}`;
  return line.sku || "";
}

export interface BomViewModel {
  /** Engine lines, post-removal-filter, plus added suggestions, plus extras. */
  allLines: BomViewLine[];
  /** Per-run grouping for the run tabs. */
  runResults: Array<{ runId: string; items: BomViewLine[] }>;
  /** Gate-only segment lines from the engine. */
  gateItems: BomViewLine[];
  total: number;
  gst: number;
  grandTotal: number;
  pricingTier: string;
  generatedAt: string;
  warnings: string[];
  errors: string[];
  /** True when there is a stored bomResult to display. */
  hasResult: boolean;
}

const GST_RATE = 0.1;

function applyQtyOverride(
  baseQty: number,
  baseLineTotal: number | null,
  unitPrice: number | null,
  lineKey: string,
  overrides: Record<string, number>,
): { quantity: number; lineTotal: number | null } {
  const o = overrides[lineKey];
  if (o === undefined)
    return { quantity: baseQty, lineTotal: baseLineTotal };
  const quantity = o;
  return { quantity, lineTotal: unitPrice !== null ? quantity * unitPrice : null };
}

function asLine(
  l: BOMLineItem & { runId?: string },
  source: BomViewLine["source"],
  overrides: Record<string, number>,
): BomViewLine {
  const lineKey = l.sku;
  const { quantity, lineTotal } = applyQtyOverride(
    l.quantity,
    l.lineTotal,
    l.unitPrice,
    lineKey,
    overrides,
  );
  return {
    sku: l.sku,
    name: l.name ?? '',
    description: l.description ?? l.name ?? '',
    unit: l.unit ?? "each",
    quantity,
    unitPrice: l.unitPrice,
    lineTotal,
    category: l.category ?? "accessory",
    source,
    runId: l.runId,
  };
}

export function useBomViewModel(): BomViewModel {
  const { state } = useCalculatorV4();
  const bom = state.bomResult;

  return useMemo(() => {
    const empty: BomViewModel = {
      allLines: [],
      runResults: [],
      gateItems: [],
      total: 0,
      gst: 0,
      grandTotal: 0,
      pricingTier: "tier1",
      generatedAt: "",
      warnings: [],
      errors: [],
      hasResult: false,
    };
    if (!bom) return empty;

    const rawLines = (bom.lines as Array<BOMLineItem & { runId?: string }>) ?? [];
    const runResults =
      (bom.runResults as Array<{
        runId: string;
        items: Array<BOMLineItem>;
      }>) ?? [];
    const gateItems =
      (bom.gateItems as Array<BOMLineItem & { runId?: string }>) ?? [];
    const warnings = (bom.warnings as string[]) ?? [];
    const errors = (bom.errors as string[]) ?? [];
    const pricingTier =
      (bom.pricingTier as string) ?? "tier1";
    const generatedAt =
      (bom.generatedAt as string) ?? new Date().toISOString();

    const overrides = state.qtyOverrides;

    const engineLines = rawLines
      .filter((l) => !state.removedSkus.has(l.sku))
      .map((l) => asLine(l, "engine", overrides));

    const suggestionLines: BomViewLine[] = state.addedSuggestions.map(
      (s: AddedSuggestion) => {
        const baseQty = s.qty;
        const baseTotal = s.qty * s.unitPrice;
        const { quantity, lineTotal } = applyQtyOverride(
          baseQty,
          baseTotal,
          s.unitPrice,
          s.sku,
          overrides,
        );
        return {
          sku: s.sku,
          name: s.name,
          description: s.name,
          unit: "each",
          quantity,
          unitPrice: s.unitPrice,
          lineTotal,
          category: "suggested",
          source: "suggestion" as const,
          isAddedSuggestion: true,
        };
      },
    );

    const extraLines: BomViewLine[] = state.extraItems.map(
      (e: ExtraItem) => {
        const lineKey = `extra:${e.id}`;
        const baseQty = e.qty;
        const baseTotal = e.qty * e.unitPrice;
        const { quantity, lineTotal } = applyQtyOverride(
          baseQty,
          baseTotal,
          e.unitPrice,
          lineKey,
          overrides,
        );
        return {
          sku: e.sku,
          name: e.description,
          description: e.description,
          unit: "each",
          quantity,
          unitPrice: e.unitPrice,
          lineTotal,
          category: "extra",
          source: "extra" as const,
          extraId: e.id,
        };
      },
    );

    const allLines = [...engineLines, ...suggestionLines, ...extraLines];

    const runResultsView = runResults.map((r) => ({
      runId: r.runId,
      items: r.items
        .filter((l) => !state.removedSkus.has(l.sku))
        .map((l) => asLine(l, "engine", overrides)),
    }));

    const gateItemsView = gateItems
      .filter((l) => !state.removedSkus.has(l.sku))
      .map((l) => asLine(l, "engine", overrides));

    const total = allLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
    const gst = total * GST_RATE;

    return {
      allLines,
      runResults: runResultsView,
      gateItems: gateItemsView,
      total,
      gst,
      grandTotal: total + gst,
      pricingTier,
      generatedAt,
      warnings,
      errors,
      hasResult: true,
    };
  }, [
    bom,
    state.removedSkus,
    state.addedSuggestions,
    state.extraItems,
    state.qtyOverrides,
  ]);
}

/**
 * Group lines into named buckets ready for table rendering.
 * Buckets are derived from line.category and remain in display order.
 */
export function groupByCategory(lines: BomViewLine[]) {
  const map = new Map<string, BomViewLine[]>();
  for (const l of lines) {
    const arr = map.get(l.category);
    if (arr) arr.push(l);
    else map.set(l.category, [l]);
  }
  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    items,
    subtotal: items.reduce((s, x) => s + (x.lineTotal ?? 0), 0),
  }));
}
