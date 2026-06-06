import { useState, useMemo } from "react";
import { ChevronDown, X, Mail } from "lucide-react";
import type { CanonicalPayload } from "../../types/canonical.types";
import { resolveAmazingFencingItem, INSTALL_LABOUR_RATES } from "../../lib/amazingFencingMapper";

interface PriceBubbleProps {
  payload: CanonicalPayload;
  bomResult: any;
}

export function PriceBubble({ payload, bomResult }: PriceBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<"supply_only" | "supply_install">("supply_only");
  
  // Site labour & extras checkboxes
  const [includeRemoval, setIncludeRemoval] = useState(true);
  const [includeTravel, setIncludeTravel] = useState(true);

  // Toggle for itemized list under Supply + Install
  const [showItemizedInInstall, setShowItemizedInInstall] = useState(false);

  // 1. Process Supply Only BOM Items (ex-GST)
  const itemizedLines = useMemo(() => {
    if (!bomResult) return [];
    const lines = (bomResult.lines || []) as any[];
    return lines.map((line) => {
      // Resolve canonical name via amazingFencingMapper
      const resolved = resolveAmazingFencingItem(line.description || line.sku);
      
      const sku = resolved.sku !== "Price TBC" ? resolved.sku : line.sku;
      // If we got a real price from resolved mapping, use it. Otherwise use the engine's resolved unitPrice
      const unitPrice = resolved.priceExGst > 0 ? resolved.priceExGst : (line.unitPrice || 0);
      const lineTotal = Number((unitPrice * line.quantity).toFixed(2));

      return {
        ...line,
        resolvedSku: sku,
        resolvedUnitPrice: unitPrice,
        resolvedLineTotal: lineTotal,
        canonical: resolved.canonical,
      };
    });
  }, [bomResult, bomResult?.lines]);

  // Group items by category for Supply Only view
  const groupedBOM = useMemo(() => {
    const groups = {
      posts: [] as any[],
      palings: [] as any[],
      rails: [] as any[],
      fasteners: [] as any[],
      gates: [] as any[],
    };

    itemizedLines.forEach((line) => {
      const cat = String(line.category).toLowerCase();
      if (cat === "post") {
        groups.posts.push(line);
      } else if (cat === "paling" || cat === "slat" || cat === "pickets") {
        groups.palings.push(line);
      } else if (cat === "rail" || cat === "side_frame" || cat === "cfc_cover" || cat === "centre_support_rail" || cat === "capping") {
        groups.rails.push(line);
      } else if (cat === "gate") {
        groups.gates.push(line);
      } else {
        groups.fasteners.push(line);
      }
    });

    return groups;
  }, [itemizedLines]);

  // Supply Only totals
  const supplySubtotal = useMemo(() => {
    return itemizedLines.reduce((sum, item) => sum + item.resolvedLineTotal, 0);
  }, [itemizedLines]);

  const supplyGst = Number((supplySubtotal * 0.1).toFixed(2));
  const supplyTotalIncGst = Number((supplySubtotal + supplyGst).toFixed(2));

  // 2. Process Supply + Install pricing per run
  const runsWithLabour = useMemo(() => {
    return payload.runs.map((run, idx) => {
      const runId = run.runId;
      
      // Calculate materials cost for this run (exclude gate segments)
      const runItems = itemizedLines.filter(
        (line) => line.runId === runId && !line.segmentId?.includes("gate") && line.category !== "gate"
      );
      const supplyCost = runItems.reduce((sum, item) => sum + item.resolvedLineTotal, 0);

      // Calculate length in metres (exclude gate openings)
      const totalLengthMm = run.segments
        .filter((seg) => seg.segmentKind !== "gate_opening")
        .reduce((sum, seg) => sum + (seg.segmentWidthMm ?? 0), 0);
      const lengthM = totalLengthMm / 1000;

      // Labor: fence install per metre
      const installCost = Number((lengthM * INSTALL_LABOUR_RATES.fencePerMetre).toFixed(2));
      const totalCost = Number((supplyCost + installCost).toFixed(2));

      return {
        runId,
        label: run.displayName || `Run ${idx + 1}`,
        lengthM,
        supplyCost,
        installCost,
        totalCost,
      };
    });
  }, [payload.runs, itemizedLines]);

  // Gates with Labour
  const gatesWithLabour = useMemo(() => {
    // Find all gate segments in runs
    const gates: any[] = [];
    let gateIdx = 1;

    payload.runs.forEach((run) => {
      run.segments.forEach((seg) => {
        if (seg.segmentKind === "gate_opening") {
          // Calculate materials cost for this gate
          const gateItems = itemizedLines.filter((line) => line.segmentId === seg.segmentId);
          const supplyCost = gateItems.reduce((sum, item) => sum + item.resolvedLineTotal, 0);

          // Get gate type/movement for labor cost
          const movement = String(seg.variables?.gate_movement || "single_swing");
          let installCost = INSTALL_LABOUR_RATES.pedestrianGate;
          let typeLabel = "pedestrian";

          if (movement === "double_swing") {
            installCost = INSTALL_LABOUR_RATES.doubleSwingGate;
            typeLabel = "double swing";
          } else if (movement === "sliding") {
            installCost = INSTALL_LABOUR_RATES.slidingGate;
            typeLabel = "sliding";
          }

          const totalCost = Number((supplyCost + installCost).toFixed(2));

          gates.push({
            segmentId: seg.segmentId,
            label: `Gate ${gateIdx++}`,
            widthMm: seg.segmentWidthMm || 900,
            typeLabel,
            supplyCost,
            installCost,
            totalCost,
          });
        }
      });
    });

    return gates;
  }, [payload.runs, itemizedLines]);

  // Site Extras
  const removalCost = includeRemoval ? INSTALL_LABOUR_RATES.removalFlat : 0;
  const travelCost = includeTravel ? INSTALL_LABOUR_RATES.travelFlat : 0;

  // Supply + Install totals
  const installSubtotal = useMemo(() => {
    const runsTotal = runsWithLabour.reduce((sum, r) => sum + r.totalCost, 0);
    const gatesTotal = gatesWithLabour.reduce((sum, g) => sum + g.totalCost, 0);
    return Number((runsTotal + gatesTotal + removalCost + travelCost).toFixed(2));
  }, [runsWithLabour, gatesWithLabour, removalCost, travelCost]);

  const installGst = Number((installSubtotal * 0.1).toFixed(2));
  const installTotalIncGst = Number((installSubtotal + installGst).toFixed(2));

  // If there's no result, render loading state (moved down after hooks)
  if (!bomResult) {
    return (
      <div className="absolute top-4 right-4 z-20 w-[260px] rounded-xl border border-brand-border bg-brand-card p-4 shadow-xl text-center text-xs text-brand-muted">
        Calculating pricing...
      </div>
    );
  }

  // Mode values helper
  const isInstall = mode === "supply_install";
  const activeTotalIncGst = isInstall ? installTotalIncGst : supplyTotalIncGst;
  const activeSubtotalExGst = isInstall ? installSubtotal : supplySubtotal;

  const formatPrice = (val: number) =>
    `$${new Intl.NumberFormat("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)}`;

  const formatPriceNoDecimals = (val: number) =>
    `$${new Intl.NumberFormat("en-AU", {
      maximumFractionDigits: 0,
    }).format(Math.round(val))}`;

  // Collapsed State View
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="absolute top-4 right-4 z-20 w-[260px] cursor-pointer rounded-xl border border-brand-border bg-[#0B1528]/95 p-3.5 shadow-2xl transition-all duration-200 hover:border-[#DD6E1B] hover:scale-[1.01]"
        data-testid="price-bubble-collapsed"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DD6E1B] text-[10px] font-black text-white">
              AF
            </div>
            <div>
              <div className="text-xs font-black text-brand-text">Amazing Fencing</div>
              <div className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">
                {isInstall ? "Supply & Install" : "Supply Only"} · inc GST
              </div>
            </div>
          </div>
          <ChevronDown size={16} className="text-brand-muted hover:text-brand-text" />
        </div>
        <div className="mt-2.5">
          <div className="font-mono text-xl font-bold tracking-tight text-brand-text">
            {formatPrice(activeTotalIncGst)}
          </div>
          <div className="text-[10px] font-semibold text-brand-muted">
            ex GST {formatPriceNoDecimals(activeSubtotalExGst)}
          </div>
        </div>
      </div>
    );
  }

  // Expanded State View
  return (
    <div
      className="absolute top-4 right-4 z-20 w-[460px] rounded-xl border border-brand-border bg-[#0B1528]/98 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      data-testid="price-bubble-expanded"
    >
      {/* Header with Mode Toggle & Close Button */}
      <div className="p-4 border-b border-brand-border/40 flex items-center justify-between gap-4 bg-brand-bg/10 shrink-0">
        {/* Toggle between Supply only and Supply + Install */}
        <div className="flex p-0.5 bg-brand-bg border border-brand-border rounded-lg text-xs font-bold w-64">
          <button
            type="button"
            onClick={() => setMode("supply_only")}
            className={`flex-1 py-1.5 rounded-md text-center transition-all ${
              !isInstall
                ? "bg-[#DD6E1B] text-white"
                : "text-brand-muted hover:text-brand-text"
            }`}
          >
            Supply only
          </button>
          <button
            type="button"
            onClick={() => setMode("supply_install")}
            className={`flex-1 py-1.5 rounded-md text-center transition-all ${
              isInstall
                ? "bg-[#DD6E1B] text-white"
                : "text-brand-muted hover:text-brand-text"
            }`}
            data-testid="toggle-supply-install"
          >
            Supply + Install
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-border/20 transition-colors"
          aria-label="Collapse pricing details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin] text-xs">
        
        {/* MODE 1: Supply Only (Itemized BOM) */}
        {!isInstall && (
          <div className="space-y-4">
            {Object.entries(groupedBOM).map(([key, items]) => {
              if (items.length === 0) return null;
              
              const title = key === "fasteners"
                ? "Fasteners & Concrete"
                : key.charAt(0).toUpperCase() + key.slice(1);

              return (
                <div key={key} className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-muted border-b border-brand-border/20 pb-1">
                    {title}
                  </h4>
                  <div className="space-y-2">
                    {items.map((line, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-brand-text leading-snug break-words">
                            {line.canonical}
                          </div>
                          <div className="text-[9px] font-mono text-brand-muted mt-0.5 uppercase">
                            amf · {line.resolvedSku}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {line.resolvedSku === "Price TBC" ? (
                            <span className="rounded bg-brand-border/40 px-1.5 py-0.5 text-[9px] font-bold text-brand-muted">
                              Price TBC
                            </span>
                          ) : (
                            <>
                              <div className="font-semibold text-brand-text">
                                {formatPrice(line.resolvedLineTotal)}
                              </div>
                              <div className="text-[9px] text-brand-muted mt-0.5">
                                {line.quantity} {line.unit} × {formatPrice(line.resolvedUnitPrice)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODE 2: Supply + Install (Per-Run & Per-Gate breakdown) */}
        {isInstall && (
          <div className="space-y-4">
            
            {/* Per-Run and Per-Gate pricing */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-muted border-b border-brand-border/20 pb-1">
                Fence & Gate Breakdown
              </h4>
              <div className="space-y-3">
                {/* Runs */}
                {runsWithLabour.map((r) => (
                  <div key={r.runId} className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-semibold text-brand-text">
                        {r.label} — Side run
                      </div>
                      <div className="text-[10px] text-brand-muted mt-0.5">
                        {r.lengthM.toFixed(1)}m boundary fence · supply {formatPriceNoDecimals(r.supplyCost)} · install {formatPriceNoDecimals(r.installCost)}
                      </div>
                    </div>
                    <div className="font-bold text-brand-text shrink-0 text-right">
                      {formatPrice(r.totalCost)}
                    </div>
                  </div>
                ))}

                {/* Gates */}
                {gatesWithLabour.map((g) => (
                  <div key={g.segmentId} className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-semibold text-brand-text">
                        {g.label} — Pedestrian gate
                      </div>
                      <div className="text-[10px] text-brand-muted mt-0.5">
                        {g.widthMm}mm {g.typeLabel} · supply {formatPriceNoDecimals(g.supplyCost)} · install {formatPriceNoDecimals(g.installCost)}
                      </div>
                    </div>
                    <div className="font-bold text-brand-text shrink-0 text-right">
                      {formatPrice(g.totalCost)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Site Labour & Extras section */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-muted border-b border-brand-border/20 pb-1">
                Site Labour & Extras
              </h4>
              <div className="space-y-2.5">
                {/* Old fence removal */}
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="font-semibold text-brand-text">Old fence removal & tip fees</div>
                    <div className="text-[10px] text-brand-muted mt-0.5">
                      Dismantle existing boundary fence and dispose
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-brand-text">{formatPrice(INSTALL_LABOUR_RATES.removalFlat)}</span>
                    <input
                      type="checkbox"
                      checked={includeRemoval}
                      onChange={(e) => setIncludeRemoval(e.target.checked)}
                      className="h-4 w-4 rounded border-brand-border bg-brand-bg text-[#DD6E1B] focus:ring-[#DD6E1B]"
                    />
                  </div>
                </label>

                {/* Site travel */}
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="font-semibold text-brand-text">Site travel & mobilization</div>
                    <div className="text-[10px] text-brand-muted mt-0.5">
                      14 km travel from Currimundi depot
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-brand-text">{formatPrice(INSTALL_LABOUR_RATES.travelFlat)}</span>
                    <input
                      type="checkbox"
                      checked={includeTravel}
                      onChange={(e) => setIncludeTravel(e.target.checked)}
                      className="h-4 w-4 rounded border-brand-border bg-brand-bg text-[#DD6E1B] focus:ring-[#DD6E1B]"
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Optional Expander: Show every item */}
            <div className="border-t border-brand-border/20 pt-2">
              <button
                type="button"
                onClick={() => setShowItemizedInInstall(!showItemizedInInstall)}
                className="w-full flex items-center justify-between text-[10px] font-bold text-brand-muted hover:text-brand-text uppercase tracking-wider"
              >
                <span>Show every item · canonical names + SKUs</span>
                <ChevronDown
                  size={14}
                  className={`transform transition-transform ${showItemizedInInstall ? "rotate-180" : ""}`}
                />
              </button>
              {showItemizedInInstall && (
                <div className="mt-3 space-y-2 border-l border-brand-border/40 pl-3">
                  {itemizedLines.map((line, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[11px] py-0.5">
                      <div className="min-w-0 flex-1 pr-4">
                        <span className="font-medium text-brand-text">{line.canonical}</span>
                        <span className="text-[9px] text-brand-muted ml-1.5 uppercase font-mono">({line.resolvedSku})</span>
                      </div>
                      <span className="font-semibold text-brand-text shrink-0">
                        {line.quantity} {line.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Sticky Bottom Total Band */}
      <div className="p-4 bg-[#08101E] border-t border-brand-border/60 flex items-center justify-between shrink-0">
        <div>
          <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
            {isInstall ? "Supply & Install" : "Supply Only"} · inc GST
          </div>
          <div className="text-[9px] text-brand-muted mt-0.5">
            ex GST {formatPrice(activeSubtotalExGst)}
          </div>
        </div>
        <div className="font-mono text-2xl font-black text-brand-text" data-testid="price-bubble-total">
          {formatPrice(activeTotalIncGst)}
        </div>
      </div>

      {/* CTA Section */}
      <div className="p-4 border-t border-brand-border/40 bg-brand-bg/10 flex flex-col gap-2 shrink-0">
        <button
          type="button"
          className="w-full min-h-11 flex items-center justify-center gap-2 rounded-lg bg-[#DD6E1B] font-bold text-white shadow hover:bg-[#B85710] transition-colors"
        >
          <span>
            {isInstall
              ? "Book this job · 2 day install →"
              : "Book materials pickup · Amazing Fencing →"}
          </span>
        </button>
        <button
          type="button"
          className="w-full min-h-9 flex items-center justify-center gap-2 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-border/20 transition-all text-xs font-semibold"
        >
          <Mail size={14} />
          <span>Email this quote to me</span>
        </button>
      </div>
    </div>
  );
}
