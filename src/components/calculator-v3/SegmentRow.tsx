import { useEffect, useRef } from "react";
import { useCalculator } from "../../context/CalculatorContext";
import type { CanonicalSegment } from "../../types/canonical.types";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { ConfirmButton } from "../shared/ConfirmButton";
import { FenceSegmentDetails } from "./FenceSegmentDetails";
import { GateSegmentDetails } from "./GateSegmentDetails";
import NumberInput from "../shared/NumberInput";
import {
  GATE_SEGMENT_STUB_KEYS,
  SEGMENT_TERMINATION_KEYS,
  patchSegmentVariables,
} from "../../lib/segmentTermination";
import {
  DROP_BOLT_OPTIONS,
  GATE_STOP_OPTIONS,
  SLIDING_CATCH_OPTIONS,
  SLIDING_GUIDE_OPTIONS,
  SLIDING_TRACK_OPTIONS,
  clearGateOpeningWidthMm,
  defaultGateBuildForMovement,
  gateMovementOrDefault,
  optionLabel,
} from "../../lib/gateOptionRules";
import { HINGE_HARDWARE, LATCH_HARDWARE, baseHardwareSku, hingeGapForSku, latchGapForSku } from "../../lib/gateHardware";
import {
  gatePatchForAlternative,
  gateTypeLabel,
  validateGateWidth,
} from "../../lib/gateConstraints";
import {
  clampPostSpacing,
  heightEntriesForSystem,
  maxPanelWidthForSystem,
} from "../../lib/productOptionRules";
import {
  derivedHeightForSlatCount,
  nearestDerivedHeight,
  type DerivedHeight,
} from "../../lib/heights";
import { colourName } from "./ColourPalette";
import { InlineHeightEditor } from "./InlineHeightEditor";

interface Props {
  runId: string;
  seg: CanonicalSegment;
  segIdx: number;
  runIdx: number;
  open: boolean;
  onToggle: () => void;
  displayLabel?: string;
  onAddGate?: (sectionId: string) => void;
  showRunDefaultsTeaching?: boolean;
  onDismissRunDefaultsTeaching?: () => void;
}

const MOUNTING_LABELS: Record<string, string> = {
  in_ground: "Concreted",
  base_plate: "Base plate",
  core_drill: "Core drill",
};

const POST_SYSTEM_LABELS: Record<string, string> = {
  xpl: "XPress Plus post",
  standard_50: "50mm Post Standard",
  standard_65: "65mm Post Standard HD",
};

function postLabel(productCode: string, variables: Record<string, unknown>) {
  const postSystem = String(
    variables.post_system ?? (productCode === "XPL" ? "xpl" : "standard_50"),
  );
  if (productCode === "XPL" || postSystem === "xpl") {
    return POST_SYSTEM_LABELS[postSystem] ?? "XPress Plus post";
  }
  const postSize = String(variables.post_size ?? "50");
  return postSize === "65" ? "65mm Post Standard HD" : "50mm Post Standard";
}

function gateMovementLabel(value: unknown) {
  const movement = gateMovementOrDefault(value);
  if (movement === "double_swing") return "Double swing";
  if (movement === "sliding") return "Sliding";
  return "Single swing";
}

function hardwareProductName(kind: "hinge" | "latch", value: unknown) {
  const base = baseHardwareSku(value);
  const catalogue = kind === "hinge" ? HINGE_HARDWARE : LATCH_HARDWARE;
  return catalogue.find((item) => item.sku === base || item.skuW === String(value))?.label ?? String(value ?? "");
}

function gateHardwareSummaryItems(variables: Record<string, unknown>): SummaryItem[] {
  const movement = gateMovementOrDefault(variables[GATE_SEGMENT_STUB_KEYS.gateMovement]);
  if (movement === "sliding") {
    const track = String(variables[GATE_SEGMENT_STUB_KEYS.slidingTrackType] ?? "XPSG-6000-TRACK-ST");
    const guide = String(variables[GATE_SEGMENT_STUB_KEYS.slidingGuideType] ?? "XPSG-GUIDE");
    const catchType = String(variables[GATE_SEGMENT_STUB_KEYS.slidingCatchType] ?? "XPSG-CATCH-U");
    return [
      { label: "Track", value: optionLabel(SLIDING_TRACK_OPTIONS, track) },
      { label: "Guide", value: optionLabel(SLIDING_GUIDE_OPTIONS, guide) },
      { label: "Catch", value: optionLabel(SLIDING_CATCH_OPTIONS, catchType) },
    ];
  }
  const hinge = String(variables[GATE_SEGMENT_STUB_KEYS.hingeType] ?? "TC-H-AT-HD-B");
  const latch = String(variables[GATE_SEGMENT_STUB_KEYS.latchType] ?? "LL-DL-KA");
  const dropBolt = String(variables[GATE_SEGMENT_STUB_KEYS.dropBoltType] ?? "none");
  const gateStop = String(variables[GATE_SEGMENT_STUB_KEYS.gateStopType] ?? "none");
  return [
    hinge !== "none" ? { label: "Hinge", value: hardwareProductName("hinge", hinge) } : null,
    latch !== "none" ? { label: "Latch", value: hardwareProductName("latch", latch) } : null,
    dropBolt !== "none" ? { label: "Drop bolt", value: optionLabel(DROP_BOLT_OPTIONS, dropBolt) } : null,
    gateStop !== "none" ? { label: "Gate stop", value: optionLabel(GATE_STOP_OPTIONS, gateStop) } : null,
  ].filter(Boolean) as SummaryItem[];
}

function SummaryBit({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <span className={`inline-flex max-w-full items-baseline gap-1 whitespace-nowrap ${emphasis ? "text-[13px]" : ""}`}>
      <span className="shrink-0 font-semibold text-brand-muted">{label}:</span>
      <strong className={`min-w-0 truncate font-extrabold text-brand-text ${emphasis ? "text-sm" : ""}`}>{value}</strong>
    </span>
  );
}

type SummaryItem = {
  label: string;
  value: string | number;
  emphasis?: boolean;
};

function sameValue(left: unknown, right: unknown) {
  if (left === undefined || left === null || left === "") {
    return right === undefined || right === null || right === "";
  }
  return String(left) === String(right ?? "");
}

function unsetOrSame(vars: Record<string, unknown>, key: string, defaultValue: unknown) {
  return vars[key] === undefined || vars[key] === null || sameValue(vars[key], defaultValue);
}

export function SegmentRow({
  runId,
  seg,
  segIdx,
  runIdx,
  open,
  onToggle,
  displayLabel,
  onAddGate,
  showRunDefaultsTeaching = false,
  onDismissRunDefaultsTeaching,
}: Props) {
  const { state, dispatch } = useCalculator();
  const collapseTimerRef = useRef<number | null>(null);
  const gate = seg.segmentKind === "gate_opening";

  const run = state.payload?.runs.find((r) => r.runId === runId);
  const runVariables = {
    ...(state.payload?.variables ?? {}),
    ...(run?.variables ?? {}),
  };
  const masterVariables = {
    ...runVariables,
  };
  const runDefaultHeight = Number(masterVariables.target_height_mm ?? 1800);
  const segmentVariables = {
    ...runVariables,
    ...(seg.variables ?? {}),
  };
  const runProductCode = run?.productCode ?? state.payload?.productCode ?? "QSHS";
  const productCode = String(seg.variables?.product_code ?? runProductCode);
  const isBayg = productCode === "BAYG";
  const heightEntries = run
    ? heightEntriesForSystem(productCode, segmentVariables)
    : [];
  const heightInputsReady =
    productCode === "VS" ||
    (Number.isFinite(Number(segmentVariables.slat_size_mm)) &&
      Number.isFinite(Number(segmentVariables.slat_gap_mm)));
  const selectedHeightEntry =
    derivedHeightForSlatCount(heightEntries, seg.variables?.slat_count ?? segmentVariables.slat_count) ??
    nearestDerivedHeight(
      heightEntries,
      Number(seg.targetHeightMm ?? segmentVariables.target_height_mm ?? 1800),
    );
  const selectedHeight =
    selectedHeightEntry?.height ?? Number(seg.targetHeightMm ?? segmentVariables.target_height_mm ?? 1800);
  const fenceColour = String(segmentVariables.colour_code ?? "B");
  const postColour = String(segmentVariables.post_colour_code ?? fenceColour);
  const maxSpacing = clampPostSpacing(
    segmentVariables.max_panel_width_mm ?? maxPanelWidthForSystem(productCode),
    maxPanelWidthForSystem(productCode),
  );
  const segmentLength = Number(seg.segmentWidthMm ?? 0);
  const panelCount = segmentLength > 0 ? Math.max(1, Math.ceil(segmentLength / maxSpacing)) : 0;
  const panelWidthSummary =
    panelCount <= 0
      ? "0mm"
      : panelCount === 1
        ? `${Math.round(segmentLength)}mm`
        : `${panelCount} x ${Math.round(segmentLength / panelCount)}mm`;
  const gateVars = seg.variables ?? {};
  const gateWidthValidation = gate ? validateGateWidth(seg) : null;
  const gateBuild = String(
    gateVars[GATE_SEGMENT_STUB_KEYS.gateBuild] ??
    (productCode === "VS" ? "qsg_hinged_vertical" : "qsg_hinged_horizontal"),
  );
  const expectedGateBuild =
    gateBuild ===
    defaultGateBuildForMovement(
      gateMovementOrDefault(gateVars[GATE_SEGMENT_STUB_KEYS.gateMovement]),
      runProductCode === "VS",
    );
  const compactLabel =
    displayLabel?.replace(/\s+/g, "") ??
    `R${runIdx + 1}${gate ? "G" : "S"}${segIdx + 1}`;
  const titleLabel = (() => {
    if (gate) return `Gate ${segIdx + 1} — ${Math.round(segmentLength)}mm`;
    if (runProductCode === "AF_TIMBER_PALING") return `Timber Section ${segIdx + 1}`;
    if (runProductCode === "AF_COLORBOND") return `Colorbond Panel ${segIdx + 1}`;
    if (runProductCode === "AF_PERMASTEEL") return `Permasteel Panel ${segIdx + 1}`;
    if (runProductCode === "AF_RETAINING_WALL") return `Wall Section ${segIdx + 1}`;
    if (runProductCode === "AF_CHAINWIRE_SECURITY") return `Chainwire Section ${segIdx + 1}`;
    if (runProductCode === "AF_TIMBER_SLAT_SCREEN") return `Slat Section ${segIdx + 1}`;
    if (isBayg) return `Panel ${segIdx + 1} — ${Math.round(segmentLength)}mm`;
    return `Section ${segIdx + 1}`;
  })();
  const matchesMaster = (() => {
    if (!run) return true;
    if (gate) {
      return (
        expectedGateBuild &&
        unsetOrSame(gateVars, GATE_SEGMENT_STUB_KEYS.colourCode, masterVariables.colour_code ?? "B") &&
        unsetOrSame(gateVars, GATE_SEGMENT_STUB_KEYS.slatSizeMm, masterVariables.slat_size_mm ?? 65) &&
        unsetOrSame(gateVars, GATE_SEGMENT_STUB_KEYS.slatGapMm, masterVariables.slat_gap_mm ?? 9)
      );
    }
    const vars = seg.variables ?? {};
    const settingsKindMatches = (key: string) => {
      const value = vars[key];
      const master = masterVariables[key];
      const structural = value === undefined || value === null || value === "" || value === "system_post" || value === "corner";
      const masterStructural = master === undefined || master === null || master === "" || master === "system_post" || master === "corner";
      if (structural && masterStructural) return true;
      return sameValue(value, master);
    };
    const keys = [
      "product_code",
      "colour_code",
      "post_colour_code",
      "slat_size_mm",
      "slat_gap_mm",
      "slat_gap_mode",
      "post_size",
      "post_system",
      "mounting_type",
      "mounting_method",
      "max_panel_width_mm",
      SEGMENT_TERMINATION_KEYS.leftNonSystemSubtype,
      SEGMENT_TERMINATION_KEYS.rightNonSystemSubtype,
    ];
    return (
      settingsKindMatches(SEGMENT_TERMINATION_KEYS.leftKind) &&
      settingsKindMatches(SEGMENT_TERMINATION_KEYS.rightKind) &&
      keys.every((key) => unsetOrSame(vars, key, masterVariables[key]))
    );
  })();
  const masterFenceColour = String(masterVariables.colour_code ?? "B");
  const masterPostColour = String(masterVariables.post_colour_code ?? masterFenceColour);
  const masterMaxSpacing = clampPostSpacing(
    masterVariables.max_panel_width_mm ?? maxPanelWidthForSystem(productCode),
    maxPanelWidthForSystem(productCode),
  );
  const masterPanelCount = segmentLength > 0 ? Math.max(1, Math.ceil(segmentLength / masterMaxSpacing)) : 0;
  const summaryBitsBase = [
    gate
      ? { label: "Type", value: gateMovementLabel(gateVars[GATE_SEGMENT_STUB_KEYS.gateMovement]), emphasis: true }
      : null,
    ...(gate ? gateHardwareSummaryItems(gateVars) : []),
    ...(isBayg && !gate
      ? [{ label: "Qty", value: Math.max(1, Math.round(Number(seg.variables?.panel_quantity ?? 1))), emphasis: true }]
      : []),
  ].filter(Boolean) as SummaryItem[];

  const rawDifferenceBits = gate
    ? [
      {
        label: "Height",
        value: `${selectedHeight}mm`,
        changed: !sameValue(
          selectedHeight,
          masterVariables.target_height_mm ?? 1800,
        ),
      },
      {
        label: "Gate style",
        value: gateBuild.includes("vertical") ? "Vertical slat" : "Horizontal slat",
        changed: !expectedGateBuild,
      },
      {
        label: "Colour",
        value: colourName(fenceColour),
        changed: !sameValue(fenceColour, masterFenceColour),
      },
      {
        label: "Slat",
        value: `${segmentVariables[GATE_SEGMENT_STUB_KEYS.slatSizeMm] ?? masterVariables.slat_size_mm ?? 65}mm`,
        changed: !sameValue(
          segmentVariables[GATE_SEGMENT_STUB_KEYS.slatSizeMm] ?? masterVariables.slat_size_mm ?? 65,
          masterVariables.slat_size_mm ?? 65,
        ),
      },
      {
        label: "Gap",
        value: `${segmentVariables[GATE_SEGMENT_STUB_KEYS.slatGapMm] ?? masterVariables.slat_gap_mm ?? 9}mm`,
        changed: !sameValue(
          segmentVariables[GATE_SEGMENT_STUB_KEYS.slatGapMm] ?? masterVariables.slat_gap_mm ?? 9,
          masterVariables.slat_gap_mm ?? 9,
        ),
      },
      ...(postColour !== fenceColour
        ? [
          {
            label: "Post colour",
            value: colourName(postColour),
            changed: !sameValue(postColour, masterPostColour),
          },
        ]
        : []),
    ]
    : [
      {
        label: "Height",
        value: `${selectedHeight}mm`,
        changed: !sameValue(
          selectedHeight,
          masterVariables.target_height_mm ?? 1800,
        ),
      },
      {
        label: "System",
        value: productCode,
        changed: !sameValue(productCode, runProductCode),
      },
      { label: "Colour", value: colourName(fenceColour), changed: !sameValue(fenceColour, masterFenceColour) },
      ...(postColour !== fenceColour
        ? [
          {
            label: "Post colour",
            value: colourName(postColour),
            changed: !sameValue(postColour, masterPostColour),
          },
        ]
        : []),
      {
        label: "Slat",
        value: `${segmentVariables.slat_size_mm ?? 65}mm`,
        changed: !sameValue(segmentVariables.slat_size_mm ?? 65, masterVariables.slat_size_mm ?? 65),
      },
      {
        label: "Gap",
        value: `${segmentVariables.slat_gap_mm ?? 9}mm`,
        changed: !sameValue(segmentVariables.slat_gap_mm ?? 9, masterVariables.slat_gap_mm ?? 9),
      },
      {
        label: "Post",
        value: postLabel(productCode, segmentVariables),
        changed:
          !isBayg &&
          (!sameValue(segmentVariables.post_system, masterVariables.post_system) ||
            !sameValue(segmentVariables.post_size ?? 50, masterVariables.post_size ?? 50)),
      },
      {
        label: "Mounting",
        value:
          MOUNTING_LABELS[String(segmentVariables.mounting_method ?? segmentVariables.mounting_type ?? "in_ground")] ??
          "Concreted",
        changed:
          !isBayg &&
          !sameValue(
            segmentVariables.mounting_method ?? segmentVariables.mounting_type ?? "in_ground",
            masterVariables.mounting_method ?? masterVariables.mounting_type ?? "in_ground",
          ),
      },
      { label: "Panel Count", value: panelCount, changed: !isBayg && !sameValue(panelCount, masterPanelCount) },
      { label: "Panel width", value: panelWidthSummary, changed: !isBayg && !sameValue(maxSpacing, masterMaxSpacing) },
    ];
  const differenceBits =
    matchesMaster ? [] : rawDifferenceBits.filter((item) => item.changed && item.label !== "Height");
  const summaryText = [
    ...(gate
      ? summaryBitsBase.map((item) => `${item.label}: ${item.value}`)
      : []),
    ...differenceBits.map((item) => `${item.label}: ${item.value}`),
  ].join(", ");
  const visibleSettings = rawDifferenceBits.filter((item) => {
    if (item.label === "Height") return false;
    if (isBayg && ["Post", "Mounting", "Panel Count", "Panel width"].includes(item.label)) {
      return false;
    }
    return true;
  });

  function updateGeometry(
    key: "segmentWidthMm" | "targetHeightMm",
    value: number,
  ) {
    const nextSegment =
      gate && key === "segmentWidthMm"
        ? (() => {
          const movement = gateMovementOrDefault(seg.variables?.[GATE_SEGMENT_STUB_KEYS.gateMovement]);
          if (movement === "sliding") {
            return { ...seg, [key]: value, leaves: [{ widthMm: Math.max(1, Math.round(value)) }] };
          }
          const hingeGapMm = hingeGapForSku(String(seg.variables?.[GATE_SEGMENT_STUB_KEYS.hingeType] ?? "TC-H-AT-HD-B"));
          const latchGapMm = latchGapForSku(String(seg.variables?.[GATE_SEGMENT_STUB_KEYS.latchType] ?? "LL-DL-KA"));
          const clearOpeningMm = clearGateOpeningWidthMm({
            openingWidthMm: value,
            movement,
            hingeGapMm,
            latchGapMm,
          });
          if (movement === "double_swing") {
            const existing = seg.leaves?.map((leaf) => Number(leaf.widthMm)).filter((width) => Number.isFinite(width) && width > 0) ?? [];
            const oldTotal = existing.reduce((sum, width) => sum + width, 0);
            const firstRatio = existing.length === 2 && oldTotal > 0 ? existing[0] / oldTotal : 0.5;
            const first = Math.max(1, Math.min(Math.round(clearOpeningMm) - 1, Math.round(clearOpeningMm * firstRatio)));
            return {
              ...seg,
              [key]: value,
              leaves: [{ widthMm: first }, { widthMm: Math.max(1, Math.round(clearOpeningMm) - first) }],
            };
          }
          return { ...seg, [key]: value, leaves: [{ widthMm: Math.max(1, Math.round(clearOpeningMm)) }] };
        })()
        : null;

    dispatch({
      type: "UPSERT_SEGMENT",
      runId,
      segment:
        nextSegment ??
        (gate && key === "targetHeightMm"
          ? {
            ...patchSegmentVariables(seg, {
              [GATE_SEGMENT_STUB_KEYS.gateHeightMm]: value,
            }),
            targetHeightMm: value,
          }
          : { ...seg, [key]: value }),
    });
  }

  function updateDerivedHeight(entry: DerivedHeight) {
    dispatch({
      type: "UPSERT_SEGMENT",
      runId,
      segment:
        gate
          ? {
            ...patchSegmentVariables(seg, {
              [GATE_SEGMENT_STUB_KEYS.gateHeightMm]: entry.height,
              target_height_mm: entry.height,
              slat_count: entry.N,
            }),
            targetHeightMm: entry.height,
          }
          : {
            ...patchSegmentVariables(seg, {
              target_height_mm: entry.height,
              slat_count: entry.N,
            }),
            targetHeightMm: entry.height,
          },
    });
  }

  function updateInlineHeight(heightMm: number, entry?: DerivedHeight) {
    if (heightMm === runDefaultHeight) {
      dispatch({
        type: "UPSERT_SEGMENT",
        runId,
        segment: {
          ...patchSegmentVariables(seg, {
            [GATE_SEGMENT_STUB_KEYS.gateHeightMm]: null,
            target_height_mm: null,
            slat_count: null,
          }),
          targetHeightMm: heightMm,
        },
      });
      return;
    }
    if (entry) {
      updateDerivedHeight(entry);
      return;
    }
    dispatch({
      type: "UPSERT_SEGMENT",
      runId,
      segment:
        gate
          ? {
            ...patchSegmentVariables(seg, {
              [GATE_SEGMENT_STUB_KEYS.gateHeightMm]: heightMm,
              target_height_mm: heightMm,
              slat_count: null,
            }),
            targetHeightMm: heightMm,
          }
          : {
            ...patchSegmentVariables(seg, {
              target_height_mm: heightMm,
              slat_count: null,
            }),
            targetHeightMm: heightMm,
          },
    });
  }

  function updatePanelQuantity(value: number) {
    dispatch({
      type: "UPSERT_SEGMENT",
      runId,
      segment: patchSegmentVariables(seg, {
        panel_quantity: Math.max(1, Math.round(Number(value) || 1)),
      }),
    });
  }

  function switchGateToAlternative() {
    if (!gateWidthValidation?.alternative) return;
    dispatch({
      type: "UPSERT_SEGMENT",
      runId,
      segment: patchSegmentVariables(
        seg,
        gatePatchForAlternative(
          gateWidthValidation.alternative,
          gateMovementOrDefault(seg.variables?.[GATE_SEGMENT_STUB_KEYS.gateMovement]),
        ),
      ),
    });
  }

  function resetToMaster() {
    if (!run) return;
    if (gate) {
      const movement = gateMovementOrDefault(seg.variables?.[GATE_SEGMENT_STUB_KEYS.gateMovement]);
      dispatch({
        type: "UPSERT_SEGMENT",
        runId,
        segment: {
          ...patchSegmentVariables(seg, {
            [GATE_SEGMENT_STUB_KEYS.gateBuild]: defaultGateBuildForMovement(
              movement,
              run.productCode === "VS",
            ),
            [GATE_SEGMENT_STUB_KEYS.colourCode]: String(masterVariables.colour_code ?? "B"),
            [GATE_SEGMENT_STUB_KEYS.slatSizeMm]: Number(masterVariables.slat_size_mm ?? 65),
            [GATE_SEGMENT_STUB_KEYS.slatGapMm]: Number(masterVariables.slat_gap_mm ?? 9),
            [GATE_SEGMENT_STUB_KEYS.gatePostSizeMm]: Number(masterVariables.post_size ?? 50),
          }),
        },
      });
      return;
    }
    dispatch({
      type: "UPSERT_SEGMENT",
      runId,
      segment: {
        ...patchSegmentVariables(seg, {
          slat_count: null,
          product_code: null,
          colour_code: null,
          post_colour_code: null,
          slat_size_mm: null,
          slat_gap_mm: null,
          slat_gap_mode: null,
          post_size: null,
          post_system: null,
          mounting_type: null,
          mounting_method: null,
          max_panel_width_mm: null,
        }),
      },
    });
  }

  function setMapHover(value: string | null) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("qsbom:hover-map-label", { detail: value }),
    );
  }

  useEffect(
    () => () => {
      if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
    },
    [],
  );



  const sectionOrPanelText = (() => {
    if (gate) return "gate";
    if (runProductCode === "AF_COLORBOND") return "panel";
    if (runProductCode === "AF_PERMASTEEL") return "panel";
    if (isBayg) return "panel";
    return "section";
  })();

  const settingsButtonLabel = (() => {
    if (gate) return "Gate Settings";
    if (runProductCode === "AF_TIMBER_PALING") return "Timber Section Settings";
    if (runProductCode === "AF_COLORBOND") return "Colorbond Panel Settings";
    if (runProductCode === "AF_PERMASTEEL") return "Permasteel Panel Settings";
    if (runProductCode === "AF_RETAINING_WALL") return "Wall Section Settings";
    if (runProductCode === "AF_CHAINWIRE_SECURITY") return "Chainwire Section Settings";
    if (runProductCode === "AF_TIMBER_SLAT_SCREEN") return "Slat Section Settings";
    if (isBayg) return "Panel Settings";
    return "Section Settings";
  })();

  return (
    <div className={`transition-all ${!matchesMaster ? "ml-4 pl-0" : ""}`}>
      <div className={`relative cursor-pointer overflow-hidden rounded-xl border bg-white p-2.5 text-sm font-semibold shadow-sm transition-all ${
        !matchesMaster ? "border-[#E9E5DD] border-l-4 border-l-[#DD6E1B]" : "border-[#E9E5DD]"
      }`}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button,input,select,textarea,a")) return;
          onToggle();
        }}
        title="Double-click to edit options"
      >
        <div className="p-0">

          <div className="min-w-0 space-y-3 w-full">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left text-sm font-semibold text-[#11161D]">
                <span className="font-bold text-[#11161D]">{titleLabel}</span>
                {!gate && (
                  <span className="text-[#6E7681] font-normal">
                    <strong className="af-sidebar-mono font-semibold text-[#11161D]">{(segmentLength / 1000).toFixed(2)}m</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[#6E7681] text-xs font-normal">
                  Height:
                  <InlineHeightEditor
                    productCode={productCode}
                    variables={segmentVariables}
                    valueMm={selectedHeight}
                    ariaLabel={`${titleLabel} height`}
                    onChange={updateInlineHeight}
                  />
                </span>
                {matchesMaster ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-green-50 text-green-700 uppercase">Inherits run</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-[#FCF1E6] text-[#DD6E1B] uppercase">OVERRIDES RUN</span>
                )}
              </div>
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={resetToMaster}
                  disabled={matchesMaster}
                  title={matchesMaster ? "Settings match run settings" : "Click to restore to run settings"}
                  aria-label={matchesMaster ? `${compactLabel} settings match run settings` : `${compactLabel} differs from run settings. Click to restore.`}
                  className={`rounded-full px-2 py-0.5 text-center shadow-sm ring-1 ring-inset transition-all text-[11px] font-semibold ${matchesMaster
                    ? "bg-green-50 text-green-700 ring-green-600/20 cursor-default"
                    : "bg-[#FCF1E6] text-[#DD6E1B] ring-[#DD6E1B]/30 hover:bg-[#DD6E1B] hover:text-white"
                    }`}
                >
                  <span
                    onMouseEnter={() => setMapHover(compactLabel)}
                    onMouseLeave={() => setMapHover(null)}
                    className="leading-none tracking-normal"
                  >
                    {compactLabel}
                  </span>
                </button>
              </div>
              {!gate && !isBayg && onAddGate && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddGate(seg.segmentId);
                  }}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E9E5DD] bg-white px-3 text-xs font-semibold text-[#6E7681] transition-colors hover:border-[#DD6E1B]/50 hover:text-[#DD6E1B]"
                  title="Add gate to this section"
                  aria-label="Add gate to this section"
                >
                  <Plus size={14} />
                  Gate
                </button>
              )}
              <div className="flex items-center justify-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={onToggle}
                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${open
                    ? "border-[#DD6E1B] bg-[#FCF1E6] text-[#DD6E1B] shadow-sm font-bold"
                    : "border-[#E9E5DD] text-[#6E7681] hover:border-[#DD6E1B]/50 hover:text-[#DD6E1B]"
                    }`}
                  aria-label={open ? `Collapse ${gate ? "gate" : sectionOrPanelText} settings` : `Open ${gate ? "gate" : sectionOrPanelText} settings`}
                  title={open ? `Collapse ${gate ? "gate" : sectionOrPanelText} settings` : `${gate ? "Gate" : sectionOrPanelText.charAt(0).toUpperCase() + sectionOrPanelText.slice(1)} settings`}
                >
                  <span>{settingsButtonLabel}</span>
                  {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
              <div className="flex justify-end">
                <ConfirmButton
                  onConfirm={() =>
                    dispatch({
                      type: "REMOVE_SEGMENT",
                      runId,
                      segmentId: seg.segmentId,
                    })
                  }
                  confirmLabel={<X size={14} strokeWidth={2.5} />}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50"
                  aria-label={gate ? "Remove gate" : `Remove ${sectionOrPanelText}`}
                  title={gate ? "Remove gate" : `Remove ${sectionOrPanelText}`}
                >
                  <X size={14} strokeWidth={2.5} />
                </ConfirmButton>
              </div>
            </div>
            <div
              className="min-w-0 truncate text-[11px] font-medium leading-tight text-[#6E7681]"
              title={matchesMaster ? "Inherits run" : summaryText}
            >
              {matchesMaster ? "Inherits run" : summaryText}
            </div>

          </div>

        </div>

        {open && (
          <div className="space-y-4 border-t border-brand-border/50 bg-brand-bg/50 p-3">
            {showRunDefaultsTeaching && (
              <div className="relative rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-3 py-2 pr-9">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-warning">
                  RUN DEFAULTS
                </p>
                <p className="mt-1 text-[13.5px] font-semibold leading-relaxed text-brand-text">
                  These settings become the default for every section in this run. You can override per segment later by double-clicking the segment.
                </p>
                <button
                  type="button"
                  onClick={onDismissRunDefaultsTeaching}
                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-card hover:text-brand-danger"
                  aria-label="Dismiss run defaults teaching"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-brand-muted">
                  {gate || isBayg ? "Width (mm)" : "Length (m)"}
                </span>
                <NumberInput
                  value={gate || isBayg ? Number(seg.segmentWidthMm ?? 0) : parseFloat(((seg.segmentWidthMm ?? 0) / 1000).toFixed(2))}
                  step={gate || isBayg ? 50 : 0.01}
                  min={0}
                  className="w-28 px-2 py-1.5 text-center tabular-nums"
                  onChange={(v) =>
                    updateGeometry(
                      "segmentWidthMm",
                      gate || isBayg ? Math.round(Number(v)) : Math.round(Number(v) * 1000),
                    )
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <div className="flex items-center gap-1">

                  <span className="text-sm font-bold text-brand-muted">Height (mm)</span>

                </div>
                {productCode === "VS" ? (
                  <>

                    <NumberInput
                      value={seg.targetHeightMm ?? 1800}
                      className="w-24 px-2 py-1.5 text-center tabular-nums"
                      onChange={(v) => updateGeometry("targetHeightMm", Number(v))}
                    />
                  </>
                ) : heightEntries.length > 0 && heightInputsReady ? (
                  <>
                    <select
                      value={selectedHeight}
                      onChange={(event) => {
                        const entry = heightEntries.find(
                          (item) => item.height === Number(event.target.value),
                        );
                        if (entry) updateDerivedHeight(entry);
                      }}
                      className="w-44 rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-sm font-semibold text-brand-text shadow-sm outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                    >
                      {heightEntries.map((entry) => (
                        <option key={entry.N} value={entry.height}>
                          {productCode.startsWith("AF_") ? `${entry.height}mm` : `${entry.height}mm - ${entry.N} slats`}
                        </option>
                      ))}
                    </select>

                  </>
                ) : (
                  <select
                    disabled
                    className="w-52 rounded-lg border border-brand-border bg-brand-card/70 px-3 py-2 text-sm font-semibold text-brand-muted shadow-sm"
                  >
                    <option>Select slat size and gap first</option>
                  </select>
                )}
                {productCode === "VS" ? (
                  <span className="text-xs text-brand-muted/70">Custom height</span>
                ) : (
                  <span className="text-xs text-brand-muted">Calculated for {segmentVariables.slat_size_mm ?? "?"}mm x {segmentVariables.slat_gap_mm ?? "?"}mm gap</span>
                )}
              </label>
              {isBayg && !gate && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-brand-muted">Quantity</span>
                  <NumberInput
                    value={Math.max(1, Math.round(Number(seg.variables?.panel_quantity ?? 1)))}
                    step={1}
                    min={1}
                    className="w-24 px-2 py-1.5 text-center tabular-nums"
                    onChange={(v) => updatePanelQuantity(Number(v))}
                  />
                </label>
              )}
            </div>
            {gateWidthValidation?.status === "warning" && (
              <div className="rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-3 py-2 text-xs font-bold text-brand-warning">
                {gateWidthValidation.message}
              </div>
            )}
            {gateWidthValidation?.status === "error" && (
              <div className="space-y-2 rounded-lg border border-brand-danger/40 bg-brand-danger/10 px-3 py-2 text-xs font-bold text-brand-danger">
                <p>{gateWidthValidation.message}</p>
                {gateWidthValidation.alternative && (
                  <button
                    type="button"
                    onClick={switchGateToAlternative}
                    className="min-h-11 rounded-lg border border-brand-danger/50 bg-brand-card px-3 py-2 text-xs font-black text-brand-danger hover:shadow-sm"
                  >
                    Switch to {gateTypeLabel(gateWidthValidation.alternative)}
                  </button>
                )}
              </div>
            )}
            <div className="rounded-lg border border-brand-border/60 bg-brand-card/70 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E7681]">
                {matchesMaster ? "Settings match run settings" : "Settings that differ from run settings"}
              </p>
              {!matchesMaster && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-tight">
                  {visibleSettings.filter((item) => item.changed).map((item) => (
                    <SummaryBit key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              )}
            </div>
            {gate ? (
              <GateSegmentDetails runId={runId} seg={seg} />
            ) : (
              <FenceSegmentDetails runId={runId} seg={seg} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
