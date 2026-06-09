import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { localFenceProducts } from "../../lib/localSeedData";
import {
  initialVariablesForSystem,
} from "../../lib/productOptionRules";
import { useCalculator } from "../../context/CalculatorContext";
import type { CanonicalPayload } from "../../types/canonical.types";
import type { ReactNode } from "react";

interface FenceProduct {
  id: string;
  name: string;
  system_type: string;
  description: string | null;
  system_instance_id?: string;
  supplier_id?: string | null;
  suppliers?: { slug: string } | null;
}

function mergeFenceProducts(products: FenceProduct[]): FenceProduct[] {
  const bySystem = new Map<string, FenceProduct>();
  for (const product of products) {
    const existing = bySystem.get(product.system_type);
    if (!existing || (product.system_instance_id && !existing.system_instance_id)) {
      bySystem.set(product.system_type, product);
    }
  }
  for (const localProduct of localFenceProducts) {
    if (!bySystem.has(localProduct.system_type)) {
      bySystem.set(localProduct.system_type, localProduct as any);
    }
  }
  return [...bySystem.values()].sort((a, b) => {
    const aOrder = localFenceProducts.findIndex((p) => p.system_type === a.system_type);
    const bOrder = localFenceProducts.findIndex((p) => p.system_type === b.system_type);
    return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
  });
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

export function ProductSelectV3({
  mapAction,
  onProductSelected,
  supplierId,
}: {
  mapAction?: (selectDefaultProduct: () => void) => ReactNode;
  onProductSelected?: (payload: CanonicalPayload) => void;
  supplierId?: string;
}) {
  const { state, dispatch } = useCalculator();

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["v3FenceProducts", supplierId],
    queryFn: async () => {
      if (!isSupabaseConfigured) return localFenceProducts;

      let q = supabase
        .from("products")
        .select("id, name, system_type, description, system_instance_id, supplier_id, suppliers(slug)")
        .eq("product_type", "fence")
        .eq("active", true);

      if (supplierId) {
        q = q.eq("supplier_id", supplierId);
      }

      const { data, error } = await q.order("sort_order", { ascending: true });
      if (error) return localFenceProducts;
      return data && data.length > 0
        ? mergeFenceProducts(data as any[])
        : localFenceProducts;
    },
  });

  const currentCode = state.payload?.productCode ?? null;
  const selectDefaultProduct = () => {
    if (!currentCode && products[0]) selectProduct(products[0]);
  };

  function selectProduct(p: any) {
    const initialVariables = initialVariablesForSystem(p.system_type);
    const initialHeight = Number(initialVariables.target_height_mm ?? 1800);

    let resolvedSupplierId = p.supplier_id;
    let resolvedSupplierSlug = p.suppliers?.slug;

    if (!resolvedSupplierId) {
      if (p.system_type.startsWith("AF_")) {
        resolvedSupplierId = "1aecc2bc-4b44-4676-a23a-903fe9286830";
        resolvedSupplierSlug = "amazing-fencing";
      } else if (p.system_type.startsWith("DF_")) {
        resolvedSupplierId = "52946ce5-5125-44eb-bbce-7f19e424fa89";
        resolvedSupplierSlug = "discount-fencing";
      } else {
        resolvedSupplierId = "7da9cadf-179c-4aa1-96dd-5487d8ce5334";
        resolvedSupplierSlug = "glass-outlet";
      }
    }

    const variables = {
      ...initialVariables,
      supplier_id: resolvedSupplierId,
      supplier_slug: resolvedSupplierSlug || undefined,
      ...(p.system_instance_id ? { system_instance_id: p.system_instance_id } : (state.payload?.variables?.system_instance_id ? { system_instance_id: state.payload.variables.system_instance_id } : {})),
    };
    const initialPayload: CanonicalPayload = {
      productCode: p.system_type,
      schemaVersion: "v1",
      variables,
      ...(state.payload?.propertyAnchor
        ? { propertyAnchor: state.payload.propertyAnchor }
        : {}),
      ...(state.payload?.snapshot ? { snapshot: state.payload.snapshot } : {}),
      runs: [
        {
          runId: crypto.randomUUID(),
          productCode: p.system_type,
          variables,
          leftBoundary: { type: "product_post" },
          rightBoundary: { type: "product_post" },
          segments: [
            {
              segmentId: crypto.randomUUID(),
              sortOrder: 1,
              segmentKind: "panel",
              segmentWidthMm: 0,
              targetHeightMm: initialHeight,
              variables: p.system_type === "BAYG" ? { panel_quantity: 1 } : undefined,
            },
          ],
          corners: [],
        },
      ],
    };
    dispatch({ type: "SET_PAYLOAD", payload: initialPayload });
    onProductSelected?.(initialPayload);
  }

  return (
    <div data-testid="product-select" className="w-full space-y-4">
      <div className="flex flex-col gap-3">
        <div className="grid gap-2">
          {products.map((product) => {
            const selected = product.system_type === currentCode;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => selectProduct(product)}
                aria-pressed={selected}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-all ${
                  selected
                    ? "border-[#DD6E1B] bg-[#FCF1E6] shadow-sm"
                    : "border-[#E9E5DD] bg-white hover:border-[#DD6E1B]/50 hover:shadow-sm"
                }`}
                data-testid={`product-option-${product.system_type}`}
                title={product.description ?? product.name}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${selected ? "bg-[#FCF1E6] text-[#DD6E1B]" : "bg-gray-50 text-gray-500"}`}>
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
                                : product.system_type === "AF_TIMBER_PALING"
                                  ? "Treated Pine & Hardwood Paling"
                                  : product.system_type === "AF_COLORBOND"
                                    ? "Colorbond Steel"
                                    : product.system_type === "AF_RETAINING_WALL"
                                      ? "Timber Retaining Wall"
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
                                  : product.system_type === "AF_TIMBER_PALING"
                                    ? "Treated pine & hardwood paling boundary fence"
                                    : product.system_type === "AF_COLORBOND"
                                      ? "Standard Colorbond steel panel fence"
                                      : product.system_type === "AF_RETAINING_WALL"
                                        ? "Timber retaining wall sleepers & posts"
                                        : "Aluminium fencing system"
                      )}
                    </span>
                  </span>
                </span>
                <span className="af-sidebar-mono text-[#DD6E1B] shrink-0 font-medium">
                  {getSystemStartingPrice(product.system_type)}
                </span>
              </button>
            );
          })}

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
        {mapAction && <div className="mt-2">{mapAction(selectDefaultProduct)}</div>}
      </div>
    </div>
  );
}
