import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CanonicalRun, CanonicalPayload } from "../../types/canonical.types";

interface VariationDisclosureProps {
  run: CanonicalRun;
  payload: CanonicalPayload;
  onUpdateJobVariables: (vars: Record<string, any>) => void;
  onUpdateRunVariables: (vars: Record<string, any>) => void;
}

export function VariationDisclosure({
  run,
  payload,
  onUpdateJobVariables,
  onUpdateRunVariables,
}: VariationDisclosureProps) {
  const [activeSection, setActiveSection] = useState<string | null>("style");

  // Merge variables for convenience of reading values
  const jobVars = payload.variables ?? {};
  const runVars = run.variables ?? {};

  const palingStyle = jobVars.paling_style || "butted";
  const timberType = jobVars.timber_type || "treated_pine";
  const targetHeight = runVars.target_height_mm || jobVars.target_height_mm || 1800;
  const postSize = runVars.post_size || "100x75";
  const postMounting = runVars.post_mounting || "in_ground";
  const palingWidth = jobVars.paling_width_mm || 100;
  const railProfile = runVars.rail_profile || "75x38";
  const railCount = runVars.rail_count != null ? Number(runVars.rail_count) : 0; // 0 = auto
  const plinthEnabled = jobVars.plinth_enabled === true;
  const nailType = jobVars.nail_type || "ring_shank";

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="mt-4 border border-brand-border/40 rounded-xl overflow-hidden bg-brand-bg/25">
      {/* 1. STYLE SECTION */}
      <div className="border-b border-brand-border/40">
        <button
          type="button"
          onClick={() => toggleSection("style")}
          className="w-full flex items-center justify-between p-3 text-xs font-bold text-brand-text hover:bg-brand-border/10 transition-colors text-left"
        >
          <span>Style & Height</span>
          <div className="flex items-center gap-2">
            {activeSection !== "style" && (
              <span className="text-[10px] text-brand-muted font-normal capitalize">
                {String(palingStyle).replace("_", " & ")} · {String(targetHeight)}mm
              </span>
            )}
            {activeSection === "style" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </button>

        {activeSection === "style" && (
          <div className="p-3 bg-brand-bg/50 space-y-3 border-t border-brand-border/20 text-xs">
            {/* Style selector */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Style</span>
              <div className="flex gap-2">
                {[
                  { value: "butted", label: "Butted" },
                  { value: "lapped_capped", label: "Lapped & Capped" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateJobVariables({ paling_style: opt.value })}
                    className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                      palingStyle === opt.value
                        ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                        : "border-brand-border text-brand-muted hover:border-brand-text"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Height selector */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Height</span>
              <div className="flex flex-wrap gap-1.5">
                {[1200, 1500, 1800, 2100, 2400].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onUpdateRunVariables({ target_height_mm: h })}
                    className={`min-h-9 px-3.5 rounded-lg border text-center font-semibold transition-all ${
                      Number(targetHeight) === h
                        ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                        : "border-brand-border text-brand-muted hover:border-brand-text"
                    }`}
                  >
                    {h}mm
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. POSTS SECTION */}
      <div className="border-b border-brand-border/40">
        <button
          type="button"
          onClick={() => toggleSection("posts")}
          className="w-full flex items-center justify-between p-3 text-xs font-bold text-brand-text hover:bg-brand-border/10 transition-colors text-left"
        >
          <span>Posts Specification</span>
          <div className="flex items-center gap-2">
            {activeSection !== "posts" && (
              <span className="text-[10px] text-brand-muted font-normal capitalize">
                {timberType === "hardwood" ? "Hardwood" : "CCA Pine"} · {postSize} · {postMounting === "core_drilled" ? "Core-drill" : "In-ground"}
              </span>
            )}
            {activeSection === "posts" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </button>

        {activeSection === "posts" && (
          <div className="p-3 bg-brand-bg/50 space-y-3 border-t border-brand-border/20 text-xs">
            {/* Post Material */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Post Material</span>
              <div className="flex gap-2">
                {[
                  { value: "treated_pine", label: "CCA Pine H4" },
                  { value: "hardwood", label: "Hardwood" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateJobVariables({ timber_type: opt.value })}
                    className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                      timberType === opt.value
                        ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                        : "border-brand-border text-brand-muted hover:border-brand-text"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Post Size Dropdown */}
            <div className="space-y-1">
              <label htmlFor="post-size-select" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">
                Post Size
              </label>
              <select
                id="post-size-select"
                value={String(postSize)}
                onChange={(e) => onUpdateRunVariables({ post_size: e.target.value })}
                className="w-full h-9 rounded-lg border border-brand-border bg-brand-bg px-2 text-brand-text focus:border-[#DD6E1B] focus:outline-none"
              >
                <option value="100x75">100x75mm (Standard)</option>
                <option value="100x100">100x100mm (Heavy Duty)</option>
              </select>
            </div>

            {/* Mounting Method */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Mounting</span>
              <div className="flex gap-2">
                {[
                  { value: "in_ground", label: "In Ground (Concrete)" },
                  { value: "core_drilled", label: "Core Drilled" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateRunVariables({ post_mounting: opt.value })}
                    className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                      postMounting === opt.value
                        ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                        : "border-brand-border text-brand-muted hover:border-brand-text"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. PALINGS SECTION */}
      <div className="border-b border-brand-border/40">
        <button
          type="button"
          onClick={() => toggleSection("palings")}
          className="w-full flex items-center justify-between p-3 text-xs font-bold text-brand-text hover:bg-brand-border/10 transition-colors text-left"
        >
          <span>Palings Specification</span>
          <div className="flex items-center gap-2">
            {activeSection !== "palings" && (
              <span className="text-[10px] text-brand-muted font-normal">
                {palingWidth}mm width · {targetHeight}mm length
              </span>
            )}
            {activeSection === "palings" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </button>

        {activeSection === "palings" && (
          <div className="p-3 bg-brand-bg/50 space-y-3 border-t border-brand-border/20 text-xs">
            {/* Paling Width */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Paling Width</span>
              <div className="flex gap-2">
                {[100, 125, 150].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onUpdateJobVariables({ paling_width_mm: w })}
                    className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                      Number(palingWidth) === w
                        ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                        : "border-brand-border text-brand-muted hover:border-brand-text"
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Paling Length (calculated) */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Paling Length</span>
              <div className="flex gap-2">
                <div className="flex-1 min-h-9 px-3 py-2 rounded-lg border border-brand-border bg-brand-bg/50 text-center font-semibold text-brand-muted">
                  {targetHeight}mm (Matches height)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. RAILS SECTION */}
      <div className="border-b border-brand-border/40">
        <button
          type="button"
          onClick={() => toggleSection("rails")}
          className="w-full flex items-center justify-between p-3 text-xs font-bold text-brand-text hover:bg-brand-border/10 transition-colors text-left"
        >
          <span>Rails Specification</span>
          <div className="flex items-center gap-2">
            {activeSection !== "rails" && (
              <span className="text-[10px] text-brand-muted font-normal capitalize">
                {String(railProfile).replace("_", " ")} · {railCount === 0 ? "Auto" : `${railCount} Rails`}
              </span>
            )}
            {activeSection === "rails" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </button>

        {activeSection === "rails" && (
          <div className="p-3 bg-brand-bg/50 space-y-3 border-t border-brand-border/20 text-xs">
            {/* Rail Size dropdown */}
            <div className="space-y-1">
              <label htmlFor="rail-size-select" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">
                Rail Size
              </label>
              <select
                id="rail-size-select"
                value={String(railProfile)}
                onChange={(e) => onUpdateRunVariables({ rail_profile: e.target.value })}
                className="w-full h-9 rounded-lg border border-brand-border bg-brand-bg px-2 text-brand-text focus:border-[#DD6E1B] focus:outline-none capitalize"
              >
                <option value="75x38">75x38mm (Pine / Hardwood)</option>
                <option value="100x38">100x38mm (Heavy Pine / Hardwood)</option>
                <option value="100x38_arrissed">100x38mm Arrissed (Eased Edge)</option>
              </select>
            </div>

            {/* Rails per panel */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Rails per panel</span>
              <div className="flex gap-1.5">
                {[
                  { value: 0, label: "Auto" },
                  { value: 2, label: "2" },
                  { value: 3, label: "3" },
                  { value: 4, label: "4" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateRunVariables({ rail_count: opt.value })}
                    className={`min-h-9 px-3.5 rounded-lg border text-center font-semibold transition-all ${
                      railCount === opt.value
                        ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                        : "border-brand-border text-brand-muted hover:border-brand-text"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. EXTRAS SECTION */}
      <div>
        <button
          type="button"
          onClick={() => toggleSection("extras")}
          className="w-full flex items-center justify-between p-3 text-xs font-bold text-brand-text hover:bg-brand-border/10 transition-colors text-left"
        >
          <span>Extras & Fasteners</span>
          <div className="flex items-center gap-2">
            {activeSection !== "extras" && (
              <span className="text-[10px] text-brand-muted font-normal capitalize">
                Plinth: {plinthEnabled ? "Yes" : "No"} · Nails: {String(nailType).replace("_", " ")}
              </span>
            )}
            {activeSection === "extras" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </button>

        {activeSection === "extras" && (
          <div className="p-3 bg-brand-bg/50 space-y-3 border-t border-brand-border/20 text-xs">
            {/* Plinth toggle */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-text">Include Bottom Plinth Board</span>
              <button
                type="button"
                onClick={() => onUpdateJobVariables({ plinth_enabled: !plinthEnabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  plinthEnabled ? "bg-[#DD6E1B]" : "bg-brand-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    plinthEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Nail type toggle */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Nail Type</span>
              <div className="flex gap-2">
                {[
                  { value: "ring_shank", label: "Ring Shank" },
                  { value: "smooth_shank", label: "Smooth Shank" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateJobVariables({ nail_type: opt.value })}
                    className={`flex-1 min-h-9 px-3 rounded-lg border text-center font-semibold transition-all ${
                      nailType === opt.value
                        ? "bg-[#DD6E1B] border-[#DD6E1B] text-white shadow-sm"
                        : "border-brand-border text-brand-muted hover:border-brand-text"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
