import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CanonicalRun, CanonicalPayload } from "../../types/canonical.types";
import { useProductVariables } from "../../hooks/useProductVariables";
import { useBranding } from "../../hooks/useBranding";

interface RetainingWallVariationDisclosureProps {
  run: CanonicalRun;
  payload: CanonicalPayload;
  onUpdateJobVariables: (vars: Record<string, any>) => void;
  onUpdateRunVariables: (vars: Record<string, any>) => void;
}

function getOptionLabel(fieldKey: string, val: any): string {
  const strVal = String(val);
  if (fieldKey === "product_line") {
    if (strVal === "superpost") return "SuperPost";
    if (strVal === "tuffpoly") return "TUFFPOLY";
  }
  if (fieldKey === "colour") {
    return strVal;
  }
  if (fieldKey === "target_height_mm" || fieldKey === "sleeper_height_mm" || fieldKey === "max_panel_width_mm") {
    return `${strVal}mm`;
  }
  return strVal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RetainingWallVariationDisclosure({
  run,
  payload,
  onUpdateJobVariables,
  onUpdateRunVariables,
}: RetainingWallVariationDisclosureProps) {
  const [activeSection, setActiveSection] = useState<string | null>("style");

  // Merge variables for convenience of reading values
  const jobVars = payload.variables ?? {};
  const runVars = run.variables ?? {};

  const productCode = payload.productCode;
  const activeSupplierSlug = jobVars.supplier_slug as string | undefined || "amazing-fencing";
  const { supplier } = useBranding(activeSupplierSlug);
  const orgId = supplier?.orgId || null;

  const { data: jobFields = [] } = useProductVariables(productCode, "job", orgId);
  const { data: runFields = [] } = useProductVariables(productCode, "run", orgId);
  const { data: segmentFields = [] } = useProductVariables(productCode, "segment", orgId);

  // Merge the fields
  const fields = [...jobFields, ...runFields, ...segmentFields];

  const getFieldOptions = (fieldKey: string, fallbackOpts: any[]) => {
    const field = fields.find((f) => f.field_key === fieldKey);
    if (field && Array.isArray(field.options_json) && field.options_json.length > 0) {
      return field.options_json;
    }
    return fallbackOpts;
  };

  const getFieldDefault = (fieldKey: string, fallbackDefault: any) => {
    const field = fields.find((f) => f.field_key === fieldKey);
    if (field && field.default_value_json !== undefined && field.default_value_json !== null) {
      return field.default_value_json;
    }
    return fallbackDefault;
  };

  // Retaining wall specific variables
  const productLine = jobVars.product_line || getFieldDefault("product_line", "superpost");
  const targetHeight = runVars.target_height_mm || jobVars.target_height_mm || getFieldDefault("target_height_mm", 600);
  const sleeperHeight = jobVars.sleeper_height_mm || getFieldDefault("sleeper_height_mm", 200);
  const colour = jobVars.colour || getFieldDefault("colour", "Grey");
  const includePlinth = jobVars.include_plinth !== undefined ? jobVars.include_plinth === true : getFieldDefault("include_plinth", true) === true;
  const includeBrackets = jobVars.include_brackets !== undefined ? jobVars.include_brackets === true : getFieldDefault("include_brackets", true) === true;
  const cornerCount = runVars.corner_count !== undefined ? Number(runVars.corner_count) : Number(getFieldDefault("corner_count", 0));
  const maxPanelWidthMm = runVars.max_panel_width_mm || jobVars.max_panel_width_mm || getFieldDefault("max_panel_width_mm", 2400);

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const handleProductLineChange = (line: string) => {
    const updates: Record<string, any> = { product_line: line };
    // Auto-adjust default colour for SuperPost
    if (line === "superpost") {
      updates.colour = "Grey";
    } else if (colour === "Grey") {
      // TUFFPOLY doesn't have Grey C-posts, default to Charcoal
      updates.colour = "Charcoal";
    }
    onUpdateJobVariables(updates);
  };

  return (
    <div className="mt-4 border border-brand-border/40 rounded-xl overflow-hidden bg-brand-bg/25 text-xs text-brand-text">
      {/* 1. PRODUCT LINE & HEIGHT */}
      <div className="border-b border-brand-border/40">
        <button
          type="button"
          onClick={() => toggleSection("style")}
          className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
            activeSection === "style" ? "bg-[#FCF1E6]/50" : "hover:bg-[#FCF1E6]/10"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E7681]">System & Height</span>
          <div className="flex items-center gap-2">
            {activeSection !== "style" && (
              <span className="af-sidebar-mono text-[#11161D] font-semibold capitalize">
                {productLine === "superpost" ? "SuperPost" : "TUFFPOLY"} · {targetHeight}mm
              </span>
            )}
            <span className={activeSection === "style" ? "text-[#DD6E1B]" : "text-[#6E7681]"}>
              {activeSection === "style" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>
        </button>

        {activeSection === "style" && (
          <div className="p-3 bg-brand-bg space-y-3 border-t border-brand-border/20 text-xs">
            {/* Product Line */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.12em]">Product Line</span>
              <div className="flex gap-2">
                {getFieldOptions("product_line", ["superpost", "tuffpoly"]).map((optVal) => {
                  const val = String(optVal);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleProductLineChange(val)}
                      className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                        productLine === val
                          ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                          : "border-brand-border text-brand-muted hover:border-brand-text"
                      }`}
                    >
                      {getOptionLabel("product_line", val)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Height */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.12em]">Target Height</span>
              <div className="flex flex-wrap gap-1.5">
                {getFieldOptions("target_height_mm", [300, 600, 900, 1200, 1500, 1800]).map((hVal) => {
                  const h = Number(hVal);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onUpdateRunVariables({ target_height_mm: h })}
                      className={`min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                        Number(targetHeight) === h
                          ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                          : "border-brand-border text-brand-muted hover:border-brand-text"
                      }`}
                    >
                      {getOptionLabel("target_height_mm", h)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. SLEEPERS & COLOUR */}
      <div className="border-b border-brand-border/40">
        <button
          type="button"
          onClick={() => toggleSection("sleepers")}
          className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
            activeSection === "sleepers" ? "bg-[#FCF1E6]/50" : "hover:bg-[#FCF1E6]/10"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E7681]">Sleeper & Colour</span>
          <div className="flex items-center gap-2">
            {activeSection !== "sleepers" && (
              <span className="af-sidebar-mono text-[#11161D] font-semibold capitalize">
                {sleeperHeight}mm · {colour}
              </span>
            )}
            <span className={activeSection === "sleepers" ? "text-[#DD6E1B]" : "text-[#6E7681]"}>
              {activeSection === "sleepers" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>
        </button>

        {activeSection === "sleepers" && (
          <div className="p-3 bg-brand-bg space-y-3 border-t border-brand-border/20 text-xs">
            {/* Sleeper Height */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.12em]">Sleeper Height</span>
              <div className="flex gap-2">
                {getFieldOptions("sleeper_height_mm", [150, 200, 250]).map((shVal) => {
                  const sh = Number(shVal);
                  return (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => onUpdateJobVariables({ sleeper_height_mm: sh })}
                      className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                        Number(sleeperHeight) === sh
                          ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                          : "border-brand-border text-brand-muted hover:border-brand-text"
                      }`}
                    >
                      {getOptionLabel("sleeper_height_mm", sh)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colour */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.12em]">Colour</span>
              <div className="flex gap-2">
                {getFieldOptions("colour", ["Grey", "Charcoal", "Drift"]).map((colVal) => {
                  const col = String(colVal);
                  const isAvailable = productLine === "tuffpoly" ? col !== "Grey" : col === "Grey";
                  return (
                    <button
                      key={col}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => onUpdateJobVariables({ colour: col })}
                      className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                        !isAvailable
                          ? "opacity-30 cursor-not-allowed border-brand-border bg-brand-bg text-brand-muted"
                          : colour === col
                            ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                            : "border-brand-border text-brand-muted hover:border-brand-text"
                      }`}
                    >
                      {getOptionLabel("colour", col)}
                    </button>
                  );
                })}
              </div>
              {productLine === "superpost" ? (
                <div className="text-[10px] text-brand-muted italic mt-1">SuperPost is only available in Grey.</div>
              ) : (
                <div className="text-[10px] text-brand-muted italic mt-1">TUFFPOLY is available in Charcoal and Drift.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. GEOMETRY / SPACING & CORNERS */}
      <div className="border-b border-brand-border/40">
        <button
          type="button"
          onClick={() => toggleSection("geometry")}
          className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
            activeSection === "geometry" ? "bg-[#FCF1E6]/50" : "hover:bg-[#FCF1E6]/10"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E7681]">Spacing & Corners</span>
          <div className="flex items-center gap-2">
            {activeSection !== "geometry" && (
              <span className="af-sidebar-mono text-[#11161D] font-semibold">
                Spacing: {maxPanelWidthMm}mm · Corners: {cornerCount}
              </span>
            )}
            <span className={activeSection === "geometry" ? "text-[#DD6E1B]" : "text-[#6E7681]"}>
              {activeSection === "geometry" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>
        </button>

        {activeSection === "geometry" && (
          <div className="p-3 bg-brand-bg space-y-3 border-t border-brand-border/20 text-xs">
            {/* Post Spacing */}
            <div className="space-y-1">
              <label htmlFor="post-spacing-input" className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.12em] block">
                Post Spacing (Max Panel Width)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="post-spacing-input"
                  type="number"
                  min={100}
                  max={2400}
                  step={50}
                  value={Number(maxPanelWidthMm)}
                  onChange={(e) => onUpdateRunVariables({ max_panel_width_mm: Math.max(100, Math.min(2400, Number(e.target.value))) })}
                  className="w-24 h-9 rounded-lg border border-brand-border bg-brand-bg px-2 text-brand-text focus:border-[#DD6E1B] focus:outline-none"
                />
                <div className="flex gap-1">
                  {[1500, 2000, 2400].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onUpdateRunVariables({ max_panel_width_mm: w })}
                      className={`h-9 px-2 rounded-lg border text-center font-semibold text-[10px] transition-all ${
                        Number(maxPanelWidthMm) === w
                          ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                          : "border-brand-border text-brand-muted hover:border-brand-text"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Corner Count */}
            <div className="space-y-1">
              <label htmlFor="corner-count-input" className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.12em] block">
                Corner Count (Increases H-posts)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="corner-count-input"
                  type="number"
                  min={0}
                  max={20}
                  value={Number(cornerCount)}
                  onChange={(e) => onUpdateRunVariables({ corner_count: Math.max(0, Number(e.target.value)) })}
                  className="w-24 h-9 rounded-lg border border-brand-border bg-brand-bg px-2 text-brand-text focus:border-[#DD6E1B] focus:outline-none"
                />
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateRunVariables({ corner_count: c })}
                      className={`h-9 w-9 rounded-lg border text-center font-semibold text-[10px] transition-all ${
                        Number(cornerCount) === c
                          ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                          : "border-brand-border text-brand-muted hover:border-brand-text"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. EXTRAS SECTION */}
      <div>
        <button
          type="button"
          onClick={() => toggleSection("extras")}
          className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
            activeSection === "extras" ? "bg-[#FCF1E6]/50" : "hover:bg-[#FCF1E6]/10"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E7681]">Extras & Hardware</span>
          <div className="flex items-center gap-2">
            {activeSection !== "extras" && (
              <span className="af-sidebar-mono text-[#11161D] font-semibold capitalize">
                Plinth: {includePlinth ? "Yes" : "No"} · Brackets: {includeBrackets ? "Yes" : "No"}
              </span>
            )}
            <span className={activeSection === "extras" ? "text-[#DD6E1B]" : "text-[#6E7681]"}>
              {activeSection === "extras" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>
        </button>

        {activeSection === "extras" && (
          <div className="p-3 bg-brand-bg space-y-3 border-t border-brand-border/20 text-xs">
            {/* Plinth toggle */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-text">Include Bottom Plinth Board</span>
              <button
                type="button"
                onClick={() => onUpdateJobVariables({ include_plinth: !includePlinth })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  includePlinth ? "bg-[#DD6E1B]" : "bg-brand-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    includePlinth ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Brackets toggle */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-text">Include End/Corner Brackets</span>
              <button
                type="button"
                onClick={() => onUpdateJobVariables({ include_brackets: !includeBrackets })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  includeBrackets ? "bg-[#DD6E1B]" : "bg-brand-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    includeBrackets ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
