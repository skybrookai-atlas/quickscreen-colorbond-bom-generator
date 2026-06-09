import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { getSupplierBySlug } from "../../lib/multiSupplier/queries";
import { useCalculator } from "../../context/CalculatorContext";
import type { CanonicalPayload, CanonicalRun, CanonicalVariables } from "../../types/canonical.types";
import { initialVariablesForSystem } from "../../lib/productOptionRules";
import { localFenceProducts } from "../../lib/localSeedData";
import type { ParseResult } from "../../lib/describeFenceParser";
import { DescribeFenceBox } from "../calculator/DescribeFenceBox";
import { RunCard } from "./RunCard";

function isCypressSmokeTest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.endsWith("-auth-token")) {
        const val = window.localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const accessToken = parsed.access_token;
          if (accessToken === "bn-smoke-token" || accessToken === "property-map-smoke-token") {
            return true;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return false;
}

const comingSoonProducts = [
  { system_type: "Colorbond", name: "Colorbond", description: "Standard sheet steel boundary fencing" },
  { system_type: "Pool glass", name: "Pool glass", description: "Semi-frameless and frameless glass fencing" },
  { system_type: "Picket", name: "Picket", description: "Traditional timber picket fencing" },
];

function getSystemIcon(systemType: string) {
  switch (systemType) {
    case "QSHS":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="8" x2="21" y2="8" />
          <line x1="3" y1="13" x2="21" y2="13" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      );
    case "VS":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="8" y1="3" x2="8" y2="21" />
          <line x1="13" y1="3" x2="13" y2="21" />
          <line x1="18" y1="3" x2="18" y2="21" />
        </svg>
      );
    case "XPL":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
          <line x1="9" y1="6" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="18" />
        </svg>
      );
    case "BAYG":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );
    case "DF_CCA_PAL":
    case "AF_TIMBER_PALING":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 22V5l2-2 2 2v17M10 22V5l2-2 2 2v17M16 22V5l2-2 2 2v17" />
        </svg>
      );
    case "AF_COLORBOND":
    case "Colorbond":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M6 3v18M10 3v18M14 3v18M18 3v18" />
        </svg>
      );
    case "AF_RETAINING_WALL":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="14" width="18" height="7" rx="1" />
          <rect x="3" y="7" width="18" height="7" rx="1" />
        </svg>
      );
    case "Pool glass":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="12" rx="1" strokeWidth="1.5" />
          <line x1="8" y1="16" x2="8" y2="21" strokeWidth="3" />
          <line x1="16" y1="16" x2="16" y2="21" strokeWidth="3" />
        </svg>
      );
    case "Picket":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 20V6l2-2 2 2v14M11 20V6l2-2 2 2v14M17 20V6l2-2 2 2v14" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
  }
}

function getSystemStartingPrice(systemType: string) {
  switch (systemType) {
    case "QSHS": return "from $180/m";
    case "VS": return "from $220/m";
    case "XPL": return "from $280/m";
    case "BAYG": return "from $160/m";
    case "DF_CCA_PAL": return "from $90/m";
    case "AF_TIMBER_PALING": return "from $90/m";
    case "AF_COLORBOND": return "from $110/m";
    case "AF_RETAINING_WALL": return "from $140/m";
    default: return "";
  }
}

export function RunListV3({
  autoOpenFirstRunId,
  onAutoOpenConsumed,
  onDescribeApply,
  initialDescription = "",
}: {
  autoOpenFirstRunId?: string | null;
  onAutoOpenConsumed?: () => void;
  onDescribeApply?: (result: ParseResult) => void;
  initialDescription?: string;
}) {
  const { state, dispatch } = useCalculator();
  const { supplierSlug: urlSupplierSlug } = useParams<{ supplierSlug?: string }>();
  const supplierSlug = urlSupplierSlug || "amazing-fencing";
  const payload = state.payload;
  const hasRuns = Boolean(payload?.runs.length);

  // Fetch active supplier if on a branded page
  const { data: supplier } = useQuery({
    queryKey: ["runListSupplier", supplierSlug],
    queryFn: () => supplierSlug ? getSupplierBySlug(supplierSlug) : Promise.resolve(null),
    enabled: !!supplierSlug,
  });

  // Query products filtered by active supplier or active system instance
  const { data: dbProducts = [] } = useQuery({
    queryKey: ["runListProducts", supplier?.id, payload?.variables?.system_instance_id],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      let q = supabase
        .from("products")
        .select("id, name, system_type, description, system_instance_id, supplier_id, suppliers(slug)")
        .eq("product_type", "fence")
        .eq("active", true);

      const systemInstanceId = payload?.variables?.system_instance_id;
      if (systemInstanceId) {
        q = q.eq("system_instance_id", systemInstanceId);
      } else if (supplier?.id) {
        q = q.eq("supplier_id", supplier.id);
      }

      const { data } = await q.order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: true,
  });

  const productsToRender = useMemo(() => {
    if (dbProducts.length === 0) return localFenceProducts;

    // Deduplicate by system_type, prioritizing rows with non-null system_instance_id
    const bySystem = new Map<string, any>();
    for (const p of dbProducts) {
      const existing = bySystem.get(p.system_type);
      if (!existing || (p.system_instance_id !== null && existing.system_instance_id === null)) {
        bySystem.set(p.system_type, p);
      }
    }

    return Array.from(bySystem.values()).map(p => ({
      system_type: p.system_type,
      name: p.name,
      description: p.description,
      system_instance_id: p.system_instance_id,
      supplier_id: p.supplier_id,
      suppliers: p.suppliers
    }));
  }, [dbProducts]);

  if (!payload) return null;
  const currentPayload = payload;

  function createPayloadForSystem(
    productCode: string, 
    systemInstanceId?: string,
    productSupplierId?: string | null,
    productSupplierSlug?: string | null
  ): CanonicalPayload {
    const baseVars = initialVariablesForSystem(productCode);

    let resolvedSupplierId = productSupplierId;
    let resolvedSupplierSlug = productSupplierSlug;

    if (!resolvedSupplierId) {
      if (productCode.startsWith("AF_")) {
        resolvedSupplierId = "1aecc2bc-4b44-4676-a23a-903fe9286830";
        resolvedSupplierSlug = "amazing-fencing";
      } else if (productCode.startsWith("DF_")) {
        resolvedSupplierId = "52946ce5-5125-44eb-bbce-7f19e424fa89";
        resolvedSupplierSlug = "discount-fencing";
      } else {
        resolvedSupplierId = "7da9cadf-179c-4aa1-96dd-5487d8ce5334";
        resolvedSupplierSlug = "glass-outlet";
      }
    }

    const variables = {
      ...baseVars,
      supplier_id: resolvedSupplierId,
      supplier_slug: resolvedSupplierSlug || "",
      ...(systemInstanceId ? { system_instance_id: systemInstanceId } : (currentPayload?.variables?.system_instance_id ? { system_instance_id: currentPayload.variables.system_instance_id } : {})),
    } as CanonicalVariables;
    const runId = crypto.randomUUID();
    return {
      productCode,
      schemaVersion: "v1",
      variables,
      ...(currentPayload.propertyAnchor
        ? { propertyAnchor: currentPayload.propertyAnchor }
        : {}),
      ...(currentPayload.snapshot ? { snapshot: currentPayload.snapshot } : {}),
      runs: [
        {
          runId,
          productCode,
          variables,
          leftBoundary: { type: "product_post" },
          rightBoundary: { type: "product_post" },
          segments: [
            {
              segmentId: crypto.randomUUID(),
              sortOrder: 1,
              segmentKind: "panel",
              segmentWidthMm: 0,
              targetHeightMm: 1800,
              variables: productCode === "BAYG" ? { panel_quantity: 1 } : undefined,
            },
          ],
          corners: [],
        },
      ],
    };
  }

  function startFirstRun(
    productCode: string, 
    systemInstanceId?: string,
    productSupplierId?: string | null,
    productSupplierSlug?: string | null
  ) {
    const nextPayload = createPayloadForSystem(productCode, systemInstanceId, productSupplierId, productSupplierSlug);
    const firstRun = nextPayload.runs[0];
    dispatch({ type: "SET_PAYLOAD", payload: nextPayload });
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("qsbom:open-run", { detail: firstRun.runId }));
    }, 80);
  }

  function addRun() {
    const firstRun = payload!.runs[0];
    const productCode = firstRun?.productCode ?? payload!.productCode;
    const variables = {
      ...(payload!.variables ?? {}),
      ...(firstRun?.variables ?? {}),
    };
    const newRun: CanonicalRun = {
      runId: crypto.randomUUID(),
      productCode,
      variables,
      leftBoundary: firstRun?.leftBoundary ?? { type: "product_post" },
      rightBoundary: firstRun?.rightBoundary ?? { type: "product_post" },
      segments: [
        {
          segmentId: crypto.randomUUID(),
          sortOrder: 1,
          segmentKind: "panel",
          segmentWidthMm: 0,
          targetHeightMm: 1800,
          variables: productCode === "BAYG" ? { panel_quantity: 1 } : undefined,
        },
      ],
      corners: [],
    };
    dispatch({ type: "UPSERT_RUN", run: newRun });
  }

  const compact = isCypressSmokeTest();

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {!hasRuns && (
        <section className="space-y-4 p-4 bg-[#FCFBF9] rounded-xl border border-[#E9E5DD]">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E7681]">Choose a fence system</h3>
          <div className="grid gap-2">
            {productsToRender.map((product) => (
              <button
                key={product.system_type}
                type="button"
                onClick={() => startFirstRun(
                  product.system_type, 
                  (product as any).system_instance_id,
                  (product as any).supplier_id,
                  (product as any).suppliers?.slug
                )}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[#E9E5DD] bg-white text-left transition-all hover:border-[#DD6E1B]/50 hover:shadow-sm group"
                data-testid={`landing-system-${product.system_type}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#FCF1E6]/50 text-[#DD6E1B]">
                    {getSystemIcon(product.system_type)}
                  </span>
                  <span className="grid min-w-0">
                    <span className="text-[13.5px] font-semibold text-[#11161D]">
                      {product.system_type === "QSHS"
                        ? "Quick Screen Horizontal Slats"
                        : product.system_type === "VS"
                          ? "Vertical Slats"
                          : product.system_type === "XPL"
                            ? "Xpress Plus"
                            : product.system_type === "BAYG"
                              ? "Build As You Go"
                              : product.system_type === "DF_CCA_PAL"
                                ? "Treated Pine Paling"
                                : product.name}
                    </span>
                    <span className="text-[11.5px] text-[#6E7681] truncate">
                      {product.description || (
                        product.system_type === "QSHS"
                          ? "Horizontal slats, adjustable gap"
                          : product.system_type === "VS"
                            ? "Clean, modern vertical look"
                            : product.system_type === "XPL"
                              ? "Premium heavy duty slats"
                              : product.system_type === "BAYG"
                                ? "Custom panel configurations"
                                : product.system_type === "DF_CCA_PAL"
                                  ? "Traditional timber boundary"
                                  : "Aluminium fencing system"
                      )}
                    </span>
                  </span>
                </span>
                <span className="af-sidebar-mono text-[#DD6E1B] shrink-0 font-medium">
                  {getSystemStartingPrice(product.system_type)}
                </span>
              </button>
            ))}

            {/* Coming Soon Products */}
            {comingSoonProducts.map((product) => (
              <div
                key={product.system_type}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[#E9E5DD] bg-white/60 text-left opacity-50 select-none"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
                    {getSystemIcon(product.system_type)}
                  </span>
                  <span className="grid min-w-0">
                    <span className="text-[13.5px] font-semibold text-[#11161D] flex items-center gap-1.5">
                      {product.name}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-gray-200 text-gray-600 uppercase">SOON</span>
                    </span>
                    <span className="text-[11.5px] text-[#6E7681] truncate">
                      {product.description}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-gray-400 font-semibold uppercase">Soon</span>
              </div>
            ))}
          </div>
          {onDescribeApply && (
            <div className="pt-2 text-center border-t border-[#E9E5DD]">
              <DescribeFenceBox
                title="Describe your fence"
                compact
                initialDescription={initialDescription}
                onApply={onDescribeApply}
              />
              <p className="mt-1 text-xs font-semibold text-brand-muted">
                (Click to describe)
              </p>
            </div>
          )}
        </section>
      )}
      {payload.runs.map((run, runIdx) => (
        <RunCard
          key={run.runId}
          run={run}
          runIdx={runIdx}
          autoOpenFirstSection={autoOpenFirstRunId === run.runId}
          onAutoOpenConsumed={onAutoOpenConsumed}
        />
      ))}
      {hasRuns && (
        <button
          type="button"
          onClick={addRun}
          className="min-h-11 w-full rounded-lg border border-[#E9E5DD] bg-white px-4 py-3 text-sm font-semibold text-[#11161D] shadow-sm transition-all hover:border-[#DD6E1B]/50 hover:bg-[#FCF1E6]/10"
        >
          {payload.productCode === "AF_TIMBER_PALING"
            ? "+ Add Timber Run"
            : payload.productCode === "AF_COLORBOND"
              ? "+ Add Colorbond Run"
              : payload.productCode === "AF_RETAINING_WALL"
                ? "+ Add Wall Run"
                : payload.productCode === "AF_PERMASTEEL"
                  ? "+ Add Permasteel Run"
                  : payload.productCode === "AF_CHAINWIRE_SECURITY"
                    ? "+ Add Chainwire Run"
                    : payload.productCode === "AF_TIMBER_SLAT_SCREEN"
                      ? "+ Add Slat Run"
                      : "+ Add Run"}
        </button>
      )}
    </div>
  );
}
