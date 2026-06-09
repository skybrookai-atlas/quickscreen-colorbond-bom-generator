// lib.ts — pure helper functions for the bom-calculator engine.
// No Deno env, no Supabase client, no HTTP — safe to import in tests.

import { create, all } from "https://esm.sh/mathjs@13";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PricingRule } from "../_shared/types.ts";

const mathjs = create(all);
export { mathjs };

// ─── Colour codes ─────────────────────────────────────────────────────────────
// Kept as a fallback — if the DB lookup in index.ts fails, normaliseVariables
// still resolves long colour names to short codes using this hardcoded map.
const COLOUR_CODES_FALLBACK: Record<string, string> = {
  "black-satin": "B",
  "monument-matt": "MN",
  "woodland-grey-matt": "G",
  "surfmist-matt": "SM",
  "pearl-white-gloss": "W",
  "basalt-satin": "BS",
  "dune-satin": "D",
  mill: "M",
  primrose: "P",
  paperbark: "PB",
  "palladium-silver-pearl": "S",
  kwila: "KWI",
  "western-red-cedar": "WRC",
  "island-grey": "IG",
};

// ─── EngineData (duplicated here to avoid importing index.ts in tests) ────────

export interface EngineData {
  product: { id: string; system_type: string; product_type: string };
  ruleVersion: { id: string };
  rules: Array<{
    id: string;
    name: string;
    stage: string;
    expression: string;
    output_key: string;
    priority: number;
  }>;
  constraints: Array<{
    id: string;
    name: string;
    constraint_type: string;
    value_text: string;
    unit: string;
    severity: string;
    applies_when_json: Record<string, unknown>;
    message: string;
  }>;
  variables: Array<{
    id: string;
    name: string;
    data_type: string;
    default_value_json: unknown;
    scope: string;
  }>;
  validations: Array<{
    id: string;
    name: string;
    expression: string;
    severity: string;
    message: string;
  }>;
  selectors: Array<{
    id: string;
    selector_key: string;
    component_category: string;
    selector_type: string;
    match_json: Record<string, unknown>;
    sku_pattern: string;
    priority: number;
    qty_key?: string;
  }>;
  companions: Array<{
    id: string;
    rule_key: string;
    trigger_category: string;
    trigger_match_json: Record<string, unknown>;
    add_category: string;
    add_sku_pattern: string;
    qty_formula: string;
    is_pack: boolean;
    priority: number;
    is_suggestion?: boolean;
  }>;
  warnings: Array<{
    id: string;
    warning_key: string;
    severity: string;
    condition_json: Record<string, unknown>;
    message: string;
  }>;
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

/**
 * Walk pricing rules (sorted by priority desc) and return the price of the
 * first rule whose math.js expression evaluates to true, or the first
 * catch-all rule (null rule). Returns 0 if no rule matches.
 */
export function resolvePrice(rules: PricingRule[], qty: number): number {
  for (const r of rules) {
    if (!r.rule) return r.price;
    try {
      if (mathjs.evaluate(r.rule, { qty }) === true) return r.price;
    } catch {
      /* malformed rule — skip */
    }
  }
  return 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Test whether a context object satisfies a match_json predicate.
 * Supports: exact equality, array membership, and range operators
 * { gt, gte, lt, lte, eq, neq }.
 */
export function matchesJSON(
  matchJson: Record<string, unknown>,
  ctx: Record<string, unknown>,
  debug: boolean = false,
): boolean {
  const matches = Object.entries(matchJson).map(([key, expected]) => {
    const actual = ctx[key];
    if (
      typeof expected === "object" &&
      expected !== null &&
      !Array.isArray(expected)
    ) {
      const range = expected as Record<string, unknown>;
      if ("gt" in range && !(Number(actual) > Number(range.gt))) return false;
      if ("gte" in range && !(Number(actual) >= Number(range.gte)))
        return false;
      if ("lt" in range && !(Number(actual) < Number(range.lt))) return false;
      if ("lte" in range && !(Number(actual) <= Number(range.lte)))
        return false;
      if ("eq" in range && actual !== range.eq) return false;
      if ("neq" in range && actual === range.neq) return false;
      if ("in" in range && Array.isArray(range.in) && !range.in.includes(actual)) return false;
    } else if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else {
      if (actual !== expected) return false;
    }
    return true;
  });

  if (debug) {
    console.log("matchesJSON", matchJson, ctx, matches, matches.every(Boolean));
  }
  return matches.every(Boolean);
}

/**
 * Replace `{key}` placeholders in a SKU pattern with values from context.
 * Unresolved placeholders are left as-is so the caller can detect them.
 */
export function resolvePlaceholders(
  pattern: string,
  ctx: Record<string, unknown>,
): string {
  return pattern.replace(/\{(\w+)\}/g, (_, key) => {
    const val = ctx[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

/**
 * stocks(cutsNeeded, stockLen, cutLen) → integer
 *
 * Returns the number of stock-length pieces required to produce `cutsNeeded`
 * cuts of length `cutLen` from stock of length `stockLen`.
 *
 * Handles zero and NaN gracefully (returns 0).
 *
 * Example: stocks(52, 6100, 2438) → 26  (2 cuts per 6100mm stock → 26 stocks)
 */
export function stocks(
  cutsNeeded: number,
  stockLen: number,
  cutLen: number,
): number {
  if (
    !Number.isFinite(cutsNeeded) ||
    !Number.isFinite(stockLen) ||
    !Number.isFinite(cutLen) ||
    cutsNeeded <= 0 ||
    stockLen <= 0 ||
    cutLen <= 0
  ) {
    return 0;
  }
  const cutsPerStock = Math.floor(stockLen / cutLen);
  if (cutsPerStock === 0) return cutsNeeded; // each stock yields < 1 cut
  return Math.ceil(cutsNeeded / cutsPerStock);
}

// Register stocks() as a math.js function so seed rules can call it.
mathjs.import({ stocks }, { override: false });

export function equalStrings(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}
mathjs.import({ equalStrings }, { override: false });

export function normaliseVariables(
  vars: Record<string, string | number | boolean>,
  engineData: Pick<EngineData, "variables">,
  colourCodes?: Record<string, string>,
  includeDefaults = true,
): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};

  if (includeDefaults) {
    for (const v of engineData.variables) {
      if (v.default_value_json !== null && v.default_value_json !== undefined) {
        ctx[v.name] = v.default_value_json;
      }
    }
  }

  for (const [k, v] of Object.entries(vars)) {
    ctx[k] = v;
  }

  const COLOUR_CODES_MAP = colourCodes ?? COLOUR_CODES_FALLBACK;
  const rawColour = ctx["colour_code"] ?? ctx["colour"];
  if (typeof rawColour === "string") {
    const shortCode = COLOUR_CODES_MAP[rawColour] ?? rawColour;
    ctx["colour"] = shortCode;
    ctx["colour_code"] = shortCode;
  }

  return ctx;
}

export function generateCanonicalCode(
  sku: string,
  name: string,
  category: string,
  metadata?: any,
): string {
  const compCategory = category?.toLowerCase();
  const meta = metadata || {};
  
  // Try to normalize material/label:
  let material = "Treated Pine";
  const searchStr = `${name} ${sku}`.toLowerCase();
  if (searchStr.includes("hardwood")) {
    material = "Hardwood";
  }

  if (compCategory === "post") {
    const width = meta.width_mm || meta.width || 100;
    const depth = meta.depth_mm || meta.depth || 75;
    // Extract length from sku or name
    let length = meta.length_mm || meta.length || "";
    if (!length) {
      const match = sku.match(/\d+$/);
      if (match) length = match[0];
    }
    return `${width}x${depth} ${material} Post${length ? ` ${length}mm` : ""}`;
  }
  
  if (compCategory === "rail") {
    const width = meta.width_mm || meta.width || 75;
    const thickness = meta.thickness_mm || meta.thickness || 38;
    const length = meta.length_mm || meta.length || 4800;
    const isCapping = name.toLowerCase().includes("capping") || sku.toLowerCase().includes("cap");
    if (isCapping) {
      return `${width}x${thickness} ${material} Capping Rail ${length}mm`;
    }
    return `${width}x${thickness} ${material} Rail ${length}mm`;
  }
  
  if (compCategory === "paling") {
    const width = meta.width_mm || meta.width || 100;
    const thickness = meta.thickness_mm || meta.thickness || 16;
    let length = meta.length_mm || meta.length || "";
    if (!length) {
      const match = sku.match(/\d+$/);
      if (match) length = match[0];
    }
    return `${width}x${thickness} Rough Sawn ${material} Paling${length ? ` ${length}mm` : ""}`;
  }
  
  if (
    ["fixing", "hardware", "accessory", "screw", "concrete", "fixing"].includes(compCategory)
  ) {
    // Concrete
    if (
      name.toLowerCase().includes("concrete") ||
      sku.toLowerCase().includes("concrete") ||
      compCategory === "concrete" ||
      name.toLowerCase().includes("rapid set") ||
      sku.toLowerCase().includes("-con-")
    ) {
      let weight = meta.weight_kg || meta.weight || "";
      if (!weight) {
        const match = sku.match(/\d+(?=kg)/i) || name.match(/\d+(?=kg)/i) || name.match(/rapid set (\d+)/i) || sku.match(/\d+$/);
        weight = match ? match[1] || match[0] : "20";
      }
      return `Rapid Set Concrete ${weight}kg`;
    }
    // Batten screw
    if (name.toLowerCase().includes("batten screw") || sku.toLowerCase().includes("screw") || compCategory === "screw") {
      let len = meta.length_mm || meta.length || "";
      if (!len) {
        const match = sku.match(/\d+/) || name.match(/\d+/);
        len = match ? match[0] : "100";
      }
      return `${len}mm Galvanised Batten Screw`;
    }
    // Nails
    if (name.toLowerCase().includes("nail") || sku.toLowerCase().includes("nail")) {
      let len = meta.length_mm || meta.length || "";
      if (!len) {
        const match = sku.match(/\d+/);
        len = match ? match[0] : "57";
      }
      let shank = "Ring Shank";
      if (material === "Hardwood") {
        shank = "Smooth Shank";
      }
      return `${len}mm ${shank} Gal Nail`;
    }
  }

  // Fallback to name or sku if we cannot parse
  return name || sku;
}

export interface PricingContext {
  supplierId: string;
  sku: string;
  tierCode: string;
  quantity: number;
  atTime?: string;
}

export async function resolvePriceCents(
  supabase: SupabaseClient,
  ctx: PricingContext
): Promise<number | null> {
  const { data, error } = await supabase.rpc("resolve_price_cents", {
    p_supplier_id: ctx.supplierId,
    p_sku: ctx.sku,
    p_tier_code: ctx.tierCode,
    p_quantity: ctx.quantity,
    p_at: ctx.atTime ?? new Date().toISOString()
  });

  if (error) {
    throw new Error(`Failed to resolve price cents via RPC: ${error.message}`);
  }

  return data;
}
