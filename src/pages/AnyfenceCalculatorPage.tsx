import { AppShell } from "../components/layout/AppShell";
import {
  CalculatorProvider,
  useCalculator,
} from "../context/CalculatorContext";
import { FenceConfigProvider } from "../context/FenceConfigContext";
import { GateProvider } from "../context/GateContext";
import { LayoutCanvasV3 } from "../components/calculator-v3/LayoutCanvasV3";
import { ClearJobConfirmDialog } from "../components/calculator-v3/ClearJobConfirmDialog";
import { SaveJobDialog } from "../components/calculator-v3/SaveJobDialog";
import { RightPaneTabs, type RightPaneView } from "../components/calculator-v3/RightPaneTabs";
import { PwaStatusBanners } from "../components/pwa/PwaStatusBanners";
import { BomV3PDFTemplate } from "../components/quote/BomV3PDFTemplate";
import { CalculatorV3Page } from "./CalculatorV3Page";
import { GatePositionModal } from "../components/calculator/GatePositionModal";
import { MapCapture } from "../components/calculator/MapCapture";
import { FenceTypeSidebar } from "../components/calculator/FenceTypeSidebar";
import { TimberPalingVariationSidebar } from "../components/calculator/TimberPalingVariationSidebar";
import { PriceBubble } from "../components/calculator/PriceBubble";
import { useBomCalculator } from "../hooks/useBomCalculator";
import { useBranding } from "../hooks/useBranding";
import { priceForSku } from "../lib/localBomCalculator";
import {
  initialVariablesForSystem,
} from "../lib/productOptionRules";
import { GATE_SEGMENT_STUB_KEYS } from "../lib/segmentTermination";
import {
  defaultGateBuildForMovement,
  defaultGateVariables,
} from "../lib/gateOptionRules";
import { validateGateWidth } from "../lib/gateConstraints";
import { shareOrDownloadPdfBlob } from "../lib/sharePdf";
import { MOBILE_BREAKPOINT } from "../lib/layoutBreakpoints";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../context/ProfileContext";
import { useQuote } from "../hooks/useQuote";
import { savedBomToEngineResult } from "../lib/savedBomToEngineResult";
import { jobNameFromQuote } from "../lib/quotePayload";
import {
  buildV3FenceConfig,
  buildV3QuoteBom,
  replaceV3QuoteRuns,
} from "../lib/persistV3Quote";
import { queryClient } from "../lib/queryClient";
import { LegacyQuoteError } from "../types/quote.types";
import {
  Download,
  Keyboard,
  Loader2,
  Printer,
  Share2,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import Papa from "papaparse";
import { pdf } from "@react-pdf/renderer";
import type {
  CalculatorBOMResult,
  BOMLineItem,
  BOMSource,
  ExtraItem,
} from "../types/bom.types";
import type { CanonicalPayload, CanonicalRun, CanonicalSegment } from "../types/canonical.types";

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Debounce window for auto BOM recalculation after payload edits. */
const BOM_RECALC_DEBOUNCE_MS = 500;

/** Stable key for BOM inputs — avoids recalc loops from new object references. */
function payloadBomKey(payload: CanonicalPayload): string {
  return JSON.stringify(payload);
}

// function isAngleDrawingWarning(warning: string): boolean {
//   const normalised = warning.toLowerCase();
//   return (
//     normalised.includes("custom angle") &&
//     (normalised.includes("supplier verification") || normalised.includes("verify components"))
//   );
// }

const formatHeaderMoney = (value: number) =>
  `$${new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;

function defaultSaveJobName(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
  return `Untitled Job (${date})`;
}

const lineKey = (line: BOMLineItem) =>
  `${line.sku}|${line.category}|${line.description}`;

const bomGroupKey = (line: BOMLineItem) =>
  `${line.sku}|${line.category}|${line.description}|${line.unit}`;

const ECONOMY_SLAT_PACK_SIZE = 96;

function priceForBomLine(line: Pick<BOMLineItem, "sku" | "unit">, quantity: number) {
  if (line.sku.startsWith("XP-6500-E65") && line.unit === "pack") {
    return roundMoney(priceForSku(line.sku, quantity * ECONOMY_SLAT_PACK_SIZE) * ECONOMY_SLAT_PACK_SIZE);
  }
  return priceForSku(line.sku, quantity);
}

function aggregateBomItems(items: BOMLineItem[]): BOMLineItem[] {
  const grouped = new Map<string, BOMLineItem>();
  for (const item of items) {
    const key = bomGroupKey(item);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item });
      continue;
    }
    const quantity = existing.quantity + item.quantity;
    const sources = mergeBomSources([
      ...(existing.sources ?? sourceFromLine(existing)),
      ...(item.sources ?? sourceFromLine(item)),
    ]);
    const isUnpriced = item.unitPrice === null || existing.unitPrice === null;
    let unitPrice: number | null = null;
    let lineTotal: number | null = null;

    if (isUnpriced) {
      unitPrice = null;
      lineTotal = null;
    } else {
      const p = priceForBomLine(item, quantity);
      if (p > 0) {
        unitPrice = p;
        lineTotal = roundMoney(p * quantity);
      } else {
        const lineTotalBeforeReprice = (existing.lineTotal ?? 0) + (item.lineTotal ?? 0);
        lineTotal = roundMoney(lineTotalBeforeReprice);
        unitPrice = roundMoney(lineTotal / Math.max(1, quantity));
      }
    }

    grouped.set(key, {
      ...existing,
      quantity,
      totalQty: quantity,
      sources,
      unitPrice,
      lineTotal,
      notes:
        existing.notes || item.notes
          ? Array.from(new Set([existing.notes, item.notes].filter(Boolean))).join("; ")
          : undefined,
    });
  }
  return [...grouped.values()];
}

function sourceFromLine(line: BOMLineItem): BOMSource[] {
  return [
    {
      scopeKind: line.productCode === "QS_GATE" || line.segmentId?.includes("gate") ? "gate" : "fence_run",
      scopeId: line.segmentId ?? line.runId ?? "global",
      scopeLabel: line.productCode === "QS_GATE" ? "Gate" : line.runId ? "Run" : "Global",
      qty: line.quantity,
    },
  ];
}

function mergeBomSources(sources: BOMSource[]): BOMSource[] {
  const merged = new Map<string, BOMSource>();
  for (const source of sources) {
    const key = `${source.scopeKind}|${source.scopeId}|${source.scopeLabel}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += source.qty;
    } else {
      merged.set(key, { ...source });
    }
  }
  return [...merged.values()];
}

function deriveLineForSources(
  line: BOMLineItem,
  predicate: (source: BOMSource) => boolean,
): BOMLineItem | null {
  const sources = (line.sources ?? sourceFromLine(line)).filter(predicate);
  if (sources.length === 0) return null;
  const quantity = sources.reduce((sum, source) => sum + source.qty, 0);
  const isUnpriced = line.unitPrice === null;
  const unitPrice = isUnpriced ? null : priceForBomLine(line, quantity);
  return {
    ...line,
    quantity,
    totalQty: quantity,
    sources,
    unitPrice,
    lineTotal: unitPrice !== null ? roundMoney(unitPrice * quantity) : null,
  };
}

function filterLinesForScope(
  items: BOMLineItem[],
  predicate: (source: BOMSource) => boolean,
): BOMLineItem[] {
  return items
    .map((item) => deriveLineForSources(item, predicate))
    .filter(Boolean) as BOMLineItem[];
}

function gateLabel(runIndex: number, gateIndex: number) {
  return `R${runIndex + 1} G${gateIndex + 1}`;
}

// const COLOUR_NAMES: Record<string, string> = {
//   B: "Black Satin",
//   MN: "Monument Matt",
//   G: "Woodland Grey Matt",
//   SM: "Surfmist Matt",
//   W: "Pearl White Gloss",
//   BS: "Basalt Satin",
//   D: "Dune Satin",
//   M: "Mill",
//   P: "Primrose",
//   PB: "Paperbark",
//   S: "Palladium Silver Pearl",
//   KWI: "Kwila",
//   WRC: "Western Red Cedar",
// };

// function colourName(code: unknown) {
//   const value = String(code ?? "B");
//   return stripParentheticalDispatchCode(COLOUR_NAMES[value] ?? value);
// }

// const MOUNTING_LABELS: Record<string, string> = {
//   in_ground: "Concreted in ground",
//   base_plate: "Base plated",
//   core_drill: "Core drilled",
// };

// function mountingLabel(value: unknown) {
//   const key = String(value ?? "in_ground");
//   return MOUNTING_LABELS[key] ?? key.replace(/_/g, " ");
// }

// function gateHardwareLabel(gate: CanonicalSegment) {
//   const vars = gate.variables ?? {};
//   const movement = gateMovementOrDefault(vars[GATE_SEGMENT_STUB_KEYS.gateMovement]);
//   if (movement === "sliding") {
//     return [
//       optionLabel(SLIDING_TRACK_OPTIONS, vars[GATE_SEGMENT_STUB_KEYS.slidingTrackType] ?? "XPSG-6000-TRACK-ST"),
//       optionLabel(SLIDING_GUIDE_OPTIONS, vars[GATE_SEGMENT_STUB_KEYS.slidingGuideType] ?? "XPSG-GUIDE"),
//       optionLabel(SLIDING_CATCH_OPTIONS, vars[GATE_SEGMENT_STUB_KEYS.slidingCatchType] ?? "XPSG-CATCH-U"),
//     ].join(" / ");
//   }
//   return [
//     optionLabel(HINGE_OPTIONS, vars[GATE_SEGMENT_STUB_KEYS.hingeType] ?? "TC-H-AT-HD-B"),
//     optionLabel(LATCH_OPTIONS, vars[GATE_SEGMENT_STUB_KEYS.latchType] ?? "LL-DL-KA"),
//     optionLabel(DROP_BOLT_OPTIONS, vars[GATE_SEGMENT_STUB_KEYS.dropBoltType] ?? "none"),
//     optionLabel(GATE_STOP_OPTIONS, vars[GATE_SEGMENT_STUB_KEYS.gateStopType] ?? "none"),
//   ]
//     .filter((label) => label && !/^No /.test(label))
//     .join(" / ");
// }

function initialRunPaneWidth() {
  if (typeof window === "undefined") return 480;
  const stored = Number(window.localStorage.getItem("qsg-run-pane-width"));
  if (Number.isFinite(stored) && stored > 0) return stored;
  return Math.round(Math.min(680, Math.max(390, window.innerWidth / 3)));
}

const CUSTOMER_MODE_KEY = "qsbom-customer-mode";

function initialCustomerMode() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CUSTOMER_MODE_KEY) === "true";
}

// function createInitialPayload(systemType = "QSHS"): CanonicalPayload {
//   const initialVariables = initialVariablesForSystem(systemType);
//   const initialHeight = Number(initialVariables.target_height_mm ?? 1800);
//   return {
//     productCode: systemType,
//     schemaVersion: "v1",
//     variables: initialVariables,
//     runs: [
//       {
//         runId: crypto.randomUUID(),
//         productCode: systemType,
//         variables: initialVariables,
//         leftBoundary: { type: "product_post" },
//         rightBoundary: { type: "product_post" },
//         segments: [
//           {
//             segmentId: crypto.randomUUID(),
//             sortOrder: 1,
//             segmentKind: "panel",
//             segmentWidthMm: 0,
//             targetHeightMm: initialHeight,
//             variables: systemType === "BAYG" ? { panel_quantity: 1 } : undefined,
//           },
//         ],
//         corners: [],
//       },
//     ],
//   };
// }

function createEmptyPayload(systemType = "QSHS"): CanonicalPayload {
  return {
    productCode: systemType,
    schemaVersion: "v1",
    variables: initialVariablesForSystem(systemType),
    runs: [],
  };
}

type PendingParsedGate = NonNullable<NonNullable<CanonicalPayload["job"]>["pendingGates"]>[number];

// function productCodeFromParsedSystem(systemType: ParsedSystemType | undefined) {
//   if (systemType === "VS" || systemType === "XPL" || systemType === "BAYG") return systemType;
//   return "QSHS";
// }

// function mountingMethodToVariables(value: string | undefined) {
//   if (value === "base_plated") return "base_plate";
//   if (value === "core_drilled") return "core_drill";
//   return "in_ground";
// }

// function boundariesFromTermination(value: string | undefined) {
//   if (value === "wall_wall") return { left: "wall", right: "wall" } as const;
//   if (value === "post_wall") return { left: "product_post", right: "wall" } as const;
//   return { left: "product_post", right: "product_post" } as const;
// }

// function gateMovementFromParsedGate(gate: NonNullable<ParseResult["attributes"]["gates"]>["value"][number]) {
//   if (gate.kind === "sliding") return "sliding" as const;
//   if (gate.kind === "double_swing") return "double_swing" as const;
//   return "single_swing" as const;
// }

// function gateLeavesForOpening(movement: ReturnType<typeof gateMovementFromParsedGate>, openingWidthMm: number) {
//   if (movement === "sliding") return [{ widthMm: Math.max(1, Math.round(openingWidthMm)) }];
//   const hingeGapMm = hingeGapForSku("TC-H-AT-HD-B");
//   const latchGapMm = latchGapForSku("LL-DL-KA");
//   const clearOpeningMm = clearGateOpeningWidthMm({
//     movement,
//     openingWidthMm,
//     hingeGapMm,
//     latchGapMm,
//   });
//   if (movement === "double_swing") {
//     const first = Math.round(clearOpeningMm / 2);
//     return [
//       { widthMm: Math.max(1, first) },
//       { widthMm: Math.max(1, Math.round(clearOpeningMm) - first) },
//     ];
//   }
//   return [{ widthMm: Math.max(1, Math.round(clearOpeningMm)) }];
// }

function runLengthMm(run: CanonicalRun) {
  return run.segments.reduce((sum, segment) => {
    if (segment.segmentKind === "gate_opening") return sum;
    const qty =
      run.productCode === "BAYG"
        ? Math.max(1, Math.round(Number(segment.variables?.panel_quantity ?? 1)))
        : 1;
    return sum + Number(segment.segmentWidthMm ?? 0) * qty;
  }, 0);
}

// function useAnimatedNumber(target: number) {
//   const [value, setValue] = useState(target);
//   const previous = useRef(target);

//   useEffect(() => {
//     const start = previous.current;
//     const delta = target - start;
//     if (Math.abs(delta) < 0.01) {
//       setValue(target);
//       previous.current = target;
//       return;
//     }

//     let frame = 0;
//     const startTime = performance.now();
//     const duration = 420;
//     const tick = (now: number) => {
//       const progress = Math.min(1, (now - startTime) / duration);
//       const eased = 1 - Math.pow(1 - progress, 3);
//       setValue(start + delta * eased);
//       if (progress < 1) {
//         frame = requestAnimationFrame(tick);
//       } else {
//         previous.current = target;
//       }
//     };
//     frame = requestAnimationFrame(tick);
//     return () => cancelAnimationFrame(frame);
//   }, [target]);

//   return value;
// }

function getDiscountPercentage(
  itemCategory: string,
  userType: string | null,
  userPricingTier: string | null,
  pricingTiers: any[] | undefined
): number {
  if (userType !== 'contractor') {
    return 0; // Retail visitor gets 0%
  }
  const tierName = userPricingTier || 'tier1';
  const tier = pricingTiers?.find(t => t.tier_name.toLowerCase() === tierName.toLowerCase());
  if (!tier) {
    return 0; // Fallback
  }
  const categoryDiscounts = tier.product_category_discounts || {};
  if (itemCategory && categoryDiscounts[itemCategory] !== undefined) {
    return Number(categoryDiscounts[itemCategory]);
  }
  return Number(tier.default_discount_percentage || 0);
}

function AnyfenceCalculatorContent({ quoteId }: { quoteId?: string }) {
  const { state, dispatch } = useCalculator();
  const payload = state.payload;
  const bomMutation = useBomCalculator();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { role, userType, orgSlug, pricingTier, isLoading: profileLoading } = useProfile();

  useEffect(() => {
    if (user && !profileLoading && location.pathname === "/") {
      if (role === "admin") {
        navigate("/admin/portal", { replace: true });
      } else if (userType === "contractor") {
        navigate("/contractor", { replace: true });
      } else if ((userType === "supplier_staff" || userType === "supplier_client") && orgSlug && orgSlug !== "glass-outlet") {
        navigate(`/s/${orgSlug}`, { replace: true });
      } else {
        navigate("/fence-calculator", { replace: true });
      }
    }
  }, [user, role, userType, orgSlug, profileLoading, location.pathname, navigate]);
  const quoteQuery = useQuote(quoteId);
  const hydratedQuoteIdRef = useRef<string | null>(null);
  const skipAutoBomRef = useRef(false);
  const bomRequestIdRef = useRef(0);
  const lastCalcPayloadKeyRef = useRef<string | null>(null);
  const bomMutateAsyncRef = useRef(bomMutation.mutateAsync);
  bomMutateAsyncRef.current = bomMutation.mutateAsync;

  const { supplierSlug, instanceSlug } = useParams<{ supplierSlug?: string; instanceSlug?: string }>();
  const activeSupplierSlug = supplierSlug || (payload?.variables?.supplier_slug as string | undefined) || "amazing-fencing";
  const { branding, logoUrl, supplier: supplierBrand } = useBranding(activeSupplierSlug);

  // Fetch active system instance
  const { data: systemInstance, isLoading: loadingInstance } = useQuery({
    queryKey: ["calculatorInstance", supplierBrand?.id, instanceSlug],
    queryFn: async () => {
      if (!supplierBrand || !instanceSlug) return null;
      const { data, error } = await supabase
        .from("system_instances")
        .select("*, system_archetypes(slug, variable_schema)")
        .eq("supplier_id", supplierBrand.id)
        .eq("slug", instanceSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!supplierBrand && !!instanceSlug,
  });

  // Query product system_type associated with this system instance
  const { data: instanceProduct } = useQuery({
    queryKey: ["calculatorInstanceProduct", systemInstance?.id],
    queryFn: async () => {
      if (!systemInstance) return null;
      const { data, error } = await supabase
        .from("products")
        .select("system_type")
        .eq("system_instance_id", systemInstance.id)
        .eq("product_type", "fence")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!systemInstance,
  });

  // Fetch pricing tiers for the supplier
  const { data: pricingTiers } = useQuery({
    queryKey: ["pricingTiers", supplierBrand?.id],
    queryFn: async () => {
      if (!supplierBrand?.id) return [];
      const { data, error } = await supabase
        .from("pricing_tiers")
        .select("*")
        .eq("supplier_id", supplierBrand.id);
      if (error) throw error;
      return data;
    },
    enabled: !!supplierBrand?.id,
  });

  // Fetch contractor installation rates
  const { data: installRates } = useQuery({
    queryKey: ["installRates", user?.id, systemInstance?.id],
    queryFn: async () => {
      if (!user?.id || !systemInstance?.id) return null;
      const { data, error } = await supabase
        .from("contractor_install_rates")
        .select("*")
        .eq("contractor_id", user.id)
        .eq("calculator_id", systemInstance.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!systemInstance?.id && !!supplierBrand?.installs_enabled,
  });

  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [lineEdits, setLineEdits] = useState<Record<string, number | null>>({});
  const [lineOverrides, setLineOverrides] = useState<Record<string, Partial<BOMLineItem>>>({});
  const [saving, setSaving] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  // const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [customerMode, setCustomerMode] = useState(initialCustomerMode);
  const [jobName, setJobName] = useState("");
  const [activeBomSummary, setActiveBomSummary] = useState<{
    label: string;
    subtotal: number;
    gst: number;
    grandTotal: number;
  } | null>(null);

  const [selectedFenceType, setSelectedFenceType] = useState<string | null>(null);

  // Sync selectedFenceType with payload if loaded from a quote/redirect
  useEffect(() => {
    if (payload?.productCode === "AF_TIMBER_PALING" && selectedFenceType !== "timber-paling") {
      setSelectedFenceType("timber-paling");
    }
  }, [payload?.productCode, selectedFenceType]);

  const handleSelectFenceType = useCallback((type: string) => {
    if (type === "timber-paling") {
      setSelectedFenceType("timber-paling");
      if (payload) {
        const defaultVars = {
          timber_type: "treated_pine",
          paling_style: "butted",
          max_panel_width_mm: 2400,
          paling_gap_mm: 0,
          rail_profile: "75x38",
          rail_count: 3,
          target_height_mm: 1800,
        };

        const hasRuns = payload.runs.some((r) => r.segments.length > 0);
        const nextPayload = {
          ...payload,
          productCode: "AF_TIMBER_PALING",
          variables: {
            ...payload.variables,
            ...defaultVars,
          },
          runs: hasRuns
            ? payload.runs.map((r) => ({
                ...r,
                productCode: "AF_TIMBER_PALING",
                variables: {
                  ...r.variables,
                  max_panel_width_mm: 2400,
                  rail_profile: "75x38",
                  rail_count: 3,
                  target_height_mm: 1800,
                },
              }))
            : [
                {
                  runId: crypto.randomUUID(),
                  productCode: "AF_TIMBER_PALING",
                  variables: {
                    max_panel_width_mm: 2400,
                    rail_profile: "75x38",
                    rail_count: 3,
                    target_height_mm: 1800,
                  },
                  leftBoundary: { type: "product_post" as const },
                  rightBoundary: { type: "product_post" as const },
                  segments: [
                    {
                      segmentId: crypto.randomUUID(),
                      sortOrder: 1,
                      segmentKind: "panel" as const,
                      segmentWidthMm: 12000, // 12m default run
                      targetHeightMm: 1800,
                    },
                  ],
                  corners: [],
                },
              ],
        };
        dispatch({ type: "SET_PAYLOAD", payload: nextPayload });
      }
    }
  }, [payload, dispatch]);
  const runPaneWidth = initialRunPaneWidth();
  const [mobileLayout, setMobileLayout] = useState(false);
  // const [mobileTab, setMobileTab] = useState<MobileCalculatorTab>(INITIAL_MOBILE_CALCULATOR_TAB);
  const [rightPaneView, setRightPaneView] = useState<RightPaneView>("bom");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  // const [autoOpenFirstSectionRunId, setAutoOpenFirstSectionRunId] = useState<string | null>(null);
  const [includeMapInBomPrint, setIncludeMapInBomPrint] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [clearJobDialogOpen, setClearJobDialogOpen] = useState(false);
  const [saveJobDialogOpen, setSaveJobDialogOpen] = useState(false);
  // const [showGuestSaveModal, setShowGuestSaveModal] = useState(false);
  const [gatePositionTarget, setGatePositionTarget] = useState<PendingParsedGate | null>(null);
  // const [bunningsEnabled, setBunningsEnabled] = useState(() => {
  //   if (typeof window === "undefined") return false;
  //   return window.localStorage.getItem("qsg-bunnings-enabled") === "true";
  // });

  // const handleBunningsToggle = () => {
  //   const nextVal = !bunningsEnabled;
  //   setBunningsEnabled(nextVal);
  //   window.localStorage.setItem("qsg-bunnings-enabled", String(nextVal));
  //   window.dispatchEvent(new Event("storage"));
  //   toast.success(nextVal ? "Bunnings lookup integration enabled!" : "Bunnings integration disabled.");
  // };

  // useEffect(() => {
  //   const handleStorage = () => {
  //     setBunningsEnabled(window.localStorage.getItem("qsg-bunnings-enabled") === "true");
  //   };
  //   window.addEventListener("storage", handleStorage);
  //   return () => window.removeEventListener("storage", handleStorage);
  // }, []);
  // const handleActiveBomSummaryChange = useCallback(
  //   (summary: { label: string; subtotal: number; gst: number; grandTotal: number }) => {
  //     setActiveBomSummary({
  //       label: summary.label === "All Items" ? "All items" : summary.label,
  //       subtotal: summary.subtotal,
  //       gst: summary.gst,
  //       grandTotal: summary.grandTotal,
  //     });
  //   },
  //   [],
  // );

  useEffect(() => {
    if (!quoteId || !quoteQuery.data) return;
    if (hydratedQuoteIdRef.current === quoteId) return;
    hydratedQuoteIdRef.current = quoteId;
    const { quote, payload: loadedPayload } = quoteQuery.data;
    dispatch({ type: "SET_PAYLOAD", payload: loadedPayload });
    setJobName(jobNameFromQuote(quote.fence_config, quote.customer_ref));
    const bomResult = savedBomToEngineResult(quote.bom, quote.updated_at);
    if (bomResult) {
      dispatch({ type: "SET_BOM_RESULT", result: bomResult });
      skipAutoBomRef.current = true;
      lastCalcPayloadKeyRef.current = payloadBomKey(loadedPayload);
    }
    setIntroDismissed(true);
    setRightPaneView("bom");
    // setMobileTab("bom");
  }, [quoteId, quoteQuery.data, dispatch]);


  useEffect(() => {
    const updateLayout = () => setMobileLayout(window.innerWidth < MOBILE_BREAKPOINT);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CUSTOMER_MODE_KEY, customerMode ? "true" : "false");
  }, [customerMode]);

  // useEffect(() => {
  //   const viewport = window.visualViewport;
  //   if (!viewport) return;
  //   const updateOffset = () => {
  //     setKeyboardOffset(
  //       Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
  //     );
  //   };
  //   updateOffset();
  //   viewport.addEventListener("resize", updateOffset);
  //   viewport.addEventListener("scroll", updateOffset);
  //   return () => {
  //     viewport.removeEventListener("resize", updateOffset);
  //     viewport.removeEventListener("scroll", updateOffset);
  //   };
  // }, []);

  useEffect(() => {
    if (rightPaneView !== "map") return;
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
  }, [rightPaneView]);

  useEffect(() => {
    if (!mapExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapExpanded]);

  useEffect(() => {
    const openGateFromMap = (event: Event) => {
      const gateId = (event as CustomEvent<string>).detail;
      if (!gateId) return;
      setRightPaneView("map");
      setMapExpanded(false);
      if (mobileLayout) {
        // setMobileTab("job");
      }
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("qsbom:open-segment", { detail: gateId }));
      }, 80);
    };
    window.addEventListener("qsbom:edit-gate-from-map", openGateFromMap);
    return () => window.removeEventListener("qsbom:edit-gate-from-map", openGateFromMap);
  }, [mobileLayout]);

  const handleRightPaneChange = useCallback((view: RightPaneView) => {
    setRightPaneView(view);
    if (view !== "map") setMapExpanded(false);
  }, []);

  // const handleMobileTabChange = useCallback(
  //   (tab: MobileCalculatorTab) => {
  //     setMobileTab(tab);
  //     if (tab === "map") {
  //       if (!payload) {
  //         dispatch({ type: "SET_PAYLOAD", payload: createInitialPayload("QSHS") });
  //         dispatch({ type: "SET_ENTRY_METHOD", entryMethod: "draw" });
  //       }
  //       setIntroDismissed(true);
  //       setRightPaneView("map");
  //       window.setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
  //       return;
  //     }
  //     if (tab === "bom") {
  //       setRightPaneView("bom");
  //       setMapExpanded(false);
  //       return;
  //     }
  //     setRightPaneView("bom");
  //     setMapExpanded(false);
  //   },
  //   [dispatch, payload],
  // );

  // function handleResizeStart() {
  //   let latestWidth = runPaneWidth;
  //   const onMove = (event: MouseEvent) => {
  //     const maxWidth = Math.min(760, window.innerWidth * 0.58);
  //     const minWidth = Math.min(390, Math.max(320, window.innerWidth - 360));
  //     latestWidth = Math.round(Math.min(maxWidth, Math.max(minWidth, event.clientX)));
  //     setRunPaneWidth(latestWidth);
  //   };
  //   const onUp = () => {
  //     window.localStorage.setItem("qsg-run-pane-width", String(latestWidth));
  //     window.removeEventListener("mousemove", onMove);
  //     window.removeEventListener("mouseup", onUp);
  //   };
  //   window.addEventListener("mousemove", onMove);
  //   window.addEventListener("mouseup", onUp);
  // }

  const handleConfirmMapCapture = useCallback((anchor: {
    lat: number;
    lng: number;
    address: string;
    snapshot: any;
  }) => {
    const productCode = "QSHS";
    const initialPayload = createEmptyPayload(productCode);
    initialPayload.propertyAnchor = {
      lat: anchor.lat,
      lng: anchor.lng,
      address: anchor.address,
    };
    initialPayload.snapshot = anchor.snapshot;
    if (!jobName.trim()) {
      setJobName(anchor.address.split(",")[0]);
    }
    dispatch({ type: "SET_PAYLOAD", payload: initialPayload });
    dispatch({ type: "SET_ENTRY_METHOD", entryMethod: "draw" });
    setIntroDismissed(true);
    setRightPaneView("map");
  }, [dispatch, jobName]);

  const handleSkipMapCapture = useCallback(() => {
    const productCode = "QSHS";
    const initialPayload = createEmptyPayload(productCode);
    initialPayload.propertyAnchor = undefined;
    initialPayload.snapshot = undefined;
    dispatch({ type: "SET_PAYLOAD", payload: initialPayload });
    dispatch({ type: "SET_ENTRY_METHOD", entryMethod: "draw" });
    setIntroDismissed(true);
    setRightPaneView("map");
  }, [dispatch]);

  // function handleApplyDescription(result: ParseResult) {
  //   const parsedSystem = result.attributes.systemType?.value;
  //   const productCode = productCodeFromParsedSystem(parsedSystem);
  //   const base = payload ?? createEmptyPayload(productCode);
  //   const baseRun = base.runs[0] ?? createInitialPayload(productCode).runs[0];
  //   const runId = baseRun.runId;
  //   const initialVariables = initialVariablesForSystem(productCode);
  //   const variables = normaliseVariablesForSystem(productCode, {
  //     ...initialVariables,
  //     ...(base.variables ?? {}),
  //     ...(baseRun.variables ?? {}),
  //     ...(result.attributes.heightMm?.value
  //       ? { target_height_mm: result.attributes.heightMm.value }
  //       : {}),
  //     ...(result.attributes.slatSizeMm?.value
  //       ? { slat_size_mm: result.attributes.slatSizeMm.value }
  //       : {}),
  //     ...(result.attributes.gapMm?.value ? { slat_gap_mm: result.attributes.gapMm.value } : {}),
  //     ...(result.attributes.colourCode?.value
  //       ? {
  //         colour_code: result.attributes.colourCode.value,
  //         post_colour_code: result.attributes.colourCode.value,
  //       }
  //       : {}),
  //     ...(result.attributes.mountingMethod?.value
  //       ? {
  //         mounting_type: mountingMethodToVariables(result.attributes.mountingMethod.value),
  //         mounting_method: mountingMethodToVariables(result.attributes.mountingMethod.value),
  //       }
  //       : {}),
  //   });
  //   const boundaries = boundariesFromTermination(result.attributes.termination?.value);
  //   const firstSegment = baseRun.segments.find((segment) => segment.segmentKind !== "gate_opening");
  //   const targetHeightMm = Number(
  //     variables.target_height_mm ??
  //     firstSegment?.targetHeightMm ??
  //     1800,
  //   );
  //   const parsedGates = result.attributes.gates?.value ?? [];
  //   const gateWidths = parsedGates.map((gate) => {
  //     if (gate.widthMm && gate.widthMm > 0) return Math.round(gate.widthMm);
  //     if (gate.kind === "double_swing") return 1800;
  //     if (gate.kind === "sliding") return 3000;
  //     return 900;
  //   });
  //   const totalGateWidth = gateWidths.reduce((sum, width) => sum + width, 0);
  //   const parsedRunLength = Number(result.attributes.runLengthMm?.value ?? 0);
  //   const fallbackRunLength =
  //     parsedGates.length > 0 ? totalGateWidth + (parsedGates.length + 1) * 1000 : 0;
  //   const runLength = Math.max(
  //     parsedRunLength,
  //     Number(firstSegment?.segmentWidthMm ?? 0),
  //     fallbackRunLength,
  //   );
  //   const panelTotal = Math.max(0, runLength - totalGateWidth);
  //   const panelCount = parsedGates.length > 0 ? parsedGates.length + 1 : 1;
  //   const panelWidths =
  //     parsedGates.length > 0
  //       ? Array.from({ length: panelCount }, () => Math.max(1, Math.round(panelTotal / panelCount)))
  //       : [Math.max(0, Math.round(runLength))];
  //   if (parsedGates.length > 0 && panelWidths.length > 1) {
  //     const used = panelWidths.reduce((sum, width) => sum + width, 0);
  //     panelWidths[panelWidths.length - 1] = Math.max(1, panelWidths[panelWidths.length - 1] + Math.round(panelTotal - used));
  //   }
  //   const newSegments: CanonicalSegment[] = [];
  //   let sortOrder = 1;
  //   const useSingleCanvasSection = parsedGates.length > 0 && runLength > 0;
  //   const straightGeometry = {
  //     points: [
  //       { x: 0, y: 0 },
  //       { x: Math.max(1, runLength / 10), y: 0 },
  //     ],
  //   };
  //   const canvasMeta = useSingleCanvasSection
  //     ? {
  //       canvasSegmentIndex: 0,
  //       sourceSegmentLengthMm: Math.max(1, Math.round(runLength)),
  //     }
  //     : {};
  //   const makePanelSegment = (widthMm: number): CanonicalSegment => ({
  //     segmentId: crypto.randomUUID(),
  //     sortOrder: sortOrder++,
  //     segmentKind: "panel",
  //     segmentWidthMm: Math.max(0, Math.round(widthMm)),
  //     targetHeightMm,
  //     ...canvasMeta,
  //     variables: productCode === "BAYG" ? { panel_quantity: 1 } : undefined,
  //   });

  //   if (parsedGates.length === 0) {
  //     newSegments.push(makePanelSegment(panelWidths[0] ?? 0));
  //   } else {
  //     let distanceCursorMm = 0;
  //     for (let index = 0; index < parsedGates.length; index++) {
  //       const precedingPanel = makePanelSegment(panelWidths[index] ?? 1);
  //       newSegments.push(precedingPanel);
  //       distanceCursorMm += precedingPanel.segmentWidthMm ?? 0;
  //       const gate = parsedGates[index];
  //       const gateWidth = gateWidths[index] ?? 900;
  //       const movement = gateMovementFromParsedGate(gate);
  //       const gateCenterFraction =
  //         runLength > 0 ? Math.max(0, Math.min(1, (distanceCursorMm + gateWidth / 2) / runLength)) : 0.5;
  //       const gateVariables = {
  //         ...defaultGateVariables({ ...variables, productCode }, targetHeightMm),
  //         [GATE_SEGMENT_STUB_KEYS.gateMovement]: movement,
  //         [GATE_SEGMENT_STUB_KEYS.gateBuild]: defaultGateBuildForMovement(
  //           movement,
  //           productCode === "VS",
  //         ),
  //         [GATE_SEGMENT_STUB_KEYS.leafCount]: movement === "double_swing" ? 2 : 1,
  //         [GATE_SEGMENT_STUB_KEYS.dropBoltType]: movement === "double_swing" ? "SS-0300DB-B" : "none",
  //         parent_section_id: precedingPanel.segmentId,
  //       };
  //       newSegments.push({
  //         segmentId: crypto.randomUUID(),
  //         sortOrder: sortOrder++,
  //         segmentKind: "gate_opening",
  //         segmentWidthMm: gateWidth,
  //         targetHeightMm,
  //         gateProductCode: "QS_GATE",
  //         positionOnSegment: gateCenterFraction,
  //         gateAnchor: "center",
  //         ...canvasMeta,
  //         variables: gateVariables,
  //         leaves: gateLeavesForOpening(movement, gateWidth),
  //       });
  //       distanceCursorMm += gateWidth;
  //     }
  //     newSegments.push(makePanelSegment(panelWidths[panelWidths.length - 1] ?? 1));
  //   }
  //   const cornerCount = Math.max(0, Math.round(Number(result.attributes.cornerCount?.value ?? 0)));
  //   const corners = Array.from({ length: cornerCount }, () => ({
  //     cornerId: crypto.randomUUID(),
  //     afterSegmentId: newSegments.find((segment) => segment.segmentKind !== "gate_opening")?.segmentId ?? crypto.randomUUID(),
  //     type: "90" as const,
  //   }));
  //   const nextRun: CanonicalRun = {
  //     ...baseRun,
  //     runId,
  //     productCode,
  //     variables,
  //     leftBoundary: { type: boundaries.left },
  //     rightBoundary: { type: boundaries.right },
  //     segments: newSegments,
  //     corners,
  //     corners,
  //     geometry: straightGeometry,
  //   };
  //   const nextPayload: CanonicalPayload = {
  //     ...base,
  //     productCode,
  //     variables,
  //     job: {
  //       ...(base.job ?? {}),
  //       description: result.description,
  //       pendingGates: [],
  //     },
  //     runs: [nextRun, ...base.runs.slice(1)],
  //   };
  //   dispatch({ type: "SET_PAYLOAD", payload: nextPayload });
  //   dispatch({ type: "SET_ENTRY_METHOD", entryMethod: "describe" });
  //   setIntroDismissed(true);
  //   setAutoOpenFirstSectionRunId(nextRun.runId);
  //   setRightPaneView("bom");
  //   setMapExpanded(false);
  //   setMobileTab("bom");
  //   toast.success("Description applied");
  // }

  function handleConfirmGatePosition(gate: PendingParsedGate, distanceFromStartMm: number) {
    if (!payload) return;
    const nextRuns = payload.runs.map((run) => {
      if (run.runId !== gate.runId) return run;
      const fenceSegments = run.segments.filter((segment) => segment.segmentKind !== "gate_opening");
      const firstSegment = fenceSegments[0];
      const totalLength = runLengthMm(run);
      const gateWidth = gate.widthMm ?? 1000;
      if (!firstSegment || totalLength <= gateWidth) return run;
      const leftWidth = Math.max(1, Math.round(distanceFromStartMm - gateWidth / 2));
      const rightWidth = Math.max(1, Math.round(totalLength - distanceFromStartMm - gateWidth / 2));
      const baseVars = {
        ...(payload.variables ?? {}),
        ...(run.variables ?? {}),
        productCode: run.productCode,
      };
      const movement =
        gate.kind === "sliding" ? "sliding" : gate.kind === "double_swing" ? "double_swing" : "single_swing";
      const targetHeightMm =
        firstSegment.targetHeightMm ?? Number(run.variables?.target_height_mm ?? payload.variables.target_height_mm ?? 1800);
      const gateVariables = {
        ...defaultGateVariables(baseVars, targetHeightMm),
        [GATE_SEGMENT_STUB_KEYS.gateMovement]: movement,
        [GATE_SEGMENT_STUB_KEYS.gateBuild]: defaultGateBuildForMovement(
          movement,
          run.productCode === "VS",
        ),
        [GATE_SEGMENT_STUB_KEYS.leafCount]: movement === "double_swing" ? 2 : 1,
        [GATE_SEGMENT_STUB_KEYS.dropBoltType]: movement === "double_swing" ? "SS-0300DB-B" : "none",
      };
      const leftSegment: CanonicalSegment = {
        ...firstSegment,
        sortOrder: 1,
        segmentWidthMm: leftWidth,
      };
      const gateSegment: CanonicalSegment = {
        segmentId: gate.id,
        sortOrder: 2,
        segmentKind: "gate_opening",
        segmentWidthMm: gateWidth,
        targetHeightMm,
        gateProductCode: "QS_GATE",
        variables: gateVariables,
      };
      const rightSegment: CanonicalSegment = {
        ...firstSegment,
        segmentId: crypto.randomUUID(),
        sortOrder: 3,
        segmentWidthMm: rightWidth,
      };
      return {
        ...run,
        segments: [leftSegment, gateSegment, rightSegment],
      };
    });
    dispatch({
      type: "SET_PAYLOAD",
      payload: {
        ...payload,
        job: {
          ...(payload.job ?? {}),
          pendingGates: payload.job?.pendingGates?.filter((item) => item.id !== gate.id) ?? [],
        },
        runs: nextRuns,
      },
    });
    setGatePositionTarget(null);
    toast.success("Gate position confirmed");
  }

  // function handlePropertyAnchorConfirmed(anchor: {
  //   anchorLat: number;
  //   anchorLng: number;
  //   formattedAddress: string;
  //   snapshot: NonNullable<CanonicalPayload["snapshot"]>;
  // }) {
  //   if (!payload) return;
  //   dispatch({
  //     type: "SET_PAYLOAD",
  //     payload: {
  //       ...payload,
  //       propertyAnchor: {
  //         lat: anchor.anchorLat,
  //         lng: anchor.anchorLng,
  //         address: anchor.formattedAddress,
  //       },
  //       snapshot: anchor.snapshot,
  //     },
  //   });
  //   setRightPaneView("map");
  //   toast.success("Property view captured");
  // }

  function handleMapSnapshotChange(snapshot: NonNullable<CanonicalPayload["snapshot"]>) {
    dispatch({ type: "SET_MAP_SNAPSHOT", snapshot });
  }

  // async function handleSwitchEconomyToStandard(item: BOMLineItem) {
  //   if (!payload) return;
  //   const nextPayload = {
  //     ...payload,
  //     runs: payload.runs.map((run) => {
  //       if (item.runId && run.runId !== item.runId) return run;
  //       const runVariables =
  //         run.variables?.finish_family === "economy"
  //           ? { ...run.variables, finish_family: "standard" }
  //           : run.variables;
  //       return {
  //         ...run,
  //         variables: runVariables,
  //         segments: run.segments.map((segment) => {
  //           const variables = segment.variables ?? {};
  //           const inheritsRunEconomy = run.variables?.finish_family === "economy" && variables.finish_family == null;
  //           if (variables.finish_family !== "economy" && !inheritsRunEconomy) return segment;
  //           return {
  //             ...segment,
  //             variables: {
  //               ...variables,
  //               finish_family: "standard",
  //             },
  //           };
  //         }),
  //       };
  //     }),
  //   };

  //   dispatch({ type: "SET_PAYLOAD", payload: nextPayload });
  //   toast.success("Switched Economy slats to Standard.");
  // }

  const lastBom = state.bomResult;
  // const baseBomLines = ((lastBom?.lines as BOMLineItem[]) ?? []);
  // const suggestedAccessories = useMemo(
  //   () => (payload && lastBom ? suggestAccessories(payload, baseBomLines) : []),
  //   [payload, lastBom, baseBomLines],
  // );
  const applyLineEdits = (items: BOMLineItem[]) =>
    items
      .map((line) => {
        const key = lineKey(line);
        const edit = lineEdits[key];
        if (edit === null) return null;
        
        let updated = { ...line };
        if (typeof edit === "number") {
          const isUnpriced = line.unitPrice === null;
          const unitPrice = isUnpriced ? null : priceForBomLine(line, edit);
          updated = {
            ...updated,
            quantity: edit,
            unitPrice,
            lineTotal: unitPrice !== null ? roundMoney(unitPrice * edit) : null,
            notes: line.notes ? `${line.notes}; edited` : "edited",
          };
        }
        
        const override = lineOverrides[key];
        if (override) {
          const qty = updated.quantity;
          const price = override.unitPrice !== undefined ? override.unitPrice : updated.unitPrice;
          updated = {
            ...updated,
            sku: override.sku ?? updated.sku,
            description: override.description ?? updated.description,
            unitPrice: price,
            lineTotal: price !== null ? roundMoney(price * qty) : null,
          };
        }
        return updated;
      })
      .filter(Boolean) as BOMLineItem[];

  // const handleAssignCustomSku = useCallback((item: BOMLineItem, override: { sku: string; description: string; unitPrice: number }) => {
  //   setLineOverrides((prev) => ({
  //     ...prev,
  //     [lineKey(item)]: override,
  //   }));
  //   toast.success(`Assigned custom SKU ${override.sku} to item.`);
  // }, []);

  const bomResultForTabs: CalculatorBOMResult | null = lastBom
    ? (() => {
      const baseAllItems = applyLineEdits(
        aggregateBomItems((lastBom.lines as BOMLineItem[]) ?? []),
      );
      const extraLineItems: BOMLineItem[] = extraItems.map((e) => ({
        category: "accessory",
        sku: e.sku ?? e.id,
        description: e.description,
        quantity: e.quantity,
        unit: "each",
        unitPrice: e.unitPrice,
        lineTotal: roundMoney(e.unitPrice * e.quantity),
        notes: "added manually",
        sources: [
          {
            scopeKind: "global",
            scopeId: "manual-extras",
            scopeLabel: "Manual extras",
            qty: e.quantity,
          },
        ],
        totalQty: e.quantity,
      }));
      const rawRunResults =
        (lastBom.runResults as Array<{
          runId: string;
          items: BOMLineItem[];
        }>) ?? [];
      const runResults = payload?.runs.map((run) => ({
        runId: run.runId,
        items: applyLineEdits(
          filterLinesForScope(baseAllItems, (source) =>
            source.scopeKind === "fence_run" && source.scopeId === run.runId,
          ),
        ),
      })) ?? rawRunResults.map((r) => ({
        runId: r.runId,
        items: applyLineEdits(aggregateBomItems(r.items)),
      }));
      const gateResults =
        payload?.runs.flatMap((run, runIndex) => {
          let gateIndex = 0;
          return run.segments.flatMap((segment) => {
            if (segment.segmentKind !== "gate_opening") return [];
            const label = gateLabel(runIndex, gateIndex++);
            return [
              {
                id: segment.segmentId,
                label,
                items: applyLineEdits(
                  filterLinesForScope(
                    baseAllItems,
                    (source) => source.scopeKind === "gate" && source.scopeId === segment.segmentId,
                  ),
                ),
              },
            ];
          });
        }) ?? [];
      const gateSegments =
        payload?.runs.flatMap((run) =>
          run.segments.filter((segment) => segment.segmentKind === "gate_opening"),
        ) ?? [];
      const runScopedGateItems = rawRunResults.flatMap((runResult) =>
        runResult.items.filter((item) =>
          item.sources?.some((source) => source.scopeKind === "gate") ||
          item.productCode === "QS_GATE" ||
          gateSegments.some((segment) => segment.segmentId === item.segmentId),
        ),
      );
      const rawGateItems =
        baseAllItems.some((item) => item.sources?.some((source) => source.scopeKind === "gate"))
          ? filterLinesForScope(baseAllItems, (source) => source.scopeKind === "gate")
          : runScopedGateItems.length > 0
            ? runScopedGateItems
            : ((lastBom.gateItems as BOMLineItem[]) ?? []);
      const gateItems = applyLineEdits(aggregateBomItems(rawGateItems));
      const allItems = aggregateBomItems([...baseAllItems, ...extraLineItems]);

      const discountItem = (item: BOMLineItem) => {
        if (userType !== 'contractor') return item;
        const discountPct = getDiscountPercentage(
          item.category,
          userType,
          pricingTier,
          pricingTiers
        );
        if (discountPct > 0) {
          const factor = 1 - discountPct / 100;
          const discountedUnitPrice = item.unitPrice !== null ? roundMoney(item.unitPrice * factor) : null;
          const discountedLineTotal = discountedUnitPrice !== null ? roundMoney(discountedUnitPrice * item.quantity) : null;
          return {
            ...item,
            unitPrice: discountedUnitPrice,
            lineTotal: discountedLineTotal,
            notes: item.notes 
              ? `${item.notes}; ${discountPct}% trade discount applied` 
              : `${discountPct}% trade discount applied`,
          };
        }
        return item;
      };

      const discountedAllItems = allItems.map(discountItem);
      const discountedRunResults = runResults.map(r => ({
        ...r,
        items: r.items.map(discountItem)
      }));
      const discountedGateResults = gateResults.map(g => ({
        ...g,
        items: g.items.map(discountItem)
      }));
      const discountedGateItems = gateItems.map(discountItem);

      const total = roundMoney(
        discountedAllItems.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0),
      );
      const gst = roundMoney(total * 0.1);
      const grandTotal = roundMoney(total + gst);

      return {
        runResults: discountedRunResults,
        gateResults: discountedGateResults,
        gateItems: discountedGateItems,
        allItems: discountedAllItems,
        total,
        gst,
        grandTotal,
        pricingTier:
          (lastBom.pricingTier as CalculatorBOMResult["pricingTier"]) ??
          "tier1",
        generatedAt:
          (lastBom.generatedAt as string) ?? new Date().toISOString(),
      };
    })()
    : null;

  const totalLengthM = useMemo(() => {
    if (!payload) return 0;
    return payload.runs.reduce((sum, run) => sum + runLengthMm(run), 0) / 1000;
  }, [payload]);

  async function saveJobWithName(requestedJobName: string): Promise<boolean> {
    if (!payload) return false;
    const customerRef = requestedJobName.trim() || defaultSaveJobName();
    const quoteBom = buildV3QuoteBom(bomResultForTabs);
    const fenceConfig = buildV3FenceConfig(customerRef, payload);

    if (!isSupabaseConfigured) {
      localStorage.setItem(
        `glass-calc-job-${Date.now()}`,
        JSON.stringify({
          jobName: customerRef,
          payload,
          bom: quoteBom,
          savedAt: new Date().toISOString(),
        }),
      );
      setJobName(customerRef);
      toast.success("Job saved locally for this browser");
      return true;
    }

    setSaving(true);
    try {
      if (!user) {
        localStorage.setItem(
          `glass-calc-job-${Date.now()}`,
          JSON.stringify({
            jobName: customerRef,
            payload,
            bom: quoteBom,
            savedAt: new Date().toISOString(),
          }),
        );
        setJobName(customerRef);
        toast.success("Job saved locally for this browser");
        return true;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      const orgId = profile?.org_id;
      if (!orgId) throw new Error("No organisation found for this user.");

      const isUpdate = !!quoteId;
      const propertyAnchor = payload.propertyAnchor
        ? {
            lat: payload.propertyAnchor.lat,
            lng: payload.propertyAnchor.lng,
            address: payload.propertyAnchor.address,
          }
        : null;

      const installationCost = supplierBrand?.installs_enabled && installRates
        ? totalLengthM * Number(installRates.rate_per_meter)
        : null;

      if (isUpdate) {
        const { error: updateError } = await supabase
          .from("quotes")
          .update({
            customer_ref: customerRef,
            property_anchor: propertyAnchor,
            fence_config: fenceConfig,
            gates: [],
            bom: quoteBom,
            installation_cost: installationCost,
            updated_at: new Date().toISOString(),
          })
          .eq("id", quoteId);
        if (updateError) throw updateError;

        await replaceV3QuoteRuns(supabase, orgId, quoteId, payload);

        await queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
        await queryClient.invalidateQueries({ queryKey: ["quotes"] });
        setJobName(customerRef);
        toast.success("Job updated");
      } else {
        const { data: quote, error: quoteError } = await supabase
          .from("quotes")
          .insert({
            org_id: orgId,
            user_id: user.id,
            customer_ref: customerRef,
            property_anchor: propertyAnchor,
            fence_config: fenceConfig,
            gates: [],
            bom: quoteBom,
            contact: {},
            notes: "Saved from v3 job calculator",
            status: "draft",
            installation_cost: installationCost,
          })
          .select("id")
          .single();
        if (quoteError) throw quoteError;

        await replaceV3QuoteRuns(supabase, orgId, quote.id, payload);

        await queryClient.invalidateQueries({ queryKey: ["quotes"] });
        setJobName(customerRef);
        toast.success("Job saved");
        navigate(`/quote/${quote.id}`);
      }
      return true;
    } catch (error) {
      toast.error("Couldn't save — please try again");
      console.error(error);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // const handleGuestSaveLocal = () => {
  //   setShowGuestSaveModal(false);
  //   const customerRef = jobName.trim() || defaultSaveJobName();
  //   const quoteBom = buildV3QuoteBom(bomResultForTabs);
  //   localStorage.setItem(
  //     `glass-calc-job-${Date.now()}`,
  //     JSON.stringify({
  //       jobName: customerRef,
  //       payload,
  //       bom: quoteBom,
  //       savedAt: new Date().toISOString(),
  //     }),
  //   );
  //   setJobName(customerRef);
  //   toast.success("Job saved locally in your browser cache!");
  // };

  // async function handleSaveJob() {
  //   if (!user) {
  //     setShowGuestSaveModal(true);
  //     return false;
  //   }
  //   return saveJobWithName(jobName);
  // }

  async function handleSaveDialogConfirm(name: string) {
    const saved = await saveJobWithName(name);
    if (saved) setSaveJobDialogOpen(false);
    return saved;
  }

  function clearToFreshWorkspace() {
    dispatch({ type: "CLEAR_QUOTE" });
    setExtraItems([]);
    setLineEdits({});
    setLineOverrides({});
    setActiveBomSummary(null);
    setJobName("");
    setIntroDismissed(false);
    setRightPaneView("bom");
    setMapExpanded(false);
    // setAutoOpenFirstSectionRunId(null);
    // setMobileTab("job");
    setClearJobDialogOpen(false);
  }

  function handlePrintBom() {
    const previousRightPaneView = rightPaneView;
    const cleanupPrintMode = () => {
      document.body.removeAttribute("data-print-bom");
      document.body.removeAttribute("data-print-bom-map");
      window.removeEventListener("afterprint", cleanupPrintMode);
      setRightPaneView(previousRightPaneView);
    };
    document.body.setAttribute("data-print-bom", "true");
    if (includeMapInBomPrint) {
      document.body.setAttribute("data-print-bom-map", "true");
    } else {
      document.body.removeAttribute("data-print-bom-map");
    }
    window.addEventListener("afterprint", cleanupPrintMode);
    if (includeMapInBomPrint) {
      setRightPaneView("map");
      window.setTimeout(() => window.print(), 300);
      return;
    }
    window.setTimeout(() => window.print(), 0);
  }

  function handleExportCsv() {
    if (!bomResultForTabs) return;
    type CsvRow = {
      SKU: string;
      Description: string;
      Category: string;
      Unit: string;
      Qty: string | number;
      "Unit Price": string;
      "Line Total": string;
    };
    const rows: CsvRow[] = [];
    rows.push(...bomResultForTabs.allItems.map((line) => ({
      SKU: line.sku,
      Description: line.description,
      Category: line.category,
      Unit: line.unit,
      Qty: line.quantity,
      "Unit Price": line.unitPrice !== null ? line.unitPrice.toFixed(2) : "TBC",
      "Line Total": line.lineTotal !== null ? line.lineTotal.toFixed(2) : "TBC",
    })));
    rows.push(
      {
        SKU: "",
        Description: "Subtotal (ex-GST)",
        Category: "",
        Unit: "",
        Qty: "",
        "Unit Price": "",
        "Line Total": bomResultForTabs.total.toFixed(2),
      },
      {
        SKU: "",
        Description: "GST (10%)",
        Category: "",
        Unit: "",
        Qty: "",
        "Unit Price": "",
        "Line Total": bomResultForTabs.gst.toFixed(2),
      },
      {
        SKU: "",
        Description: "TOTAL (inc. GST)",
        Category: "",
        Unit: "",
        Qty: "",
        "Unit Price": "",
        "Line Total": bomResultForTabs.grandTotal.toFixed(2),
      },
    );
    const blob = new Blob([Papa.unparse(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `glass-outlet-bom-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleSharePdf() {
    if (!bomResultForTabs) return;
    setSharingPdf(true);
    try {
      const fileDate = new Date().toISOString().slice(0, 10);
      const fileSlug =
        jobName.trim().replace(/\s+/g, "-").toLowerCase() || "quickscreen-quote";
      const pdfDocument = (
        <BomV3PDFTemplate
          items={bomResultForTabs.allItems}
          subtotal={bomResultForTabs.total}
          gst={bomResultForTabs.gst}
          grandTotal={bomResultForTabs.grandTotal}
          pricingTier={bomResultForTabs.pricingTier}
          generatedAt={bomResultForTabs.generatedAt}
          customerRef={jobName.trim() || undefined}
          siteAddress={payload?.propertyAnchor?.address}
        />
      );
      const blob = await pdf(pdfDocument).toBlob();
      const result = await shareOrDownloadPdfBlob({
        blob,
        fileName: `quickscreen-quote-${fileSlug}-${fileDate}.pdf`,
        title: "QuickScreen Quote",
        text: jobName.trim()
          ? `QuickScreen BOM quote for ${jobName.trim()}`
          : "QuickScreen BOM quote",
      });
      toast.success(result === "shared" ? "PDF shared" : "PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to share PDF");
    } finally {
      setSharingPdf(false);
    }
  }

  // const warnings = ((lastBom?.warnings as string[]) ?? []).filter(
  //   (warning) => !isAngleDrawingWarning(warning),
  // );
  // const errors = (lastBom?.errors as string[]) ?? [];
  // const hasErrors = errors.length > 0;
  // const economySlatErrors =
  //   payload?.runs.flatMap((run, runIndex) => {
  //     const runVars = { ...(payload.variables ?? {}), ...(run.variables ?? {}) };
  //     return run.segments
  //       .filter((segment) => segment.segmentKind !== "gate_opening")
  //       .flatMap((segment, segmentIndex) => {
  //         const vars = { ...runVars, ...(segment.variables ?? {}) };
  //         return vars.finish_family === "economy" && Number(vars.slat_size_mm ?? 65) === 90
  //           ? [
  //             `Run ${runIndex + 1} Section ${segmentIndex + 1}: Economy slats only available in 65mm - switch slat size or pick Standard.`,
  //           ]
  //           : [];
  //       });
  //   }) ?? [];
  // const gateWidthValidations =
  //   payload?.runs.flatMap((run) =>
  //     run.segments
  //       .filter((segment) => segment.segmentKind === "gate_opening")
  //       .map((segment) => ({ runId: run.runId, segmentId: segment.segmentId, ...validateGateWidth(segment) })),
  //   ) ?? [];
  // const gateWidthErrors = gateWidthValidations.filter((item) => item.status === "error");
  // const gateWidthWarnings = gateWidthValidations.filter((item) => item.status === "warning");
  // const hasBlockingErrors = hasErrors || gateWidthErrors.length > 0 || economySlatErrors.length > 0;

  const payloadCalcKey = useMemo(
    () => (payload ? payloadBomKey(payload) : null),
    [payload],
  );

  useEffect(() => {
    setActiveBomSummary(null);
  }, [payloadCalcKey]);

  useEffect(() => {
    if (!lastBom) setActiveBomSummary(null);
  }, [lastBom]);

  const runBomRecalculation = useCallback(async () => {
    if (!payload || !payloadCalcKey) {
      lastCalcPayloadKeyRef.current = null;
      dispatch({ type: "CLEAR_BOM_RESULT" });
      return;
    }
    const emptyRuns = payload.runs.every((run) => run.segments.length === 0);
    const economyErrors = payload.runs.flatMap((run, runIndex) => {
      const runVars = { ...(payload.variables ?? {}), ...(run.variables ?? {}) };
      return run.segments
        .filter((segment) => segment.segmentKind !== "gate_opening")
        .flatMap((segment, segmentIndex) => {
          const vars = { ...runVars, ...(segment.variables ?? {}) };
          return vars.finish_family === "economy" && Number(vars.slat_size_mm ?? 65) === 90
            ? [`Run ${runIndex + 1} Section ${segmentIndex + 1}`]
            : [];
        });
    });
    const gateErrors = payload.runs.flatMap((run) =>
      run.segments
        .filter((segment) => segment.segmentKind === "gate_opening")
        .map((segment) => validateGateWidth(segment))
        .filter((result) => result.status === "error"),
    );
    if (emptyRuns || economyErrors.length > 0 || gateErrors.length > 0) {
      lastCalcPayloadKeyRef.current = payloadCalcKey;
      dispatch({ type: "CLEAR_BOM_RESULT" });
      return;
    }
    const requestId = ++bomRequestIdRef.current;
    try {
      const result = await bomMutateAsyncRef.current({ payload, supplierSlug });
      if (requestId !== bomRequestIdRef.current) return;
      dispatch({ type: "SET_BOM_RESULT", result });
      lastCalcPayloadKeyRef.current = payloadCalcKey;
    } catch {
      // Error is available via bomMutation.error.
    }
  }, [payload, payloadCalcKey, dispatch, supplierSlug]);

  const runBomRecalcRef = useRef(runBomRecalculation);
  runBomRecalcRef.current = runBomRecalculation;

  useEffect(() => {
    if (!introDismissed && !quoteId) return;
    if (!payload || !payloadCalcKey) return;
    if (skipAutoBomRef.current) {
      skipAutoBomRef.current = false;
      return;
    }
    if (payloadCalcKey === lastCalcPayloadKeyRef.current) return;
    const timer = window.setTimeout(() => {
      void runBomRecalcRef.current();
    }, BOM_RECALC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [payloadCalcKey, introDismissed, quoteId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (typing) return;
      const mod = event.ctrlKey || event.metaKey;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
      }
      if (mod && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExportCsv();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const cleanJobName = jobName.trim();
  // const systemLabel = (productCode: string) => {
  //   if (productCode === "QSHS") return "Horizontal Slats";
  //   if (productCode === "VS") return "Vertical Slats";
  //   if (productCode === "XPL") return "XPress Plus";
  //   if (productCode === "BAYG") return "BAY-G Infill";
  //   return productCode;
  // };
  // const gateSummaryForRun = (run: CanonicalRun) => {
  //   const counts = new Map<string, number>();
  //   for (const segment of run.segments) {
  //     if (segment.segmentKind !== "gate_opening") continue;
  //     const movement = String(segment.variables?.[GATE_SEGMENT_STUB_KEYS.gateMovement] ?? "single_swing");
  //     const label =
  //       movement === "sliding"
  //         ? "sliding gate"
  //         : movement === "double_swing"
  //           ? "double swing gate"
  //           : "pedestrian gate";
  //     counts.set(label, (counts.get(label) ?? 0) + 1);
  //   }
  //   return [...counts.entries()]
  //     .map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`)
  //     .join(" + ");
  //   };
  // const summaryText = cleanJobName;
  // const bomRunDetails = payload?.runs.map((run, runIndex) => {
  //   const vars = { ...(payload.variables ?? {}), ...(run.variables ?? {}) };
  //   const gates = run.segments.filter((segment) => segment.segmentKind === "gate_opening");
  //   const sections = run.segments.filter((segment) => segment.segmentKind !== "gate_opening");
  //   const lengthMm = run.segments.reduce((sum, segment) => {
  //     const qty =
  //       run.productCode === "BAYG" && segment.segmentKind !== "gate_opening"
  //         ? Math.max(1, Math.round(Number(segment.variables?.panel_quantity ?? 1)))
  //         : 1;
  //     return sum + Number(segment.segmentWidthMm ?? 0) * qty;
  //   }, 0);
  //   const maxPanelWidth = Number(vars.max_panel_width_mm ?? 2600);
  //   const runSettings = [
  //     systemLabel(run.productCode),
  //     colourName(vars.colour_code),
  //     `${Number(vars.slat_size_mm ?? 65)}mm slat`,
  //     `${Number(vars.slat_gap_mm ?? 9)}mm gap`,
  //     run.productCode === "BAYG" ? null : mountingLabel(vars.mounting_method ?? vars.mounting_type),
  //     `${maxPanelWidth}mm spacing`,
  //     (run.corners?.length ?? 0) > 0
  //       ? `${run.corners?.length} corner${run.corners?.length === 1 ? "" : "s"}`
  //       : null,
  //   ].filter(Boolean) as string[];
  //   const sectionRows = sections.map((section, sectionIndex) => {
  //     const sectionVars = section.variables ?? {};
  //     const width = Number(section.segmentWidthMm ?? 0);
  //     const panelCount = width > 0 ? Math.max(1, Math.ceil(width / Number(sectionVars.max_panel_width_mm ?? maxPanelWidth))) : 0;
  //     const postSpacing = panelCount > 0 ? Math.round(width / panelCount) : 0;
  //     const overrides = [
  //       ["System Type", sectionVars.product_code, run.productCode],
  //       ["Color", sectionVars.colour_code, vars.colour_code],
  //       ["Slat size", sectionVars.slat_size_mm, vars.slat_size_mm],
  //       ["Gap size", sectionVars.slat_gap_mm, vars.slat_gap_mm],
  //       ["Post mounting", sectionVars.mounting_method ?? sectionVars.mounting_type, vars.mounting_method ?? vars.mounting_type],
  //       ["Max post spacing", sectionVars.max_panel_width_mm, vars.max_panel_width_mm],
  //     ]
  //       .filter(([, value]) => value !== undefined && value !== null && value !== "")
  //       .filter(([, value, master]) => String(value) !== String(master ?? ""))
  //       .map(([label, value]) => {
  //         if (label === "Color") return `${label}: ${colourName(value)}`;
  //         if (label === "Post mounting") return `${label}: ${mountingLabel(value)}`;
  //         if (label === "Slat size" || label === "Gap size" || label === "Max post spacing") {
  //           return `${label}: ${value}mm`;
  //         }
  //         if (label === "System Type") return `${label}: ${systemLabel(String(value))}`;
  //         return `${label}: ${value}`;
  //       });
  //     const linkedGates = gates.filter((gate) => {
  //       const parentSectionId = gate.variables?.parent_section_id;
  //       return parentSectionId === section.segmentId || (!parentSectionId && sectionIndex === 0);
  //     });
  //     return {
  //       label: `Section ${sectionIndex + 1} \u2014 ${(width / 1000).toFixed(2)}m \u00d7 ${Number(section.targetHeightMm ?? vars.target_height_mm ?? 1800)}mm`,
  //       panelLine: `${panelCount} panel${panelCount === 1 ? "" : "s"} \u2014 post spacing ${postSpacing}mm`,
  //       overrides,
  //       gates: linkedGates.map((gate) => {
  //         const gateIndex = gates.findIndex((candidate) => candidate.segmentId === gate.segmentId);
  //         const movement = gateMovementOrDefault(gate.variables?.[GATE_SEGMENT_STUB_KEYS.gateMovement]);
  //         const movementLabel =
  //           movement === "double_swing"
  //             ? "Double swing"
  //             : movement === "sliding"
  //               ? "Sliding"
  //               : "Single swing";
  //         return `Gate ${gateIndex + 1} \u2014 ${movementLabel} \u2014 ${Number(gate.segmentWidthMm ?? 0)}mm \u2014 ${gateHardwareLabel(gate) || "default hardware"}`;
  //       }),
  //     };
  //   });
  //   return {
  //     hero: `Run ${runIndex + 1} - ${(lengthMm / 1000).toFixed(2)}m - ${systemLabel(run.productCode)} - ${gateSummaryForRun(run) || "no gates"}`,
  //     printHeading: `Run ${runIndex + 1}`,
  //     settings: runSettings.join(" · "),
  //     sections: sectionRows,
  //   };
  // }) ?? [];
  // const saveJobLabel = quoteId
  //   ? jobName.trim()
  //     ? `Update ${jobName.trim()}`
  //     : "Update Job"
  //   : jobName.trim()
  //     ? `Save ${jobName.trim()}`
  //     : "Save Job";
  const saveDialogInitialName = jobName.trim() || defaultSaveJobName();
  const headerJobTitle = cleanJobName || undefined;
  // const animatedGrandTotal = useAnimatedNumber(
  //   activeBomSummary?.grandTotal ?? bomResultForTabs?.grandTotal ?? 0,
  // );
  // const mobileBomTotals = bomResultForTabs
  //   ? {
  //       subtotal: activeBomSummary?.subtotal ?? bomResultForTabs.total,
  //       gst: activeBomSummary?.gst ?? bomResultForTabs.gst,
  //       grandTotal: activeBomSummary?.grandTotal ?? bomResultForTabs.grandTotal,
  //     }
  //   : null;
  const headerGrandTotal = activeBomSummary?.grandTotal ?? bomResultForTabs?.grandTotal ?? 0;
  const headerPriceLabel =
    !customerMode && headerGrandTotal > 0 ? formatHeaderMoney(headerGrandTotal) : null;
  const showIntro = !quoteId && !payload && !introDismissed;
  // const paneVisibility = calculatorPaneVisibility(mobileLayout, mobileTab);

  const isLoadingSupplierCalc = !!supplierSlug && !!instanceSlug && loadingInstance;
  const isSupplierCalcNotFound = !!supplierSlug && !!instanceSlug && !loadingInstance && (!systemInstance || !instanceProduct);

  if ((quoteId && quoteQuery.isLoading) || isLoadingSupplierCalc) {
    return (
      <AppShell branding={branding} brandLogoSrc={logoUrl} brandLogoAlt={supplierBrand?.name}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-brand-muted">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          <p className="text-sm">Loading calculator…</p>
        </div>
      </AppShell>
    );
  }

  if (isSupplierCalcNotFound) {
    return (
      <AppShell branding={branding} brandLogoSrc={logoUrl} brandLogoAlt={supplierBrand?.name}>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-brand-danger">Calculator Not Found</h2>
          <p className="text-sm text-brand-muted mt-2">
            The requested fencing calculator is not available or is currently deactivated.
          </p>
          <Link
            to={supplierSlug ? `/s/${supplierSlug}` : "/"}
            className="text-sm font-semibold text-brand-primary hover:underline mt-4 inline-block"
          >
            Back to Portal
          </Link>
        </div>
      </AppShell>
    );
  }

  if (quoteId && quoteQuery.isError) {
    const legacy = quoteQuery.error instanceof LegacyQuoteError;
    return (
      <AppShell>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
          <p className="text-sm text-brand-danger">
            {legacy
              ? quoteQuery.error.message
              : quoteQuery.error instanceof Error
                ? quoteQuery.error.message
                : "Failed to load quote."}
          </p>
          <Link
            to="/quotes"
            className="text-sm font-semibold text-brand-accent hover:underline"
          >
            Back to quotes
          </Link>
        </div>
      </AppShell>
    );
  }
  const gateTargetRun = gatePositionTarget
    ? payload?.runs.find((run) => run.runId === gatePositionTarget.runId)
    : undefined;
  const gateTargetRunLength = gateTargetRun ? runLengthMm(gateTargetRun) : 0;
  // const hasLegacyConfiguredPayload = Boolean(
  //   quoteId && payload && !payload.propertyAnchor && payload.runs.some((run) => run.segments.length > 0),
  // );
  // const propertyAnchorConfirmed = Boolean(payload?.propertyAnchor) || hasLegacyConfiguredPayload;
  const headerActions = !showIntro && !mapExpanded ? (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <div
        className="lg:fixed lg:top-2 lg:z-40"
        style={mobileLayout ? undefined : { left: runPaneWidth + 16 }}
      >
        <RightPaneTabs activeView={rightPaneView} onChange={handleRightPaneChange} />
      </div>
      {rightPaneView === "bom" && (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={handlePrintBom}
            disabled={!bomResultForTabs}
            title="Print BOM"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted transition-colors hover:border-brand-primary hover:text-brand-primary hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer size={16} />
            Print BOM
          </button>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted">
            <input
              type="checkbox"
              checked={includeMapInBomPrint}
              onChange={(event) => setIncludeMapInBomPrint(event.target.checked)}
              className="accent-brand-primary"
            />
            Include map
          </label>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!bomResultForTabs}
            title="Export CSV (Ctrl+E)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted transition-colors hover:border-brand-primary hover:text-brand-primary hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void handleSharePdf()}
            disabled={!bomResultForTabs || sharingPdf}
            title="Share PDF"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted transition-colors hover:border-brand-primary hover:text-brand-primary hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sharingPdf ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            Share PDF
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted transition-colors hover:border-brand-primary hover:text-brand-primary hover:shadow-sm"
          >
            <Keyboard size={16} />
            Shortcuts
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <AppShell
      headerActions={headerActions}
      topBar={<PwaStatusBanners />}
      jobTitle={headerJobTitle}
      headerPriceLabel={headerPriceLabel}
      customerMode={customerMode}
      onCustomerModeChange={setCustomerMode}
      onClearJobRequest={() => setClearJobDialogOpen(true)}
      clearJobDisabled={!payload && !jobName}
      branding={branding}
      brandLogoSrc={logoUrl}
      brandLogoAlt={supplierBrand?.name}
    >
      {gatePositionTarget && gateTargetRunLength > 0 && (
        <GatePositionModal
          gateLabel={gatePositionTarget.kind.replace("_", " ")}
          runLengthMm={gateTargetRunLength}
          widthMm={gatePositionTarget.widthMm ?? 1000}
          onClose={() => setGatePositionTarget(null)}
          onConfirm={(distance) => handleConfirmGatePosition(gatePositionTarget, distance)}
        />
      )}
      {showIntro ? (
        <MapCapture
          onConfirm={handleConfirmMapCapture}
          onSkip={handleSkipMapCapture}
        />
      ) : (
        <>
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-brand-bg md:flex-row">
            {selectedFenceType === "timber-paling" ? (
              <TimberPalingVariationSidebar
                payload={payload!}
                dispatch={dispatch}
                lastBom={lastBom}
                onChangeFenceType={() => setSelectedFenceType(null)}
              />
            ) : (
              <FenceTypeSidebar
                activeType="timber-paling"
                onSelectType={handleSelectFenceType}
              />
            )}
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 relative">
              {payload ? (
                <div className="relative h-full w-full">
                  <LayoutCanvasV3
                    mapExpanded={mapExpanded}
                    onMapExpandedChange={setMapExpanded}
                    showRunDetails={false}
                    propertyAnchor={payload.propertyAnchor ?? null}
                    mapSnapshot={payload.snapshot ?? null}
                    onMapSnapshotChange={handleMapSnapshotChange}
                  />
                  {selectedFenceType === "timber-paling" && (
                    <PriceBubble
                      payload={payload}
                      bomResult={lastBom}
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-border bg-brand-bg/50 p-6 text-center text-sm font-bold text-brand-muted">
                  Start from the sidebar, then draw the layout here.
                </div>
              )}
            </main>
          </div>
          {saveJobDialogOpen && (
            <SaveJobDialog
              initialName={saveDialogInitialName}
              saving={saving}
              onCancel={() => setSaveJobDialogOpen(false)}
              onSave={handleSaveDialogConfirm}
            />
          )}
          {clearJobDialogOpen && (
            <ClearJobConfirmDialog
              onCancel={() => setClearJobDialogOpen(false)}
              onClear={clearToFreshWorkspace}
            />
          )}
          {shortcutsOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-card p-5 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-extrabold text-brand-text">
                    Keyboard shortcuts
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShortcutsOpen(false)}
                    className="rounded-lg p-1 text-brand-muted hover:bg-brand-border/40 hover:text-brand-text"
                    aria-label="Close shortcuts"
                  >
                    <X size={16} />
                  </button>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-brand-muted">Export CSV</dt>
                    <dd className="rounded-lg bg-brand-bg px-2 py-1 font-mono text-brand-text">
                      Ctrl + E
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-brand-muted">Open this panel</dt>
                    <dd className="rounded-lg bg-brand-bg px-2 py-1 font-mono text-brand-text">
                      ?
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-brand-muted">Canvas undo</dt>
                    <dd className="rounded-lg bg-brand-bg px-2 py-1 font-mono text-brand-text">
                      Ctrl + Z
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function shouldRenderV3(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.endsWith("-auth-token")) {
        const val = window.localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const accessToken = parsed.access_token;
          const email = parsed.user?.email;
          if (accessToken === "bn-smoke-token" || accessToken === "property-map-smoke-token") {
            return true;
          }
          if (email === "admin@glass-outlet.com" && accessToken !== "anyfence-smoke-token") {
            return true;
          }
        }
      }
    }
  } catch (e) {
    // Ignore potential JSON parse errors
  }
  return false;
}

export function AnyfenceCalculatorPage() {
  const { quoteId, supplierSlug, instanceSlug } = useParams<{
    quoteId?: string;
    supplierSlug?: string;
    instanceSlug?: string;
  }>();

  if (shouldRenderV3() && !quoteId) {
    return <CalculatorV3Page />;
  }

  return (
    <AnyfenceCalculatorPageWrapper
      quoteId={quoteId}
      supplierSlug={supplierSlug}
      instanceSlug={instanceSlug}
    />
  );
}

function AnyfenceCalculatorPageWrapper({
  quoteId,
  supplierSlug,
  instanceSlug,
}: {
  quoteId?: string;
  supplierSlug?: string;
  instanceSlug?: string;
}) {
  const { orgSlug, isLoading: profileLoading } = useProfile();

  if (profileLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-brand-muted">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          <p className="text-sm">Loading profile…</p>
        </div>
      </AppShell>
    );
  }

  if (orgSlug === "glass-outlet" && !quoteId) {
    return <CalculatorV3Page />;
  }

  const key = quoteId
    ? `quote-${quoteId}`
    : supplierSlug && instanceSlug
      ? `supplier-${supplierSlug}-${instanceSlug}`
      : "new";

  return (
    <CalculatorProvider key={key}>
      <FenceConfigProvider>
        <GateProvider>
          <AnyfenceCalculatorContent quoteId={quoteId} />
        </GateProvider>
      </FenceConfigProvider>
    </CalculatorProvider>
  );
}
