// bom-calculator — v3 product-agnostic BOM engine
// Accepts a CanonicalPayload and returns priced BOM lines driven entirely by
// seed data in the rule_sets / product_rules / product_component_selectors / etc. tables.
//
// Pipeline (11 steps):
//   1.  CORS + JWT → resolveUserProfile → orgId, pricingTier
//   2.  Resolve user role (admin check) from profiles
//   3.  Parse + minimally validate payload
//   4.  Load engine data (product, rule_version, rules/selectors/companions/etc.)
//       per unique productCode — includes gate productCodes from segment.gateProductCode
//   5.  Normalise variables (defaults + colour codes)
//   6.  Run product_validations — error severity short-circuits the run
//   7.  Execute product_rules in stage order (derive → stock → accessory → component)
//       For gate_opening segments: use gate product engine data and gate variables
//   8.  Resolve SKUs via product_component_selectors (qty_key groups; first match wins)
//   9.  Expand product_companion_rules (auto-add accessories)
//   10. Evaluate product_warnings (non-blocking; populates warnings/errors/assumptions)
//   11. Aggregate lines by SKU+runId → price → return

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { extractJwt, resolveUserProfile } from "../_shared/auth.ts";
import type {
  CanonicalPayload,
  CanonicalRun,
  CanonicalSegment,
  SegmentTermination,
} from "../_shared/canonical.types.ts";
import { walkRunForPosts } from "../_shared/segmentTermination.ts";
import type { BOMUnit, PricingRule, PricingTier } from "../_shared/types.ts";
import {
  type EngineData,
  generateCanonicalCode,
  matchesJSON,
  mathjs,
  normaliseVariables,
  resolvePlaceholders,
  resolvePriceCents,
} from "./lib.ts";

// loadPricing removed in favor of resolvePriceCents SQL function



async function loadComponentNames(
  orgIds: string[],
  systemTypes: string[],
  supplierOrgId?: string,
): Promise<Map<string, { sku: string; name: string; description: string; defaultPrice: number | null; canonicalCode: string | null }>> {
  if (systemTypes.length === 0 && !supplierOrgId) return new Map();
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const allRows: any[] = [];

  // Query 1: Load product components for productOrgIds overlapping with systemTypes
  if (orgIds.length > 0 && systemTypes.length > 0) {
    let from = 0;
    let to = 999;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from("product_components")
        .select("sku, name, description, default_price, canonical_code, category, metadata")
        .in("org_id", orgIds)
        .eq("active", true)
        .overlaps("system_types", systemTypes)
        .range(from, to);

      if (error) throw new Error(`Component names lookup failed: ${error.message}`);
      allRows.push(...(data ?? []));
      if ((data ?? []).length < 1000) {
        hasMore = false;
      } else {
        from += 1000;
        to += 1000;
      }
    }
  }

  // Query 2: If supplierOrgId is provided, load all active components for the supplier (WITHOUT system_types filter)
  if (supplierOrgId) {
    let fromSupplier = 0;
    let toSupplier = 999;
    let hasMoreSupplier = true;
    while (hasMoreSupplier) {
      const { data, error } = await supabaseAdmin
        .from("product_components")
        .select("sku, name, description, default_price, canonical_code, category, metadata")
        .eq("org_id", supplierOrgId)
        .eq("active", true)
        .range(fromSupplier, toSupplier);

      if (error) throw new Error(`Supplier component names lookup failed: ${error.message}`);
      allRows.push(...(data ?? []));
      if ((data ?? []).length < 1000) {
        hasMoreSupplier = false;
      } else {
        fromSupplier += 1000;
        toSupplier += 1000;
      }
    }
  }

  const map = new Map<string, { sku: string; name: string; description: string; defaultPrice: number | null; canonicalCode: string | null }>();
  const explicitKeys = new Set<string>();

  for (const row of allRows) {
    const isExplicit = !!row.canonical_code;
    const canonicalCode = row.canonical_code || generateCanonicalCode(row.sku, row.name || "", row.category || "", row.metadata);
    const val = {
      sku: row.sku,
      name: row.name ?? "",
      description: row.description ?? "",
      defaultPrice: row.default_price ?? null,
      canonicalCode: canonicalCode,
    };
    map.set(row.sku, val);
    if (canonicalCode) {
      const parts = canonicalCode.split(",").map((s: string) => s.trim());
      for (const p of parts) {
        if (p) {
          if (isExplicit) {
            map.set(p, val);
            explicitKeys.add(p);
          } else {
            if (!explicitKeys.has(p)) {
              map.set(p, val);
            }
          }
        }
      }
    }
  }
  return map;
}

async function loadColourCodes(orgId: string): Promise<Record<string, string>> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await supabaseAdmin
    .from("colour_options")
    .select("value, short_code")
    .eq("org_id", orgId)
    .eq("active", true);
  return Object.fromEntries((data ?? []).map((r) => [r.value, r.short_code]));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BomLineItemV3 {
  sku: string;
  name: string;
  description: string;
  quantity: number;
  unit: BOMUnit;
  category: string;
  unitPrice: number | null;
  lineTotal: number | null;
  notes?: string;
  runId?: string;
  segmentId?: string;
  productCode?: string;
}

interface RunResult {
  runId: string;
  label: string;
  productCode: string;
  items: BomLineItemV3[];
}

interface TraceEntry {
  stage: string;
  rule_id: string;
  rule_name: string;
  expression: string;
  output_key?: string;
  output?: unknown;
  error?: string;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Step 1a — CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Resolve credentials and profile if JWT is present
    let orgId = "";
    let defaultTier = "tier1";
    let isUserAuthenticated = false;
    let userId = "";
    let role = "user";
    let isAdmin = false;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const jwt = authHeader.replace("Bearer ", "");
        // Resolve calling user profile
        const profile = await resolveUserProfile(jwt);
        orgId = profile.orgId;
        defaultTier = profile.pricingTier;
        userId = profile.userId;
        isUserAuthenticated = true;

        const { data: profileWithRole } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        role = profileWithRole?.role ?? "user";
        isAdmin = role === "admin";
      } catch (authErr) {
        console.log("Calculation request has invalid session token:", authErr.message);
      }
    }

    // Step 3 — parse + minimally validate payload
    const body = (await req.json()) as any;
    const { payload: bodyPayload, pricingTier: reqTier, debug, supplierId, supplierSlug, atTime } = body || {};

    let payload = bodyPayload;
    if (!payload && body && (body.productCode || body.runs)) {
      payload = body as any;
    }

    const pricingTier: PricingTier = reqTier ?? defaultTier ?? "tier1";
    const wantTrace = isAdmin && debug === true;

    // Resolve supplier scoping to get the effective orgId and actualSupplierId
    const resolvedSupplierId = payload?.variables?.supplier_id as string ?? supplierId;
    let effectiveOrgId = orgId;
    let actualSupplierId = resolvedSupplierId;
    const resolvedSupplierSlug = payload?.variables?.supplier_slug as string ?? supplierSlug;
    if (resolvedSupplierId || resolvedSupplierSlug) {
      let q = supabaseAdmin.from("suppliers").select("id, org_id");
      if (resolvedSupplierId) {
        q = q.eq("id", resolvedSupplierId);
      } else {
        q = q.eq("slug", resolvedSupplierSlug);
      }
      const { data: supplierRow } = await q.maybeSingle();
      if (supplierRow) {
        if (supplierRow.org_id) {
          effectiveOrgId = supplierRow.org_id;
        }
        actualSupplierId = supplierRow.id;
      }
    }

    if (!actualSupplierId) {
      const { data: goSupplier } = await supabaseAdmin
        .from("suppliers")
        .select("id")
        .eq("slug", "glass-outlet")
        .maybeSingle();
      actualSupplierId = goSupplier?.id;
    }

    // Fallback if effectiveOrgId is still empty (e.g., unauthenticated request with no supplier slug)
    if (!effectiveOrgId) {
      const { data: defaultOrg } = await supabaseAdmin
        .from("organisations")
        .select("id")
        .eq("slug", "glass-outlet")
        .maybeSingle();
      effectiveOrgId = defaultOrg?.id ?? "";
    }

    if (
      !payload?.productCode ||
      !Array.isArray(payload?.runs) ||
      payload.runs.length === 0
    ) {
      return Response.json(
        { error: "Invalid payload: productCode and runs[] are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Step 4 — load engine data per unique productCode (parallelised).
    // Collect all unique productCodes from every segment across all runs,
    // plus any per-run productCode overrides (v4 feature).
    const allProductCodes = [
      payload.productCode, // top-level fence product (for validation context)
      ...new Set(
        (payload.runs as CanonicalRun[]).flatMap((r) => [
          r.productCode, // per-run fence system override (v4, optional)
          ...r.segments.map((s: CanonicalSegment) => s.productCode),
        ]),
      ),
    ].filter((c) => c && typeof c === "string") as string[];
    const uniqueProductCodes = [...new Set(allProductCodes)];

    const engineDataMap = new Map<string, EngineData>();

    const productOrgIds = new Set<string>();

    await Promise.all(
      uniqueProductCodes.map(async (code) => {
        // Flat products model (post migration 022): one row per (org, system_type).
        let actualProduct = null;
        const { data: productWithOrg } = await supabaseAdmin
          .from("products")
          .select("id, system_type, product_type, org_id")
          .eq("org_id", effectiveOrgId)
          .eq("system_type", code)
          .maybeSingle();

        if (productWithOrg) {
          actualProduct = productWithOrg;
        } else {
          // Fallback: search for a public/active system instance product
          const { data: publicProduct } = await supabaseAdmin
            .from("products")
            .select("id, system_type, product_type, org_id")
            .eq("system_type", code)
            .eq("active", true)
            .not("system_instance_id", "is", null)
            .limit(1)
            .maybeSingle();

          if (publicProduct) {
            actualProduct = publicProduct;
          }
        }

        if (!actualProduct) {
          throw new Error(`Unknown productCode: ${code}`);
        }

        const productOrgId = actualProduct.org_id;
        productOrgIds.add(productOrgId);

        // Load current rule version via rule_set
        const { data: ruleSet } = await supabaseAdmin
          .from("rule_sets")
          .select("id")
          .eq("org_id", productOrgId)
          .eq("product_id", actualProduct.id)
          .maybeSingle();

        if (!ruleSet) {
          throw new Error(`No rule set found for product: ${code}`);
        }

        const { data: ruleVersion } = await supabaseAdmin
          .from("rule_versions")
          .select("id")
          .eq("org_id", productOrgId)
          .eq("rule_set_id", ruleSet.id)
          .eq("is_current", true)
          .maybeSingle();

        if (!ruleVersion) {
          throw new Error(`No current rule version for product: ${code}`);
        }

        // Parallel fetch of all engine tables
        const [
          { data: rules },
          { data: constraints },
          { data: variables },
          { data: validations },
          { data: selectors },
          { data: companions },
          { data: warnings },
        ] = await Promise.all([
          supabaseAdmin
            .from("product_rules")
            .select("id, name, stage, expression, output_key, priority")
            .eq("version_id", ruleVersion.id)
            .eq("active", true)
            .order("stage")
            .order("priority"),
          supabaseAdmin
            .from("product_constraints")
            .select("*")
            .eq("product_id", actualProduct.id)
            .eq("active", true),
          supabaseAdmin
            .from("product_variables")
            .select("*")
            .eq("product_id", actualProduct.id)
            .eq("active", true)
            .order("sort_order"),
          supabaseAdmin
            .from("product_validations")
            .select("*")
            .eq("product_id", actualProduct.id)
            .eq("active", true),
          supabaseAdmin
            .from("product_component_selectors")
            .select("*")
            .eq("product_id", actualProduct.id)
            .eq("active", true)
            .order("priority"),
          supabaseAdmin
            .from("product_companion_rules")
            .select("*")
            .eq("product_id", actualProduct.id)
            .eq("active", true)
            .order("priority"),
          supabaseAdmin
            .from("product_warnings")
            .select("*")
            .eq("product_id", actualProduct.id)
            .eq("active", true),
        ]);

        engineDataMap.set(code, {
          product: actualProduct,
          ruleVersion,
          rules: rules ?? [],
          constraints: constraints ?? [],
          variables: variables ?? [],
          validations: validations ?? [],
          selectors: selectors ?? [],
          companions: companions ?? [],
          warnings: warnings ?? [],
        });
      }),
    );

    // ─── Process runs ─────────────────────────────────────────────────────────

    const allLines: BomLineItemV3[] = [];
    const allSuggestions: BomLineItemV3[] = [];
    const runResults: RunResult[] = [];
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allAssumptions: string[] = [];
    const allSegmentDiagnostics: Array<{
      segmentId: string;
      runId: string;
      severity: "error" | "warning" | "info";
      message: string;
    }> = [];
    const allTrace: TraceEntry[] = [];
    // computed[runId][segmentId] = { actual_height_mm, ... }
    const computed: Record<
      string,
      Record<string, Record<string, unknown>>
    > = {};

    // Load DB-driven colour codes once per request; falls back to hardcoded map inside normaliseVariables if this fails
    let colourCodes: Record<string, string> | undefined;
    try {
      colourCodes = await loadColourCodes(effectiveOrgId);
    } catch {
      // non-fatal — normaliseVariables will use its hardcoded fallback
    }

    for (const run of payload.runs as CanonicalRun[]) {
      // Backward-compat shim: upgrade old segment_join{angleDeg>5} to system_corner.
      // Old saved quotes stored the turn angle in segment_join; we convert to a positive
      // (right-turn) interior angle. Remove once all production quotes have been re-saved.
      for (const seg of run.segments) {
        if (!seg.leftTermination) {
          seg.leftTermination = { kind: "system" };
        }
        if (!seg.rightTermination) {
          seg.rightTermination = { kind: "system" };
        }
        const lt = seg.leftTermination as SegmentTermination & { angleDeg?: number };
        if (lt.kind === "segment_join" && typeof lt.angleDeg === "number" && lt.angleDeg > 5) {
          seg.leftTermination = { kind: "system_corner", angleDeg: 180 - lt.angleDeg };
        }
        const rt = seg.rightTermination as SegmentTermination & { angleDeg?: number };
        if (rt.kind === "segment_join" && typeof rt.angleDeg === "number" && rt.angleDeg > 5) {
          seg.rightTermination = { kind: "system_corner", angleDeg: 180 - rt.angleDeg };
        }
      }
      // Determine the "primary" fence product for this run.
      // v4 runs may carry their own productCode; fall back to payload top-level.
      const fenceEngineData = engineDataMap.get(run.productCode ?? payload.productCode);
      if (!fenceEngineData) continue;

      // Merge job + run-level variables for the run context.
      // Precedence: run.variables > payload.variables (segment overrides applied later per-segment).
      const mergedRunVars = { ...payload.variables, ...(run.variables ?? {}) };
      const runCtx = normaliseVariables(
        mergedRunVars,
        fenceEngineData,
        colourCodes,
      );
      const runTrace: TraceEntry[] = [];
      const runLines: BomLineItemV3[] = [];
      const runSuggestions: BomLineItemV3[] = [];

      // Step 6 — validation pass (fence product)
      let runHasError = false;
      for (const validation of fenceEngineData.validations) {
        try {
          const result = mathjs.evaluate(validation.expression, { ...runCtx });
          if (result === false) {
            if (validation.severity === "error") {
              allErrors.push(validation.message);
              runHasError = true;
            } else {
              allWarnings.push(validation.message);
            }
          }
        } catch (err) {
          runTrace.push({
            stage: "validation",
            rule_id: validation.id,
            rule_name: validation.name,
            expression: validation.expression,
            error: String(err),
          });
        }
      }
      if (runHasError) continue;

      // ─── Run-level pre-pass: num_panels and num_posts per segment ────────────

      // Compute numPanels per fence segment
      const maxPanelWidthMm = Number(
        mergedRunVars["max_panel_width_mm"] ?? 2600,
      );
      const numPanelsBySegmentId = new Map<string, number>();
      for (const seg of run.segments) {
        if (seg.kind !== "fence") continue;
        const maxW = Number(
          seg.variables?.max_panel_width_mm ?? maxPanelWidthMm,
        );

        const w = seg.segmentWidthMm ?? 0;
        const panels = maxW > 0 && w > 0 ? Math.ceil(w / maxW) : 1;
        numPanelsBySegmentId.set(seg.segmentId, panels);
      }

      // Walk the run to assign posts per fence segment
      const numPostsBySegmentId = walkRunForPosts(run, numPanelsBySegmentId);

      // Compute panel_width_mm per segment (even distribution)
      const panelWidthBySegmentId = new Map<string, number>();

      for (const [segId, nPanels] of numPanelsBySegmentId.entries()) {
        const seg = run.segments.find((s) => s.segmentId === segId);
        if (!seg) continue;
        let w = seg.segmentWidthMm ?? 0;

        if (seg.variables?.post_size === "custom") {
          const numPosts = numPostsBySegmentId.get(seg.segmentId) ?? 0;
          w = w - numPosts * (seg.variables?.post_width_mm ?? 0);
          // w = segment.variables?.post_width_mm ?? 0;
        }
        panelWidthBySegmentId.set(
          segId,
          nPanels > 0 ? Math.round(w / nPanels) : 0,
        );
      }

      // Count corners: fence segments with system_corner left termination
      const sortedSegs = [...run.segments].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      let runCornerCount = 0;
      for (const seg of sortedSegs) {
        if (
          seg.kind === "fence" &&
          seg.leftTermination.kind === "system_corner"
        ) {
          runCornerCount++;
        }
      }

      // ─── Process segments ────────────────────────────────────────────────────

      for (const segment of run.segments as CanonicalSegment[]) {
        const resolvedProductCode = segment.productCode || (segment.kind === "gate" ? "QS_GATE" : (run.productCode ?? payload.productCode));
        const activeEngineData = engineDataMap.get(resolvedProductCode);

        if (!activeEngineData) {
          allAssumptions.push(
            `No engine data loaded for product: ${resolvedProductCode} — segment skipped`,
          );
          continue;
        }

        const activeProductCode = resolvedProductCode;

        // Build segment context: job ctx + segment overrides + geometry helpers
        const segVarsNorm = segment.variables
          ? normaliseVariables(segment.variables, activeEngineData, colourCodes, false)
          : {};

        // Termination flags from structured SegmentTermination objects
        const lt = segment.leftTermination;
        const rt = segment.rightTermination;

        const leftIsSystem = lt.kind === "system" ? 1 : 0;
        const rightIsSystem = rt.kind === "system" ? 1 : 0;
        const leftIsWall =
          lt.kind === "non_system" && lt.subtype === "wall" ? 1 : 0;
        const rightIsWall =
          rt.kind === "non_system" && rt.subtype === "wall" ? 1 : 0;
        const leftIsNonSystem = lt.kind === "non_system" ? 1 : 0;
        const rightIsNonSystem = rt.kind === "non_system" ? 1 : 0;
        const leftIsJoin = lt.kind === "segment_join" ? 1 : 0;
        const rightIsJoin = rt.kind === "segment_join" ? 1 : 0;
        // Unsigned magnitude for rule evaluation; signed values available for future inside/outside rules
        const leftAngleDeg = lt.kind === "system_corner" ? Math.abs(lt.angleDeg) : 0;
        const rightAngleDeg = rt.kind === "system_corner" ? Math.abs(rt.angleDeg) : 0;
        const leftIsCorner = lt.kind === "system_corner" ? 1 : 0;
        const rightIsCorner = rt.kind === "system_corner" ? 1 : 0;
        const leftAngleDegSigned = lt.kind === "system_corner" ? lt.angleDeg : 0;
        const rightAngleDegSigned = rt.kind === "system_corner" ? rt.angleDeg : 0;
        const systemTerminationCount = leftIsSystem + rightIsSystem;
        const nonSystemTerminationCount = leftIsNonSystem + rightIsNonSystem;
        const nonSystemWallCount = leftIsWall + rightIsWall;

        // Per-segment geometry from pre-pass
        const numPanels =
          segment.kind === "fence"
            ? (numPanelsBySegmentId.get(segment.segmentId) ?? 1)
            : 0;
        const panelWidthMm =
          segment.kind === "fence"
            ? (panelWidthBySegmentId.get(segment.segmentId) ?? 0)
            : 0;
        const numPosts =
          segment.kind === "fence"
            ? (numPostsBySegmentId.get(segment.segmentId) ?? 0)
            : 0;

        const postSizeNum = (() => {
          const ps = segVarsNorm["post_size"] ?? runCtx["post_size"];
          return typeof ps === "string"
            ? Number(ps)
            : typeof ps === "number"
              ? ps
              : 50;
        })();

        const segCtx: Record<string, unknown> =
          segment.kind === "gate"
            ? {
                ...normaliseVariables(
                  {
                    ...mergedRunVars,
                    ...(segment.variables ?? {}),
                    gate_width_mm: segment.segmentWidthMm,
                    gate_height_mm:
                      segment.targetHeightMm ??
                      (runCtx["target_height_mm"] as number),
                  },
                  activeEngineData,
                  colourCodes,
                ),
                // Geometry for gate
                left_is_system: leftIsSystem,
                right_is_system: rightIsSystem,
                left_is_wall: leftIsWall,
                right_is_wall: rightIsWall,
                left_is_join: leftIsJoin,
                right_is_join: rightIsJoin,
                corner_count: runCornerCount,
              }
            : {
                ...runCtx,
                ...segVarsNorm,
                // Segment geometry
                segment_width_mm: segment.segmentWidthMm,
                target_height_mm:
                  segment.targetHeightMm ?? runCtx["target_height_mm"],
                // Engine-provided geometry (not in seed rules)
                num_panels: numPanels,
                panel_width_mm: panelWidthMm,
                num_posts: numPosts,
                corner_count: runCornerCount,
                // Termination flags (1/0 booleans for mathjs)
                left_is_system: leftIsSystem,
                right_is_system: rightIsSystem,
                left_is_wall: leftIsWall,
                right_is_wall: rightIsWall,
                left_is_non_system: leftIsNonSystem,
                right_is_non_system: rightIsNonSystem,
                left_is_join: leftIsJoin,
                right_is_join: rightIsJoin,
                left_is_corner: leftIsCorner,
                right_is_corner: rightIsCorner,
                left_is_product_post: (leftIsSystem || leftIsCorner) ? 1 : 0,
                right_is_product_post: (rightIsSystem || rightIsCorner) ? 1 : 0,
                product_post_boundary_count: numPosts,
                left_angle_deg: leftAngleDeg,
                right_angle_deg: rightAngleDeg,
                left_angle_deg_signed: leftAngleDegSigned,
                right_angle_deg_signed: rightAngleDegSigned,
                system_termination_count: systemTerminationCount,
                non_system_termination_count: nonSystemTerminationCount,
                non_system_wall_count: nonSystemWallCount,
                // Numeric helpers
                post_size_num: postSizeNum,
                mounting_type_is_base_plate:
                  (segVarsNorm["mounting_type"] ?? runCtx["mounting_type"]) ===
                    "base_plate" ||
                  (segVarsNorm["mounting_method"] ??
                    runCtx["mounting_method"]) === "base_plate"
                    ? 1
                    : 0,
                mounting_type_is_core_drill:
                  (segVarsNorm["mounting_type"] ?? runCtx["mounting_type"]) ===
                    "core_drill" ||
                  (segVarsNorm["mounting_method"] ??
                    runCtx["mounting_method"]) === "core_drill"
                    ? 1
                    : 0,
                post_system_is_xpl: (() => {
                  const ps =
                    segVarsNorm["post_system"] ?? runCtx["post_system"];
                  return ps === "xpl" ? 1 : 0;
                })(),
                post_system_is_standard_50: (() => {
                  const ps =
                    segVarsNorm["post_system"] ?? runCtx["post_system"];
                  return ps === "standard_50" ? 1 : 0;
                })(),
                post_system_is_standard_65: (() => {
                  const ps =
                    segVarsNorm["post_system"] ?? runCtx["post_system"];
                  return ps === "standard_65" ? 1 : 0;
                })(),
                width_deduction_mm: 0,
                // Legacy aliases for backward compatibility with older seeds
                left_is_product_post: leftIsSystem,
                right_is_product_post: rightIsSystem,
                product_post_boundary_count: systemTerminationCount,
                corner_post_count: runCornerCount,
                wall_boundary_count: nonSystemWallCount,
              };
        const activeSegCtx = segCtx;

        // Step 7 — execute product_rules (derive → stock → accessory → component)
        for (const rule of activeEngineData.rules) {
          try {
            const output = mathjs.evaluate(rule.expression, activeSegCtx);
            activeSegCtx[rule.output_key] = output;
            if (wantTrace) {
              runTrace.push({
                stage: rule.stage,
                rule_id: rule.id,
                rule_name: rule.name,
                expression: rule.expression,
                output_key: rule.output_key,
                output,
              });
            }
          } catch (err) {
            // Graceful failure: log and continue
            runTrace.push({
              stage: rule.stage,
              rule_id: rule.id,
              rule_name: rule.name,
              expression: rule.expression,
              error: String(err),
            });
          }
        }

        // Stash computed values for this segment
        computed[run.runId] = computed[run.runId] ?? {};
        computed[run.runId][segment.segmentId] = {
          actual_height_mm: activeSegCtx["actual_height_mm"],
          num_slats: activeSegCtx["num_slats"],
          panel_width_mm: panelWidthMm,
          num_panels: numPanels,
          num_posts: numPosts,
          corner_count: runCornerCount,
          left_is_system: activeSegCtx["left_is_system"],
          right_is_system: activeSegCtx["right_is_system"],
          left_is_wall: activeSegCtx["left_is_wall"],
          right_is_wall: activeSegCtx["right_is_wall"],
          system_termination_count: activeSegCtx["system_termination_count"],
        };

        // Step 7a — segment-level warnings (evaluated against full post-rules segCtx)
        for (const warning of activeEngineData.warnings) {
          try {
            console.log("warning", warning, activeSegCtx);
            const debug = warning.warning_key === "hd_post_no_ppb";

            if (matchesJSON(warning.condition_json, activeSegCtx, debug)) {
              if (debug) {
                console.log("warning matched", warning, activeSegCtx);
              }
              allSegmentDiagnostics.push({
                segmentId: segment.segmentId,
                runId: run.runId,
                severity:
                  warning.severity === "error"
                    ? "error"
                    : warning.severity === "warning"
                      ? "warning"
                      : "info",
                message: warning.message,
              });
            }
          } catch {
            /* ignore malformed condition_json */
          }
        }

        console.log("allSegmentDiagnostics", allSegmentDiagnostics);

        // Step 8 — selector resolution.
        //
        // Selectors are grouped by (component_category, qty_key). Each unique group
        // is an independent line item. Within a group, the first selector whose
        // match_json satisfies the context wins (priority ASC = checked first).
        //
        // Selectors without a qty_key are skipped with an assumption entry.

        const selectorGroups = new Map<
          string,
          typeof activeEngineData.selectors
        >();
        for (const s of activeEngineData.selectors) {
          if (!s.qty_key) {
            allAssumptions.push(
              `Selector '${s.selector_key}' has no qty_key — skipped`,
            );
            continue;
          }
          const groupKey = `${s.component_category}::${s.qty_key}`;
          const existing = selectorGroups.get(groupKey) ?? [];
          existing.push(s);
          selectorGroups.set(groupKey, existing);
        }

        for (const [groupKey, groupSelectors] of selectorGroups) {
          const colonIdx = groupKey.indexOf("::");
          const category = groupKey.slice(0, colonIdx);
          const qty_key = groupKey.slice(colonIdx + 2);

          const qty = Number(activeSegCtx[qty_key]);
          if (!Number.isFinite(qty) || qty <= 0) continue;

          // Priority ASC — lower number = checked first
          const sorted = [...groupSelectors].sort(
            (a, b) => a.priority - b.priority,
          );

          let matched = false;
          for (const selector of sorted) {
            if (matchesJSON(selector.match_json, activeSegCtx)) {
              const sku = resolvePlaceholders(
                selector.sku_pattern,
                activeSegCtx,
              );
              runLines.push({
                sku,
                name: "",
                description: `${category} — ${sku}`,
                quantity: qty,
                unit: "each" as BOMUnit,
                category,
                unitPrice: 0,
                lineTotal: 0,
                runId: run.runId,
                segmentId: segment.segmentId,
                productCode: activeProductCode,
              });
              matched = true;
              break;
            }
          }

          if (!matched) {
            allAssumptions.push(
              `No SKU selector matched for category '${category}' qty_key '${qty_key}' (qty: ${qty}) in ${activeProductCode}`,
            );
          }
        }

        // Step 9 — companion expansion
        // Iterate over a snapshot of lines for this segment so new companion lines
        // don't trigger further companions.
        const linesSnapshot = [...runLines];
        for (const line of linesSnapshot) {
          if (!line.segmentId || line.segmentId !== segment.segmentId) continue;

          for (const companion of activeEngineData.companions) {
            if (line.category !== companion.trigger_category) continue;
            if (!matchesJSON(companion.trigger_match_json, activeSegCtx))
              continue;

            try {
              const companionCtx = {
                ...activeSegCtx,
                trigger_qty: line.quantity,
                [`${companion.trigger_category}_qty`]: line.quantity,
              };
              const qty = Number(
                mathjs.evaluate(companion.qty_formula, companionCtx),
              );
              if (!Number.isFinite(qty) || qty <= 0) continue;

              const sku = resolvePlaceholders(
                companion.add_sku_pattern,
                activeSegCtx,
              );
              const companionLine: BomLineItemV3 = {
                sku,
                name: "",
                description: `${companion.add_category} — ${sku}`,
                quantity: qty,
                unit: companion.is_pack ? "pack" : ("each" as BOMUnit),
                category: companion.add_category,
                unitPrice: 0,
                lineTotal: 0,
                runId: run.runId,
                segmentId: segment.segmentId,
                productCode: activeProductCode,
              };
              if (companion.is_suggestion) {
                runSuggestions.push(companionLine);
              } else {
                runLines.push(companionLine);
              }
            } catch (err) {
              allTrace.push({
                stage: "companion",
                rule_id: companion.id,
                rule_name: companion.rule_key,
                expression: companion.qty_formula,
                error: String(err),
              });
            }
          }
        }
      } // end segment loop

      // Step 10 — warnings pass (run-level, uses merged run context)
      for (const warning of fenceEngineData.warnings) {
        try {
          if (matchesJSON(warning.condition_json, runCtx)) {
            if (warning.severity === "error") {
              allErrors.push(warning.message);
            } else if (warning.severity === "warning") {
              allWarnings.push(warning.message);
            } else {
              allAssumptions.push(warning.message); // severity === 'info'
            }
          }
        } catch {
          /* ignore malformed condition_json */
        }
      }

      allLines.push(...runLines);
      allSuggestions.push(...runSuggestions);
      runResults.push({
        runId: run.runId,
        label: `Run ${runResults.length + 1} — ${payload.productCode}`,
        productCode: payload.productCode,
        items: runLines,
      });

      if (wantTrace) allTrace.push(...runTrace);
    } // end run loop

    // Short-circuit with empty BOM if blocking errors were raised
    if (allErrors.length > 0) {
      return Response.json(
        {
          lines: [],
          suggestions: [],
          runResults: [],
          gateItems: [],
          totals: { subtotal: 0, gst: 0, grandTotal: 0 },
          normalized_inputs: {},
          errors: allErrors,
          warnings: allWarnings,
          assumptions: allAssumptions,
          segmentDiagnostics: allSegmentDiagnostics,
          computed: {},
          trace: wantTrace ? allTrace : [],
          pricingTier,
          generatedAt: new Date().toISOString(),
        },
        { headers: corsHeaders },
      );
    }

    // Step 11 (aggregate) — merge lines by SKU + runId
    const aggregated = new Map<string, BomLineItemV3>();
    for (const line of allLines) {
      const key = `${line.sku}__${line.runId ?? ""}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        aggregated.set(key, { ...line });
      }
    }
    const aggregatedLines = [...aggregated.values()];

    // Aggregate suggestions separately (same de-dup logic, keyed by SKU only)
    const aggregatedSuggestionsMap = new Map<string, BomLineItemV3>();
    for (const line of allSuggestions) {
      const key = line.sku;
      const existing = aggregatedSuggestionsMap.get(key);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        aggregatedSuggestionsMap.set(key, { ...line });
      }
    }
    const aggregatedSuggestions = [...aggregatedSuggestionsMap.values()];

    // Separate gate items for the response envelope — driven by product_type from DB,
    // not a hardcoded list of product codes.
    const gateProductCodeSet = new Set(
      [...engineDataMap.entries()]
        .filter(([, ed]) => ed.product.product_type === "gate")
        .map(([code]) => code),
    );
    const gateItems = aggregatedLines.filter((l) =>
      gateProductCodeSet.has(l.productCode ?? ""),
    );

    // Step 12 — pricing + component name lookup (sequential dependencies due to SKU filtering)
    const componentNames = await loadComponentNames(
      Array.from(productOrgIds),
      uniqueProductCodes,
      effectiveOrgId,
    );

    // Dynamic canonical mapping: resolve canonical codes to the supplier's actual SKU
    for (const line of [...aggregatedLines, ...allLines, ...aggregatedSuggestions]) {
      const comp = componentNames.get(line.sku);
      if (comp) {
        if (line.sku !== comp.sku) {
          line.notes = `Mapped from canonical: ${line.sku}`;
          line.sku = comp.sku;
        }
      }
    }

    const resolvedSkus = Array.from(new Set([...aggregatedLines, ...allLines, ...aggregatedSuggestions].map(l => l.sku)));
    const canonicalCodes = Array.from(
      new Set(
        resolvedSkus
          .map(sku => componentNames.get(sku)?.canonicalCode)
          .filter((c): c is string => !!c)
      )
    );

    const atTimeParam = atTime ?? new Date().toISOString();

    // Backfill name/description on all lines from product_components
    for (const line of [...aggregatedLines, ...allLines, ...aggregatedSuggestions]) {
      const comp = componentNames.get(line.sku);
      if (comp) {
        line.name = comp.name;
        line.description = comp.description || comp.name;
      } else if (!line.name) {
        line.name = line.description; // preserve fallback
      }
    }

    async function resolveLinePrice(sku: string, quantity: number): Promise<number | null> {
      if (!actualSupplierId) return null;
      
      let priceCents = await resolvePriceCents(supabaseAdmin, {
        supplierId: actualSupplierId,
        sku,
        tierCode: pricingTier,
        quantity,
        atTime: atTimeParam
      });

      if (priceCents === null || priceCents === undefined) {
        const canonical = componentNames.get(sku)?.canonicalCode;
        if (canonical) {
          priceCents = await resolvePriceCents(supabaseAdmin, {
            supplierId: actualSupplierId,
            sku: canonical,
            tierCode: pricingTier,
            quantity,
            atTime: atTimeParam
          });
        }
      }

      if (priceCents !== null && priceCents !== undefined) {
        return priceCents / 100;
      }

      const defaultPrice = componentNames.get(sku)?.defaultPrice ?? null;
      if (defaultPrice !== null && defaultPrice > 0) {
        allAssumptions.push(`Using default_price for SKU: ${sku} (no tier pricing rule)`);
        return defaultPrice;
      }
      allWarnings.push(`No pricing rule found for SKU: ${sku}`);
      return null;
    }

    for (const line of aggregatedLines) {
      const price = await resolveLinePrice(line.sku, line.quantity);
      line.unitPrice = price;
      line.lineTotal = price !== null ? parseFloat((line.quantity * price).toFixed(2)) : null;
    }

    // Price suggestions (informational — not included in totals)
    for (const line of aggregatedSuggestions) {
      const price = await resolveLinePrice(line.sku, line.quantity);
      line.unitPrice = price;
      line.lineTotal = price !== null ? parseFloat((line.quantity * price).toFixed(2)) : null;
    }

    // Propagate pricing back into per-run items for the UI tabs
    for (const rr of runResults) {
      for (const item of rr.items) {
        const comp = componentNames.get(item.sku);
        if (comp) {
          item.name = comp.name;
          item.description = comp.description || comp.name;
          if (item.sku !== comp.sku) {
            item.sku = comp.sku;
          }
        }
        const price = await resolveLinePrice(item.sku, item.quantity);
        item.unitPrice = price;
        item.lineTotal = price !== null ? parseFloat((item.quantity * price).toFixed(2)) : null;
      }
    }

    // Step 13 — totals + response
    const subtotal = parseFloat(
      aggregatedLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0).toFixed(2),
    );
    const gst = parseFloat((subtotal * 0.1).toFixed(2));
    const grandTotal = parseFloat((subtotal + gst).toFixed(2));

    // Strip computed for non-admins (keep actual_height_mm + num_panels only)
    const strippedComputed: Record<
      string,
      Record<string, Record<string, unknown>>
    > = {};
    for (const [runId, segments] of Object.entries(computed)) {
      strippedComputed[runId] = {};
      for (const [segId, vals] of Object.entries(segments)) {
        strippedComputed[runId][segId] = isAdmin
          ? vals
          : {
              actual_height_mm: vals["actual_height_mm"],
              num_panels: vals["num_panels"],
              num_posts: vals["num_posts"],
              num_slats: vals["num_slats"],
              panel_width_mm: vals["panel_width_mm"],
            };
      }
    }

    return Response.json(
      {
        lines: aggregatedLines,
        suggestions: aggregatedSuggestions,
        runResults,
        gateItems,
        totals: { subtotal, gst, grandTotal },
        normalized_inputs: {},
        warnings: allWarnings,
        errors: allErrors,
        assumptions: allAssumptions,
        segmentDiagnostics: allSegmentDiagnostics,
        computed: strippedComputed,
        trace: wantTrace ? allTrace : [],
        pricingTier,
        generatedAt: new Date().toISOString(),
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("bom-calculator error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message.includes("Authorization") || message.includes("Invalid JWT")
        ? 401
        : 500;
    return Response.json({ error: message }, { status, headers: corsHeaders });
  }
});
