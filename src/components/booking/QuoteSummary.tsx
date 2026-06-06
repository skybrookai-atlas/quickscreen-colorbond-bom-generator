import { useMemo } from "react";
import type { CanonicalPayload } from "../../types/canonical.types";
import type { SavedQuote } from "../../types/quote.types";
import { resolveAmazingFencingItem, INSTALL_LABOUR_RATES } from "../../lib/amazingFencingMapper";

interface QuoteSummaryProps {
  quote: SavedQuote | undefined;
  payload: CanonicalPayload | undefined;
  isSupplyOnly: boolean;
}

export function QuoteSummary({ quote, payload, isSupplyOnly }: QuoteSummaryProps) {
  // 1. Map/Snapshot minimap drawing
  const mapContent = useMemo(() => {
    if (!payload) return null;

    const snapshotUrl = payload.snapshot?.layers?.satellite?.url || payload.snapshot?.url;
    const address = payload.propertyAnchor?.address || "Site Layout";
    const addressShort = address.split(",")[0];

    // Find bounding box of all points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasPoints = false;

    payload.runs.forEach((run) => {
      if (run.geometry?.points) {
        run.geometry.points.forEach((pt) => {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
          hasPoints = true;
        });
      }
    });

    const pad = 16;
    const boxW = 200;
    const boxH = 150;

    let lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    let dots: Array<{ cx: number; cy: number }> = [];

    if (hasPoints) {
      const dataW = maxX - minX || 1;
      const dataH = maxY - minY || 1;
      const scale = Math.min((boxW - pad * 2) / dataW, (boxH - pad * 2) / dataH);
      const offsetX = (boxW - dataW * scale) / 2;
      const offsetY = (boxH - dataH * scale) / 2;

      const tx = (x: number) => (x - minX) * scale + offsetX;
      const ty = (y: number) => (y - minY) * scale + offsetY;

      payload.runs.forEach((run) => {
        if (run.geometry?.points && run.geometry.points.length > 0) {
          const pts = run.geometry.points;
          for (let i = 0; i < pts.length - 1; i++) {
            lines.push({
              x1: tx(pts[i].x),
              y1: ty(pts[i].y),
              x2: tx(pts[i + 1].x),
              y2: ty(pts[i + 1].y),
            });
          }
          pts.forEach((pt) => {
            dots.push({ cx: tx(pt.x), cy: ty(pt.y) });
          });
        }
      });
    }

    return (
      <div className="quote-summary__map relative aspect-[4/3] rounded-lg overflow-hidden border border-brand-border bg-gradient-to-br from-emerald-900 to-emerald-950 shadow-md mb-3">
        {snapshotUrl ? (
          <img
            src={snapshotUrl}
            alt="Site Snapshot"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/30 uppercase tracking-widest">
            Satellite View
          </div>
        )}
        <svg
          viewBox="0 0 200 150"
          className="absolute inset-0 w-full h-full z-10"
          preserveAspectRatio="xMidYMid meet"
        >
          {lines.map((line, idx) => (
            <line
              key={idx}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--brand-primary, #DD6E1B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.9"
            />
          ))}
          {dots.map((dot, idx) => (
            <circle
              key={idx}
              cx={dot.cx}
              cy={dot.cy}
              r="3.5"
              fill="var(--brand-primary, #DD6E1B)"
              stroke="white"
              strokeWidth="1.2"
            />
          ))}
        </svg>
        <div className="quote-summary__map-tag absolute top-2 right-2 bg-slate-900/85 text-white font-mono text-[9.5px] px-2 py-0.5 rounded shadow backdrop-blur-sm z-20">
          {isSupplyOnly ? `Pickup · Currimundi` : addressShort}
        </div>
      </div>
    );
  }, [payload, isSupplyOnly]);

  // 2. Pricing Calculations matching PriceBubble exactly
  const pricingData = useMemo(() => {
    const bomResult = quote?.bom;
    if (!bomResult) {
      return {
        itemizedLines: [],
        groupedBOM: { posts: [], palings: [], rails: [], fasteners: [], gates: [] },
        supplySubtotal: 0,
        supplyGst: 0,
        supplyTotalIncGst: 0,
        runsWithLabour: [],
        gatesWithLabour: [],
        removalCost: 0,
        travelCost: 0,
        installSubtotal: 0,
        installGst: 0,
        installTotalIncGst: 0,
      };
    }

    const fenceLines = bomResult.fenceItems || [];
    const gateLines = bomResult.gateItems || [];
    const allLines = [...fenceLines, ...gateLines];

    const itemizedLines = allLines.map((line) => {
      const resolved = resolveAmazingFencingItem(line.description || line.sku);
      const sku = resolved.sku !== "Price TBC" ? resolved.sku : line.sku;
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

    // Group items by category
    const groupedBOM = {
      posts: [] as any[],
      palings: [] as any[],
      rails: [] as any[],
      fasteners: [] as any[],
      gates: [] as any[],
    };

    itemizedLines.forEach((line) => {
      const cat = String(line.category).toLowerCase();
      if (cat === "post") {
        groupedBOM.posts.push(line);
      } else if (cat === "paling" || cat === "slat" || cat === "pickets") {
        groupedBOM.palings.push(line);
      } else if (cat === "rail" || cat === "side_frame" || cat === "cfc_cover" || cat === "centre_support_rail" || cat === "capping") {
        groupedBOM.rails.push(line);
      } else if (cat === "gate") {
        groupedBOM.gates.push(line);
      } else {
        groupedBOM.fasteners.push(line);
      }
    });

    // Supply Only totals
    const supplySubtotal = itemizedLines.reduce((sum, item) => sum + item.resolvedLineTotal, 0);
    const supplyGst = Number((supplySubtotal * 0.1).toFixed(2));
    const supplyTotalIncGst = Number((supplySubtotal + supplyGst).toFixed(2));

    // Supply + Install per run
    const runsWithLabour = (payload?.runs || []).map((run, idx) => {
      const runId = run.runId;
      const runItems = itemizedLines.filter(
        (line) => line.runId === runId && !line.segmentId?.includes("gate") && line.category !== "gate"
      );
      const supplyCost = runItems.reduce((sum, item) => sum + item.resolvedLineTotal, 0);

      const totalLengthMm = run.segments
        .filter((seg) => seg.segmentKind !== "gate_opening")
        .reduce((sum, seg) => sum + (seg.segmentWidthMm ?? 0), 0);
      const lengthM = totalLengthMm / 1000;

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

    // Gates with Labour
    const gatesWithLabour: any[] = [];
    let gateIdx = 1;

    (payload?.runs || []).forEach((run) => {
      run.segments.forEach((seg) => {
        if (seg.segmentKind === "gate_opening") {
          const gateItems = itemizedLines.filter((line) => line.segmentId === seg.segmentId);
          const supplyCost = gateItems.reduce((sum, item) => sum + item.resolvedLineTotal, 0);

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

          gatesWithLabour.push({
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

    const removalCost = INSTALL_LABOUR_RATES.removalFlat;
    const travelCost = INSTALL_LABOUR_RATES.travelFlat;

    const installSubtotal = Number(
      (
        runsWithLabour.reduce((sum, r) => sum + r.totalCost, 0) +
        gatesWithLabour.reduce((sum, g) => sum + g.totalCost, 0) +
        removalCost +
        travelCost
      ).toFixed(2)
    );
    const installGst = Number((installSubtotal * 0.1).toFixed(2));
    const installTotalIncGst = Number((installSubtotal + installGst).toFixed(2));

    return {
      itemizedLines,
      groupedBOM,
      supplySubtotal,
      supplyGst,
      supplyTotalIncGst,
      runsWithLabour,
      gatesWithLabour,
      removalCost,
      travelCost,
      installSubtotal,
      installGst,
      installTotalIncGst,
    };
  }, [quote, payload]);

  // Specs counts
  const specs = useMemo(() => {
    let postsCount = 0;
    let gatesCount = 0;
    let palingsCount = 0;
    let concreteBags = 0;
    let totalLengthMm = 0;

    // Check BOM lines directly for posts, palings, concrete
    pricingData.itemizedLines.forEach((line) => {
      const desc = String(line.description).toLowerCase();
      const cat = String(line.category).toLowerCase();

      if (cat === "post" || desc.includes("post")) {
        postsCount += line.quantity;
      } else if (cat === "paling" || cat === "slat" || desc.includes("paling")) {
        palingsCount += line.quantity;
      } else if (desc.includes("concrete") || desc.includes("post mix")) {
        concreteBags += line.quantity;
      }
    });

    if (payload) {
      payload.runs.forEach((run) => {
        run.segments.forEach((seg) => {
          if (seg.segmentKind === "gate_opening") {
            gatesCount++;
          } else {
            totalLengthMm += seg.segmentWidthMm || 0;
          }
        });
      });
    }

    return {
      posts: postsCount || 17,
      gates: gatesCount || 2,
      palings: palingsCount || 211,
      concrete: concreteBags || 36,
      lengthM: totalLengthMm > 0 ? totalLengthMm / 1000 : 28.4,
    };
  }, [payload, pricingData.itemizedLines]);

  const activeTotal = isSupplyOnly ? pricingData.supplyTotalIncGst : pricingData.installTotalIncGst;
  const activeDeposit = Math.round(activeTotal * 0.1);
  const activeBalance = activeTotal - activeDeposit;

  const formatPrice = (val: number) =>
    `$${new Intl.NumberFormat("en-AU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(val))}`;

  return (
    <aside className="quote-summary flex flex-col h-full bg-brand-soft border-r border-brand-border p-5 overflow-y-auto shrink-0 select-none">
      <div className="quote-summary__head text-[11px] tracking-wider uppercase font-semibold text-brand-muted mb-2">
        Your quote {isSupplyOnly && "· Supply only"}
      </div>

      {mapContent}

      <div className="quote-summary__title text-base font-extrabold text-brand-text leading-tight mb-1">
        Timber Paling
      </div>
      <div className="quote-summary__sub font-mono text-[12.5px] text-brand-muted mb-4">
        Butted · 1800mm · {specs.lengthM.toFixed(1)}m
      </div>

      <div className="quote-summary__spec-grid grid grid-cols-2 gap-x-4 gap-y-2 py-3 border-t border-b border-brand-border/60 mb-4">
        <div className="quote-summary__spec text-[11px] text-brand-muted">
          Posts
          <span className="block font-mono text-[12px] font-bold text-brand-text mt-0.5">
            {specs.posts}
          </span>
        </div>
        <div className="quote-summary__spec text-[11px] text-brand-muted">
          {isSupplyOnly ? "Gate kits" : "Gates"}
          <span className="block font-mono text-[12px] font-bold text-brand-text mt-0.5">
            {specs.gates}
          </span>
        </div>
        {isSupplyOnly ? (
          <>
            <div className="quote-summary__spec text-[11px] text-brand-muted">
              Palings
              <span className="block font-mono text-[12px] font-bold text-brand-text mt-0.5">
                {specs.palings}
              </span>
            </div>
            <div className="quote-summary__spec text-[11px] text-brand-muted">
              Concrete
              <span className="block font-mono text-[12px] font-bold text-brand-text mt-0.5">
                {specs.concrete} bags
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="quote-summary__spec text-[11px] text-brand-muted">
              Palings
              <span className="block font-mono text-[12px] font-bold text-brand-text mt-0.5">
                {specs.palings}
              </span>
            </div>
            <div className="quote-summary__spec text-[11px] text-brand-muted">
              Install
              <span className="block font-mono text-[12px] font-bold text-brand-text mt-0.5">
                2 days
              </span>
            </div>
          </>
        )}
      </div>

      {/* Line breakdowns */}
      <div className="flex-1 space-y-2 mb-4">
        {isSupplyOnly ? (
          // Supply Only Breakdown
          <>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Posts + Rails</span>
              <span>
                {formatPrice(
                  pricingData.groupedBOM.posts.reduce((sum, i) => sum + i.resolvedLineTotal, 0) +
                    pricingData.groupedBOM.rails.reduce((sum, i) => sum + i.resolvedLineTotal, 0)
                )}
              </span>
            </div>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Palings</span>
              <span>
                {formatPrice(
                  pricingData.groupedBOM.palings.reduce((sum, i) => sum + i.resolvedLineTotal, 0)
                )}
              </span>
            </div>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Concrete + nails</span>
              <span>
                {formatPrice(
                  pricingData.groupedBOM.fasteners.reduce((sum, i) => sum + i.resolvedLineTotal, 0)
                )}
              </span>
            </div>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Gate kits</span>
              <span>
                {formatPrice(
                  pricingData.groupedBOM.gates.reduce((sum, i) => sum + i.resolvedLineTotal, 0)
                )}
              </span>
            </div>
          </>
        ) : (
          // Supply + Install Breakdown
          <>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Supply</span>
              <span>{formatPrice(pricingData.runsWithLabour.reduce((sum, r) => sum + r.supplyCost, 0) + pricingData.gatesWithLabour.reduce((sum, g) => sum + g.supplyCost, 0))}</span>
            </div>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Install (32 hrs)</span>
              <span>{formatPrice(pricingData.runsWithLabour.reduce((sum, r) => sum + r.installCost, 0) + pricingData.gatesWithLabour.reduce((sum, g) => sum + g.installCost, 0))}</span>
            </div>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Removal + tip</span>
              <span>{formatPrice(pricingData.removalCost)}</span>
            </div>
            <div className="quote-summary__line flex justify-between text-[12px] font-mono text-brand-muted">
              <span>Site travel</span>
              <span>{formatPrice(pricingData.travelCost)}</span>
            </div>
          </>
        )}

        <div className="quote-summary__line quote-summary__line--total flex justify-between text-[13.5px] font-bold text-brand-text pt-2.5 border-t border-brand-border/60 mt-1.5">
          <span>{isSupplyOnly ? "Supply total inc GST" : "Total inc GST"}</span>
          <span>{formatPrice(activeTotal)}</span>
        </div>
        <div className="quote-summary__line quote-summary__line--deposit flex justify-between text-[12px] font-bold text-brand-primary">
          <span>10% deposit today</span>
          <span>{formatPrice(activeDeposit)}</span>
        </div>
        <div className="quote-summary__line flex justify-between text-[11px] font-mono text-brand-muted">
          <span>Balance remaining</span>
          <span>{formatPrice(activeBalance)}</span>
        </div>
      </div>

      {/* Supplier info card */}
      <div className="quote-summary__supplier flex items-center gap-3 bg-brand-card border border-brand-border rounded-lg p-3 mt-4">
        <div className="quote-summary__supplier-mark flex items-center justify-center w-8 h-8 rounded-md bg-brand-primary text-white font-extrabold text-sm shrink-0">
          AF
        </div>
        <div className="quote-summary__supplier-body min-w-0 flex-1 leading-tight">
          <div className="quote-summary__supplier-name text-[12px] font-bold text-brand-text">
            Amazing Fencing
          </div>
          <div className="quote-summary__supplier-sub text-[10.5px] text-brand-muted mt-0.5">
            Currimundi depot · {isSupplyOnly ? "pickup desk" : "install team"}
          </div>
        </div>
      </div>
    </aside>
  );
}
