import { useEffect, useState } from "react";
import pluralize from "pluralize";
import type { CalculatorBOMResult, BOMLineItem } from "../../types/bom.types";
import { localPriceBreaks } from "../../lib/localPriceBreaks";
import { priceForSku } from "../../lib/localBomCalculator";
import { cataloguePageForSku, CATALOGUE_PDF_URL } from "../../lib/cataloguePages";
import { cartonHintForLine } from "../../lib/cartonQuantities";
import { bulkBuyVariantForSku } from "../../lib/bulkBuyVariants";
import {
  PRICE_SOURCE_LABEL,
  PRICE_SOURCE_VERIFIED_DATE,
} from "../../lib/pricingMetadata";
import { BOM_CATEGORY_ORDER } from "../../lib/bomMetadata";
import {
  gateDiagramNumbersForSku,
  gateDiagramTitle,
  type GateDiagramNumber,
} from "../../lib/gateDiagramMapping";
import { setGateDiagramHover, useGateDiagramHover } from "../../lib/gateDiagramHover";
import { InstallVideoQR } from "../calculator-v3/InstallVideoQR";
import type { InstallVideoKey } from "../../lib/installVideos";
import { BomCutList } from "./BomCutList";
import { NumberedBadge } from "./NumberedBadge";
import { stripParentheticalDispatchCode } from "../../lib/displayText";

function getBunningsMockSuggestion(item: { description: string }) {
  const desc = item.description.toLowerCase();
  if (desc.includes("post")) {
    return { sku: "BUN-POST-90", description: "Treated Pine Post 90x90mm 3.0m H4", unitPrice: 28.50 };
  }
  if (desc.includes("rail")) {
    return { sku: "BUN-RAIL-70", description: "Treated Pine Rail 70x45mm 4.8m H3", unitPrice: 18.20 };
  }
  if (desc.includes("hinge")) {
    return { sku: "BUN-HINGE-HD", description: "Zenith Heavy Duty Gate Hinge 150mm Galvanised (Pair)", unitPrice: 14.95 };
  }
  if (desc.includes("screw") || desc.includes("fastener")) {
    return { sku: "BUN-SCREW-T17", description: "Buildex 14-10 x 75mm Bugle Batten Screws - 100 Pack", unitPrice: 24.60 };
  }
  return { sku: "BUN-HDW-GEN", description: "Zenith General Utility Hardware Accessory", unitPrice: 8.90 };
}

interface BOMResultTabsProps {
  result: CalculatorBOMResult;
  editable?: boolean;
  onQuantityChange?: (item: BOMLineItem, quantity: number) => void;
  onRemoveLine?: (item: BOMLineItem) => void;
  onSwitchEconomyToStandard?: (item: BOMLineItem) => void;
  onAssignCustomSku?: (item: BOMLineItem, override: { sku: string; description: string; unitPrice: number }) => void;
  onActiveSummaryChange?: (summary: {
    label: string;
    subtotal: number;
    gst: number;
    grandTotal: number;
  }) => void;
  customerMode?: boolean;
  hideBunnings?: boolean;
}

const CATEGORY_ORDER = BOM_CATEGORY_ORDER;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);


function nextBreakHint(item: BOMLineItem) {
  if (item.sku.startsWith("XP-6500-E65") && item.unit === "pack") return null;
  const breaks = (localPriceBreaks as Record<string, readonly number[] | undefined>)[
    item.sku
  ];
  const nextBreak = breaks?.find((qty) => qty > item.quantity);
  if (!nextBreak) return null;

  const nextUnitPrice = priceForSku(item.sku, nextBreak);
  if (item.unitPrice === null || nextUnitPrice <= 0 || item.unitPrice <= 0 || nextUnitPrice >= item.unitPrice) {
    return {
      more: nextBreak - item.quantity,
      savingPct: null as number | null,
    };
  }

  return {
    more: nextBreak - item.quantity,
    savingPct: Math.round(((item.unitPrice - nextUnitPrice) / item.unitPrice) * 100),
  };
}

function unitLabel(item: BOMLineItem) {
  return item.sku.startsWith("XP-6500-E65") && item.unit === "pack"
    ? "pack of 96"
    : item.unit;
}

function sortItems(items: BOMLineItem[]): BOMLineItem[] {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(
      a.category as (typeof CATEGORY_ORDER)[number],
    );
    const bi = CATEGORY_ORDER.indexOf(
      b.category as (typeof CATEGORY_ORDER)[number],
    );
    const category = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (category !== 0) return category;
    const subCategory = String(a.subCategory ?? "").localeCompare(String(b.subCategory ?? ""));
    if (subCategory !== 0) return subCategory;
    const priority = (a.sortPriority ?? 50) - (b.sortPriority ?? 50);
    if (priority !== 0) return priority;
    return a.sku.localeCompare(b.sku);
  });
}

function groupByCategory(items: BOMLineItem[]): [string, BOMLineItem[]][] {
  const map = new Map<string, BOMLineItem[]>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }
  return Array.from(map.entries());
}

function orderCompanions(items: BOMLineItem[]): BOMLineItem[] {
  const baseItems = [...items].sort((a, b) => {
    const subCategory = String(a.subCategory ?? "").localeCompare(String(b.subCategory ?? ""));
    if (subCategory !== 0) return subCategory;
    const priority = (a.sortPriority ?? 50) - (b.sortPriority ?? 50);
    if (priority !== 0) return priority;
    return a.sku.localeCompare(b.sku);
  });
  const companions = new Map<string, BOMLineItem[]>();
  const roots: BOMLineItem[] = [];
  for (const item of baseItems) {
    if (item.companionOf && baseItems.some((candidate) => item.sku !== candidate.sku && candidate.sku.startsWith(item.companionOf!))) {
      const parentSku = baseItems.find((candidate) => item.sku !== candidate.sku && candidate.sku.startsWith(item.companionOf!))?.sku;
      if (parentSku) {
        const list = companions.get(parentSku) ?? [];
        list.push(item);
        companions.set(parentSku, list);
        continue;
      }
    }
    roots.push(item);
  }
  return roots.flatMap((item) => [item, ...(companions.get(item.sku) ?? [])]);
}

function sourceBreakdown(item: BOMLineItem) {
  const sources = item.sources ?? [];
  if (sources.length === 0) return "";
  return sources
    .map((source) => `${source.scopeLabel}: ${source.qty}`)
    .join(" · ");
}

function humanizeCategory(value: string) {
  return pluralize(value.replace(/_/g, " "));
}

function humanizeSubCategory(value: string | undefined) {
  return value ? value.replace(/_/g, " ") : "Items";
}

function PageChip({ sku }: { sku: string }) {
  const page = cataloguePageForSku(sku);
  if (!page) return null;
  const className =
    "inline-flex rounded-full border border-brand-border bg-brand-bg px-1.5 py-0.5 text-[10px] font-extrabold text-brand-muted hover:border-brand-primary hover:text-brand-primary print:hidden";
  if (CATALOGUE_PDF_URL) {
    return (
      <a
        href={`${CATALOGUE_PDF_URL}#page=${page}`}
        target="_blank"
        rel="noreferrer"
        className={className}
        title={`Open catalogue page ${page}`}
      >
        p.{page}
      </a>
    );
  }
  return (
    <span className={className} title={`Catalogue page ${page}`}>
      p.{page}
    </span>
  );
}

function installVideoKeysForItems(items: BOMLineItem[]): InstallVideoKey[] {
  const keys = new Set<InstallVideoKey>();
  if (items.some((item) => item.productCode === "QSHS")) keys.add("QSHS");
  if (items.some((item) => item.productCode === "VS")) keys.add("VS");
  if (items.some((item) => item.sku.startsWith("XPSG-") || item.sku.startsWith("QSG-S-"))) {
    keys.add("QS_GATE_SLIDE");
  }
  if (items.some((item) => item.sku.startsWith("QSG-") && !item.sku.startsWith("QSG-S-"))) {
    keys.add("QS_GATE_PED");
  }
  return [...keys];
}

function isGateDiagramLine(item: BOMLineItem) {
  return (
    item.productCode === "QS_GATE" ||
    item.category === "gate" ||
    item.category === "gate_components" ||
    item.category === "gate_hardware" ||
    item.sources?.some((source) => source.scopeKind === "gate") === true
  );
}

function GateDiagramBadges({ numbers }: { numbers: GateDiagramNumber[] }) {
  if (numbers.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 print:hidden" aria-label="Gate diagram references">
      {numbers.map((number) => (
        <button
          key={number}
          type="button"
          onMouseEnter={() => setGateDiagramHover(number)}
          onMouseLeave={() => setGateDiagramHover(null)}
          onFocus={() => setGateDiagramHover(number)}
          onBlur={() => setGateDiagramHover(null)}
          className="focus:outline-none"
          title={gateDiagramTitle(number)}
        >
          <NumberedBadge interactive>{number}</NumberedBadge>
        </button>
      ))}
    </span>
  );
}

function BOMTable({
  items,
  editable,
  onQuantityChange,
  onRemoveLine,
  onSwitchEconomyToStandard,
  onAssignCustomSku,
  customerMode,
  bunningsEnabled,
}: {
  items: BOMLineItem[];
  editable?: boolean;
  onQuantityChange?: (item: BOMLineItem, quantity: number) => void;
  onRemoveLine?: (item: BOMLineItem) => void;
  onSwitchEconomyToStandard?: (item: BOMLineItem) => void;
  onAssignCustomSku?: (item: BOMLineItem, override: { sku: string; description: string; unitPrice: number }) => void;
  customerMode?: boolean;
  bunningsEnabled?: boolean;
}) {
  const sorted = sortItems(items);
  const groups = groupByCategory(sorted);
  const hoveredGateDiagramNumber = useGateDiagramHover();

  if (items.length === 0) {
    return (
      <p className="text-sm text-brand-muted py-6 text-center">
        No items in this section.
      </p>
    );
  }

  return (
    <>
    <BOMMobileCards
      groups={groups}
      editable={editable}
      onQuantityChange={onQuantityChange}
      onRemoveLine={onRemoveLine}
      onSwitchEconomyToStandard={onSwitchEconomyToStandard}
      onAssignCustomSku={onAssignCustomSku}
      hoveredGateDiagramNumber={hoveredGateDiagramNumber}
      customerMode={customerMode}
      bunningsEnabled={bunningsEnabled}
    />
    <div className="hidden overflow-x-auto md:block" data-testid="bom-desktop-table">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-brand-bg/80">
            <th className="py-2.5 px-3 text-xs font-semibold text-brand-muted uppercase tracking-wider whitespace-nowrap">
              Code
            </th>
            <th className="py-2.5 px-3 text-xs font-semibold text-brand-muted uppercase tracking-wider">
              Description
            </th>
            <th className="hidden py-2.5 px-3 text-xs font-semibold text-brand-muted uppercase tracking-wider text-center sm:table-cell">
              Unit
            </th>
            <th className="py-2.5 px-3 text-xs font-semibold text-brand-muted uppercase tracking-wider text-right">
              Qty
            </th>
            {!customerMode && (
              <>
                <th className="hidden py-2.5 px-3 text-xs font-semibold text-brand-muted uppercase tracking-wider text-right whitespace-nowrap sm:table-cell">
                  Unit $
                </th>
                <th className="py-2.5 px-3 text-xs font-semibold text-brand-muted uppercase tracking-wider text-right">
                  Line $
                </th>
              </>
            )}
            {editable && (
              <th className="py-2.5 px-3 text-xs font-semibold text-brand-muted uppercase tracking-wider text-right print:hidden">
                Edit
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-brand-card">
          {groups.map(([category, categoryItems]) => (
            <ItemGroup
              key={category}
              category={category}
              items={categoryItems}
              editable={editable}
              onQuantityChange={onQuantityChange}
              onRemoveLine={onRemoveLine}
              onSwitchEconomyToStandard={onSwitchEconomyToStandard}
              onAssignCustomSku={onAssignCustomSku}
              hoveredGateDiagramNumber={hoveredGateDiagramNumber}
              customerMode={customerMode}
              bunningsEnabled={bunningsEnabled}
            />
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

function BOMMobileCards({
  groups,
  editable,
  onQuantityChange,
  onRemoveLine,
  onSwitchEconomyToStandard,
  onAssignCustomSku,
  hoveredGateDiagramNumber,
  customerMode,
  bunningsEnabled,
}: {
  groups: [string, BOMLineItem[]][];
  editable?: boolean;
  onQuantityChange?: (item: BOMLineItem, quantity: number) => void;
  onRemoveLine?: (item: BOMLineItem) => void;
  onSwitchEconomyToStandard?: (item: BOMLineItem) => void;
  onAssignCustomSku?: (item: BOMLineItem, override: { sku: string; description: string; unitPrice: number }) => void;
  hoveredGateDiagramNumber: GateDiagramNumber | null;
  customerMode?: boolean;
  bunningsEnabled?: boolean;
}) {
  return (
    <div className="space-y-4 md:hidden" data-testid="bom-mobile-cards">
      {groups.map(([category, categoryItems]) => (
        <section key={category} className="space-y-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-muted">
            {humanizeCategory(category)}
          </h3>
          <div className="space-y-2">
            {orderCompanions(categoryItems).map((item, itemIndex) => (
              <BOMMobileCard
                key={`${category}-${item.sku}-${item.category}-${item.description}-${itemIndex}`}
                item={item}
                editable={editable}
                onQuantityChange={onQuantityChange}
                onRemoveLine={onRemoveLine}
                onSwitchEconomyToStandard={onSwitchEconomyToStandard}
                onAssignCustomSku={onAssignCustomSku}
                highlighted={
                  hoveredGateDiagramNumber !== null &&
                  gateDiagramNumbersForSku(item.sku).includes(hoveredGateDiagramNumber)
                }
                customerMode={customerMode}
                bunningsEnabled={bunningsEnabled}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BOMMobileCard({
  item,
  editable,
  onQuantityChange,
  onRemoveLine,
  onSwitchEconomyToStandard,
  onAssignCustomSku,
  highlighted,
  customerMode,
  bunningsEnabled,
}: {
  item: BOMLineItem;
  editable?: boolean;
  onQuantityChange?: (item: BOMLineItem, quantity: number) => void;
  onRemoveLine?: (item: BOMLineItem) => void;
  onSwitchEconomyToStandard?: (item: BOMLineItem) => void;
  onAssignCustomSku?: (item: BOMLineItem, override: { sku: string; description: string; unitPrice: number }) => void;
  highlighted: boolean;
  customerMode?: boolean;
  bunningsEnabled?: boolean;
}) {
  const hint = nextBreakHint(item);
  const cartonHint = cartonHintForLine(item);
  const sourceText = sourceBreakdown(item);
  const diagramNumbers = isGateDiagramLine(item) ? gateDiagramNumbersForSku(item.sku) : [];
  const canSwitchEconomy =
    item.sku.startsWith("XP-6500-E65") &&
    item.notes?.includes("Switch to Standard slats?");
  const isFallback = item.sku === "CANONICAL-FALLBACK" || item.sku.includes("FALLBACK");

  return (
    <article
      className={`rounded-lg border p-3 shadow-sm transition-colors ${
        highlighted ? "ring-1 ring-brand-warning/60" : ""
      } ${
        isFallback ? "border-brand-warning bg-brand-warning/5" : "border-brand-border/70 bg-brand-bg/60"
      }`}
      title={sourceText ? `Source breakdown: ${sourceText}` : undefined}
    >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <GateDiagramBadges numbers={diagramNumbers} />
            <span className="font-mono text-xs font-bold text-brand-muted">
              {item.sku}
            </span>
            <PageChip sku={item.sku} />
          </div>
          <p className="mt-1 text-base font-black leading-snug text-brand-text">
            {stripParentheticalDispatchCode(item.description)}
          </p>
          {sourceText && (
            <p className="mt-2 rounded-full bg-brand-card px-2 py-1 text-[11px] font-bold text-brand-muted">
              {sourceText}
            </p>
          )}
        </div>
        <div className="text-right tabular-nums">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Qty
          </p>
          {editable ? (
            <input
              type="number"
              min="0"
              step="1"
              value={item.quantity}
              onChange={(event) =>
                onQuantityChange?.(item, Number(event.target.value))
              }
              className="mt-1 h-11 w-20 rounded-lg border border-brand-border bg-brand-card px-2 text-right text-sm font-black text-brand-text outline-none focus:border-brand-primary"
              aria-label={`Quantity for ${item.sku}`}
            />
          ) : (
            <p className="text-xl font-black text-brand-text">{item.quantity}</p>
          )}
          {!customerMode && (
            <>
              <p className="mt-2 text-xs font-semibold text-brand-muted">
                {item.unitPrice !== null && item.unitPrice !== undefined ? `$${formatMoney(item.unitPrice)}` : "Price TBC"} / {unitLabel(item)}
              </p>
              <p className="mt-1 text-base font-black text-brand-primary">
                {item.lineTotal !== null && item.lineTotal !== undefined ? `$${formatMoney(item.lineTotal)}` : "Price TBC"}
              </p>
            </>
          )}
        </div>
      </div>

      {isFallback && (
        <div className="mt-3 space-y-2 border border-brand-warning/20 bg-brand-warning/10 rounded-lg p-2.5">
          <p className="text-xs font-bold text-brand-warning">
            ⚠️ Missing SKU in supplier catalogue
          </p>
          {bunningsEnabled && (
            <div className="text-xs text-brand-text bg-brand-bg/90 border border-brand-border p-2 rounded space-y-1">
              <div>
                <span className="font-extrabold text-brand-success">Bunnings Suggestion:</span><br/>
                {getBunningsMockSuggestion(item).description}
                <span className="text-brand-muted"> (${getBunningsMockSuggestion(item).unitPrice}/ea)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sug = getBunningsMockSuggestion(item);
                  onAssignCustomSku?.(item, {
                    sku: sug.sku,
                    description: sug.description,
                    unitPrice: sug.unitPrice,
                  });
                }}
                className="mt-1 w-full px-2 py-1 bg-brand-success hover:bg-brand-success/90 text-white rounded text-[10px] font-bold"
              >
                Apply Bunnings Material & Price
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              const newSku = prompt("Enter Custom SKU:", item.sku);
              if (newSku === null) return;
              const newDesc = prompt("Enter Custom Name/Description:", item.description);
              if (newDesc === null) return;
              const newPriceStr = prompt("Enter Custom Price (ex-GST):", String(item.unitPrice));
              if (newPriceStr === null) return;
              const newPrice = parseFloat(newPriceStr);
              if (isNaN(newPrice)) return;
              onAssignCustomSku?.(item, {
                sku: newSku,
                description: newDesc,
                unitPrice: newPrice,
              });
            }}
            className="w-full text-center py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white text-[10px] font-bold rounded"
          >
            Assign Custom SKU & Price
          </button>
        </div>
      )}

      {(hint || cartonHint || item.notes || canSwitchEconomy || editable) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-border/60 pt-3">
          {hint && (
            <span className="rounded-full border border-brand-success/30 bg-brand-success/10 px-2 py-1 text-[11px] font-bold text-brand-success">
              {hint.more} more for lower unit price
            </span>
          )}
          {cartonHint && (
            <span className="rounded-full border border-brand-success/30 bg-brand-success/10 px-2 py-1 text-[11px] font-bold text-brand-success">
              {cartonHint.more} more for carton
            </span>
          )}
          {item.notes && (
            <span className="rounded-full border border-brand-warning/30 bg-brand-warning/10 px-2 py-1 text-[11px] font-bold text-brand-warning">
              {item.notes}
            </span>
          )}
          {canSwitchEconomy && (
            <button
              type="button"
              onClick={() => onSwitchEconomyToStandard?.(item)}
              className="min-h-11 rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-3 py-2 text-xs font-black text-brand-warning"
            >
              Switch
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => onRemoveLine?.(item)}
              className="ml-auto min-h-11 rounded-lg px-3 py-2 text-xs font-black text-brand-danger"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function ItemGroup({
  category,
  items,
  editable,
  onQuantityChange,
  onRemoveLine,
  onSwitchEconomyToStandard,
  onAssignCustomSku,
  hoveredGateDiagramNumber,
  customerMode,
  bunningsEnabled,
}: {
  category: string;
  items: BOMLineItem[];
  editable?: boolean;
  onQuantityChange?: (item: BOMLineItem, quantity: number) => void;
  onRemoveLine?: (item: BOMLineItem) => void;
  onSwitchEconomyToStandard?: (item: BOMLineItem) => void;
  onAssignCustomSku?: (item: BOMLineItem, override: { sku: string; description: string; unitPrice: number }) => void;
  hoveredGateDiagramNumber: GateDiagramNumber | null;
  customerMode?: boolean;
  bunningsEnabled?: boolean;
}) {
  const orderedItems = orderCompanions(items);
  let lastSubCategory = "";
  return (
    <>
      <tr className="border-t border-brand-border">
        <td
          colSpan={editable ? (customerMode ? 5 : 7) : (customerMode ? 4 : 6)}
          className="px-3 py-1.5 bg-slate-300/15 border-b border-brand-border capitalize text-xs font-semibold text-brand-muted tracking-wider"
        >
          {humanizeCategory(category)}
        </td>
      </tr>
      {orderedItems.flatMap((item, itemIndex) => {
          const hint = nextBreakHint(item);
          const cartonHint = cartonHintForLine(item);
          const bulkBuySku = bulkBuyVariantForSku(item.sku);
          const bulkBuyUnitPrice = bulkBuySku ? priceForSku(bulkBuySku, item.quantity) : 0;
          const bulkBuySaving =
            bulkBuySku && bulkBuyUnitPrice > 0 && item.unitPrice !== null && item.unitPrice > bulkBuyUnitPrice
              ? item.unitPrice - bulkBuyUnitPrice
              : 0;
          const canSwitchEconomy =
            item.sku.startsWith("XP-6500-E65") &&
            item.notes?.includes("Switch to Standard slats?");
          const sourceText = sourceBreakdown(item);
          const diagramNumbers = isGateDiagramLine(item) ? gateDiagramNumbersForSku(item.sku) : [];
          const diagramHighlighted =
            hoveredGateDiagramNumber !== null && diagramNumbers.includes(hoveredGateDiagramNumber);
          const subCategory = item.subCategory ?? "";
          const showSubCategory = subCategory && subCategory !== lastSubCategory && !item.companionOf;
          if (subCategory) lastSubCategory = subCategory;
          const isFallback = item.sku === "CANONICAL-FALLBACK" || item.sku.includes("FALLBACK");
          const rows = [];
          if (showSubCategory) {
            rows.push(
              <tr key={`${category}-${subCategory}-heading`}>
                <td
                  colSpan={editable ? (customerMode ? 5 : 7) : (customerMode ? 4 : 6)}
                  className="px-3 pt-3 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-brand-muted"
                >
                  {humanizeSubCategory(subCategory)}
                </td>
              </tr>,
            );
          }
          rows.push(
        <tr
          key={`${category}-${item.sku}-${item.category}-${item.description}-${itemIndex}`}
          title={sourceText ? `Source breakdown: ${sourceText}` : undefined}
          onMouseEnter={() => {
            if (diagramNumbers[0]) setGateDiagramHover(diagramNumbers[0]);
          }}
          onMouseLeave={() => {
            if (diagramNumbers.length > 0) setGateDiagramHover(null);
          }}
          className={`border-b border-brand-border last:border-0 transition-colors ${
            diagramHighlighted
              ? "bg-brand-warning/15 ring-1 ring-inset ring-brand-warning/50"
              : "hover:bg-brand-accent/5"
          } ${
            isFallback ? "border-l-4 border-l-brand-warning bg-brand-warning/5" : ""
          }`}
        >
          <td className="py-2.5 px-3 text-xs font-mono text-brand-accent whitespace-nowrap">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <GateDiagramBadges numbers={diagramNumbers} />
              {item.sku}
              <PageChip sku={item.sku} />
            </span>
          </td>
          <td className="py-2.5 px-3 text-sm text-brand-text">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>{stripParentheticalDispatchCode(item.description)}</span>
              {item.unitPrice !== null && item.unitPrice <= 0 && (
                <span className="rounded-full border border-brand-warning/40 bg-brand-warning/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-warning print:hidden">
                  Price not set
                </span>
              )}
              {item.notes && (
                <span className="text-xs text-brand-warning print:hidden">
                  {item.notes}
                </span>
              )}
              {canSwitchEconomy && (
                <button
                  type="button"
                  onClick={() => onSwitchEconomyToStandard?.(item)}
                  className="rounded-full border border-brand-warning/40 bg-brand-warning/10 px-2 py-0.5 text-[11px] font-bold text-brand-warning transition-colors hover:bg-brand-warning/20"
                >
                  Switch
                </button>
              )}
            </div>
            {isFallback && (
              <div className="mt-2 space-y-2 border border-brand-warning/20 bg-brand-warning/10 rounded-lg p-2.5 max-w-lg print:hidden">
                <p className="text-xs font-bold text-brand-warning">
                  ⚠️ Missing SKU in supplier catalogue
                </p>
                {bunningsEnabled && (
                  <div className="text-xs text-brand-text bg-brand-bg border border-brand-border p-2 rounded flex items-center justify-between gap-3">
                    <div>
                      <span className="font-extrabold text-brand-success">Bunnings Suggestion:</span>{" "}
                      <span>{getBunningsMockSuggestion(item).description}</span>{" "}
                      <span className="text-brand-muted">(${getBunningsMockSuggestion(item).unitPrice}/ea)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const sug = getBunningsMockSuggestion(item);
                        onAssignCustomSku?.(item, {
                          sku: sug.sku,
                          description: sug.description,
                          unitPrice: sug.unitPrice,
                        });
                      }}
                      className="px-2 py-1 bg-brand-success hover:bg-brand-success/90 text-white rounded text-[10px] font-bold whitespace-nowrap animate-fade-in"
                    >
                      Apply
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const newSku = prompt("Enter Custom SKU:", item.sku);
                    if (newSku === null) return;
                    const newDesc = prompt("Enter Custom Name/Description:", item.description);
                    if (newDesc === null) return;
                    const newPriceStr = prompt("Enter Custom Price (ex-GST):", String(item.unitPrice));
                    if (newPriceStr === null) return;
                    const newPrice = parseFloat(newPriceStr);
                    if (isNaN(newPrice)) return;
                    onAssignCustomSku?.(item, {
                      sku: newSku,
                      description: newDesc,
                      unitPrice: newPrice,
                    });
                  }}
                  className="px-2.5 py-1 bg-brand-primary hover:bg-brand-primary/95 text-white text-[10px] font-bold rounded"
                >
                  Assign Custom SKU & Price
                </button>
              </div>
            )}
            {hint && (
              <p className="mt-1 text-[11px] font-semibold text-brand-success print:hidden">
                {hint.more} more to unlock a lower unit price
                {hint.savingPct ? ` (save ${hint.savingPct}%)` : ""}
              </p>
            )}
            {cartonHint && (
              <p className="mt-1 inline-flex rounded-full border border-brand-success/30 bg-brand-success/10 px-2 py-0.5 text-[11px] font-bold text-brand-success print:hidden">
                {cartonHint.more} more for a carton ({cartonHint.cartonQty} {cartonHint.label})
                {cartonHint.saving > 0 ? ` - save ~$${cartonHint.saving}` : ""}
              </p>
            )}
            {bulkBuySku && (
              <p
                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold print:hidden ${
                  bulkBuySaving > 0
                    ? "border-brand-success/30 bg-brand-success/10 text-brand-success"
                    : "border-brand-border bg-brand-bg text-brand-muted"
                }`}
                title={`Bulk-buy variant: ${bulkBuySku}`}
              >
                Bulk buy {bulkBuySku}
                {bulkBuySaving > 0
                  ? ` saves $${formatMoney(bulkBuySaving)} each`
                  : " available"}
              </p>
            )}
            {sourceText && item.sources && item.sources.length > 1 && (
              <p className="mt-1 text-[11px] font-semibold text-brand-muted print:hidden">
                Sources: {sourceText}
              </p>
            )}
          </td>
          <td className="hidden py-2.5 px-3 text-sm text-brand-muted text-center sm:table-cell">
            {unitLabel(item)}
          </td>
          <td className="py-2.5 px-3 text-sm text-brand-text text-right tabular-nums">
            {editable ? (
              <>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={item.quantity}
                  onChange={(event) =>
                    onQuantityChange?.(item, Number(event.target.value))
                  }
                  className="w-20 rounded-lg border border-brand-border bg-brand-card px-2 py-1 text-right text-sm font-semibold text-brand-text shadow-sm outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 print:hidden"
                  aria-label={`Quantity for ${item.sku}`}
                />
                <span className="hidden print:inline">{item.quantity}</span>
              </>
            ) : (
              item.quantity
            )}
          </td>
          {!customerMode && (
            <>
              <td className="hidden py-2.5 px-3 text-sm text-brand-muted text-right tabular-nums sm:table-cell">
                {item.unitPrice !== null && item.unitPrice !== undefined ? `$${formatMoney(item.unitPrice)}` : "Price TBC"}
              </td>
              <td className="py-2.5 px-3 text-sm text-brand-text font-medium text-right tabular-nums">
                {item.lineTotal !== null && item.lineTotal !== undefined ? `$${formatMoney(item.lineTotal)}` : "Price TBC"}
              </td>
            </>
          )}
          {editable && (
            <td className="py-2.5 px-3 text-right print:hidden">
              <button
                type="button"
                onClick={() => onRemoveLine?.(item)}
                className="rounded px-2 py-1 text-xs font-medium text-brand-danger transition-colors hover:bg-brand-danger/10"
              >
                Remove
              </button>
            </td>
          )}
        </tr>
          );
          return rows;
      })}
    </>
  );
}

export function BOMResultTabs({
  result,
  editable,
  onQuantityChange,
  onRemoveLine,
  onSwitchEconomyToStandard,
  onAssignCustomSku,
  onActiveSummaryChange,
  customerMode,
  hideBunnings,
}: BOMResultTabsProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"line_items" | "cut_list">("line_items");
  const [bunningsEnabled, setBunningsEnabled] = useState(() => {
    if (typeof window === "undefined" || hideBunnings) return false;
    return window.localStorage.getItem("qsg-bunnings-enabled") === "true";
  });

  useEffect(() => {
    if (hideBunnings) {
      setBunningsEnabled(false);
      return;
    }
    // Synchronize if changes happen elsewhere in the session
    const handleStorage = () => {
      setBunningsEnabled(window.localStorage.getItem("qsg-bunnings-enabled") === "true");
    };
    window.addEventListener("storage", handleStorage);
    // Poll/check periodically as well for intra-tab transitions
    const timer = setInterval(handleStorage, 1000);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(timer);
    };
  }, [hideBunnings]);

  const gateResults = result.gateResults ?? [];
  const tabs = [
    { id: "all", label: "All Items", count: result.allItems.length },
    ...result.runResults.map((r, i) => ({
      id: r.runId,
      label: `Run ${i + 1}`,
      count: r.items.length,
    })),
    { id: "gates", label: "Gates", count: result.gateItems.length },
    ...gateResults.map((gate) => ({
      id: gate.id,
      label: gate.label,
      count: gate.items.length,
    })),
  ];

  const activeItems =
    activeTab === "all"
      ? result.allItems
      : activeTab === "gates"
      ? result.gateItems
      : gateResults.find((gate) => gate.id === activeTab)?.items ??
        result.runResults.find((r) => r.runId === activeTab)?.items ??
        [];

  const activeTotal = parseFloat(
    activeItems.reduce((s, i) => s + (i.lineTotal ?? 0), 0).toFixed(2),
  );
  const activeGst = parseFloat((activeTotal * 0.1).toFixed(2));
  const activeGrandTotal = parseFloat((activeTotal + activeGst).toFixed(2));
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? "All Items";
  const activeInstallVideoKeys = installVideoKeysForItems(activeItems);

  useEffect(() => {
    onActiveSummaryChange?.({
      label: activeLabel,
      subtotal: activeTotal,
      gst: activeGst,
      grandTotal: activeGrandTotal,
    });
  }, [activeGrandTotal, activeGst, activeLabel, activeTotal, onActiveSummaryChange]);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-brand-border mb-4 overflow-x-auto print:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-brand-accent text-brand-accent"
                : "border-transparent text-brand-muted hover:text-brand-text hover:border-brand-border"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-medium leading-none ${
                activeTab === tab.id
                  ? "bg-brand-accent/15 text-brand-accent"
                  : "bg-brand-border/60 text-brand-muted"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-brand-muted">
            {viewMode === "cut_list" ? "What you'll receive" : "Line items"}
          </p>
          <p className="text-xs font-semibold text-brand-muted">
            {viewMode === "cut_list"
              ? "Grouped like flat-pack stock on the truck."
              : "Priced BOM rows ready for review."}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setViewMode((mode) => (mode === "line_items" ? "cut_list" : "line_items"))
          }
          className="rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-brand-muted transition-colors hover:border-brand-primary hover:text-brand-primary hover:shadow-sm"
        >
          {viewMode === "line_items" ? "Show cut list" : "Show line items"}
        </button>
      </div>

      {viewMode === "cut_list" ? (
        <BomCutList items={activeItems} />
      ) : (
        <BOMTable
          items={activeItems}
          editable={editable}
          onQuantityChange={onQuantityChange}
          onRemoveLine={onRemoveLine}
          onSwitchEconomyToStandard={onSwitchEconomyToStandard}
          onAssignCustomSku={onAssignCustomSku}
          customerMode={customerMode}
          bunningsEnabled={bunningsEnabled}
        />
      )}

      {activeInstallVideoKeys.length > 0 && (
        <div className="mt-5 rounded-2xl border border-brand-border/70 bg-brand-bg/50 p-3 print:hidden">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-brand-muted">
            Install video QR codes
          </p>
          <div className="flex flex-wrap gap-3">
            {activeInstallVideoKeys.map((key) => (
              <InstallVideoQR key={key} videoKey={key} compact />
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {!customerMode && (
      <div className="mt-6 pt-4 border-t border-brand-border">
        <div className="mb-3 inline-flex rounded-full border border-brand-success/30 bg-brand-success/10 px-3 py-1 text-xs font-bold text-brand-success print:hidden">
          {PRICE_SOURCE_LABEL} · {PRICE_SOURCE_VERIFIED_DATE}
        </div>
        <div className="space-y-1 mb-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-brand-muted">Subtotal (ex-GST)</span>
            <span className="tabular-nums text-brand-text">
              ${formatMoney(activeTotal)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-brand-muted">GST (10%)</span>
            <span className="tabular-nums text-brand-text">
              ${formatMoney(activeGst)}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center border-t border-brand-border pt-3">
          <div>
            <p className="text-sm font-semibold text-brand-text">
              Total (inc. GST)
            </p>
            <p className="text-xs text-brand-muted mt-0.5">
              Generated{" "}
              {new Date(result.generatedAt).toLocaleString("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}
              Auto quantity-break pricing
            </p>
          </div>
          <span className="text-2xl font-bold text-brand-accent tabular-nums">
            ${formatMoney(activeGrandTotal)}
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
