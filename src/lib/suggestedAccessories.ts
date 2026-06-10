import type { CanonicalPayload, CanonicalRun } from "../types/canonical.types";
import type { BOMLineItem, ExtraItem } from "../types/bom.types";
import { getComponent } from "./localSeedData";
import { priceForSku } from "./localBomCalculator";
import { clampPostSpacing, maxPanelWidthForSystem } from "./productOptionRules";
import { GATE_SEGMENT_STUB_KEYS } from "./segmentTermination";

type Variables = Record<string, string | number | boolean | undefined>;

export type SuggestedAccessory = ExtraItem & {
  category: "fixing" | "finish" | "post_accessory" | "catalogue_gap";
  reason: string;
  priced: boolean;
};

const POST_COLOURS = new Set([
  "B",
  "MN",
  "G",
  "SM",
  "W",
  "BS",
  "D",
  "M",
  "P",
  "PB",
  "S",
]);

const ALUMAWOOD_CORE_COLOURS = new Set(["KWI", "WRC"]);
const CSR_PLATE_COLOURS = new Set(["B", "BS", "D", "G", "M", "MN", "S", "SM", "W"]);
const LIGHT_POST_PLUG_COLOURS = new Set(["W", "SM", "P", "PB", "S"]);
const MONUMENT_POST_PLUG_COLOURS = new Set(["MN", "BS", "D", "G", "M"]);
const DIAMOND_REVOLUTION_KIT_SKUS = [
  "REV-CD-2S",
  "REV-STAND",
  "REV-TEMPLATE",
  "REV-LEVEL",
  "REV-GUARD",
  "REV-BASE",
  "REV-BIT-08",
  "REV-BIT-10",
  "REV-BIT-12",
  "REV-BIT-14",
  "REV-BIT-20",
  "REV-BIT-42",
  "REV-BIT-53",
  "REV-BIT-63",
  "REV-BIT-76",
  "REV-BIT-83",
  "REV-BIT-89",
] as const;

const roundQty = (value: number) => Math.max(1, Math.ceil(value));

function diamondRevolutionKitTotal() {
  return DIAMOND_REVOLUTION_KIT_SKUS.reduce(
    (sum, sku) => sum + priceForSku(sku, 1),
    0,
  );
}

function postCountForRun(run: CanonicalRun) {
  const runVars = run.variables ?? {};
  const baseMaxPanelWidth = clampPostSpacing(
    runVars.max_panel_width_mm,
    maxPanelWidthForSystem(run.productCode),
  );
  const internalPosts = run.segments
    .filter((segment) => segment.segmentKind !== "gate_opening")
    .reduce((sum, segment) => {
      const maxPanelWidth = clampPostSpacing(
        segment.variables?.max_panel_width_mm,
        baseMaxPanelWidth,
      );
      const panels = Math.max(
        1,
        Math.ceil(Number(segment.segmentWidthMm ?? 0) / maxPanelWidth),
      );
      return sum + Math.max(0, panels - 1);
    }, 0);

  return internalPosts + (
    (run.leftBoundary!.type === "product_post" ? 1 : 0) +
    (run.rightBoundary!.type === "product_post" ? 1 : 0) +
    run.corners!.length
  );
}

function mergedVars(payload: CanonicalPayload, run: CanonicalRun): Variables {
  return { ...payload.variables, ...(run.variables ?? {}) };
}

function componentSuggestion(
  sku: string,
  quantity: number,
  category: SuggestedAccessory["category"],
  reason: string,
  fallbackDescription: string,
): SuggestedAccessory {
  const component = getComponent(sku);
  return {
    id: `suggested-${sku}`,
    sku,
    description: component?.description ?? component?.name ?? fallbackDescription,
    quantity: roundQty(quantity),
    unitPrice: component?.default_price ?? 0,
    category,
    reason,
    priced: typeof component?.default_price === "number" && component.default_price > 0,
  };
}

function postColourFromVars(vars: Variables) {
  const explicitPostColour = String(vars.post_colour_code ?? "");
  if (POST_COLOURS.has(explicitPostColour)) return explicitPostColour;

  const fenceColour = String(vars.colour_code ?? vars.colour ?? "B");
  return POST_COLOURS.has(fenceColour) ? fenceColour : "MN";
}

function csrPlateColour(colour: string) {
  return CSR_PLATE_COLOURS.has(colour) ? colour : "MN";
}

function csrPlateSku(vars: Variables) {
  const finishFamily = String(vars.finish_family ?? "standard");
  const fenceColour = String(vars.colour_code ?? vars.colour ?? "B");
  const postColour = postColourFromVars(vars);
  if (finishFamily === "alumawood" && ALUMAWOOD_CORE_COLOURS.has(fenceColour)) {
    return "AW-BTP-TR";
  }
  return `XP-BTP-${csrPlateColour(postColour)}`;
}

function csrSku(vars: Variables) {
  const finishFamily = String(vars.finish_family ?? "standard");
  const fenceColour = String(vars.colour_code ?? vars.colour ?? "B");
  if (finishFamily === "alumawood" && ALUMAWOOD_CORE_COLOURS.has(fenceColour)) {
    return `AW-5800-CSR-${fenceColour}`;
  }
  return `XP-5800-CSR-${postColourFromVars(vars)}`;
}

function csrCapSku(vars: Variables) {
  return `XP-CSRC-${csrPlateColour(postColourFromVars(vars))}`;
}

function postPlugSku(vars: Variables) {
  const colour = postColourFromVars(vars);
  if (colour === "B") return "SS-POSTPLUG-4PK";
  if (colour === "W") return "SS-POSTPLUG-4PK-W";
  if (colour === "MN") return "SS-POSTPLUG-4PK-MN";
  if (LIGHT_POST_PLUG_COLOURS.has(colour)) return "SS-POSTPLUG-4PK-W";
  if (MONUMENT_POST_PLUG_COLOURS.has(colour)) return "SS-POSTPLUG-4PK-MN";
  return "SS-POSTPLUG-4PK";
}

function fencePanelCounts(run: CanonicalRun, vars: Variables) {
  const baseMaxPanelWidth = clampPostSpacing(
    vars.max_panel_width_mm,
    maxPanelWidthForSystem(run.productCode),
  );

  return run.segments
    .filter((segment) => segment.segmentKind !== "gate_opening")
    .map((segment) => {
      const maxPanelWidth = clampPostSpacing(
        segment.variables?.max_panel_width_mm,
        baseMaxPanelWidth,
      );
      const width = Number(segment.segmentWidthMm ?? 0);
      const panels = width > 0 ? Math.max(1, Math.ceil(width / maxPanelWidth)) : 0;
      return {
        panels,
        panelWidthMm: panels > 0 ? width / panels : 0,
      };
    });
}

function hasBomSku(bomSkus: Set<string>, sku: string) {
  return bomSkus.has(sku);
}

export function suggestAccessories(
  payload: CanonicalPayload,
  bomLines: BOMLineItem[],
): SuggestedAccessory[] {
  const suggestions: SuggestedAccessory[] = [];
  const bomSkus = new Set(bomLines.map((line) => line.sku));
  const isAF = payload.runs.some((run) => run.productCode.startsWith("AF_"));

  for (const run of payload.runs) {
    const vars = mergedVars(payload, run);
    const postCount = postCountForRun(run);
    const mountingType = String(
      vars.mounting_type ?? vars.mounting_method ?? "in_ground",
    );
    const postColour = postColourFromVars(vars);
    const finishFamily = String(vars.finish_family ?? "standard");
    const firstFenceSegment = run.segments.find((segment) => segment.segmentKind !== "gate_opening");
    const postHeight = Number(firstFenceSegment?.targetHeightMm ?? vars.target_height_mm ?? 1800);
    const gateCount = run.segments.filter((segment) => segment.segmentKind === "gate_opening").length;

    if (isAF) {
      if (run.productCode === "AF_COLORBOND" || run.productCode === "AF_PERMASTEEL") {
        suggestions.push(
          componentSuggestion(
            "AF-CBD-TOUCHUP-PAINT",
            1,
            "finish",
            "Suggested for colour-matched touch-ups after cutting and installation.",
            "Touch-up Paint"
          )
        );
        suggestions.push(
          componentSuggestion(
            "AF-CBD-SCREW-COLOURED-SD10",
            50,
            "fixing",
            "Coloured hex screws for steel panel and rail fixings.",
            "Coloured Screw SD 10-16 × 16mm Hex"
          )
        );
        if (mountingType === "in_ground" || mountingType === "concreted-in-ground" || mountingType === "in-ground") {
          suggestions.push(
            componentSuggestion(
              "AF-CON-RAPID-30",
              postCount * 2,
              "fixing",
              "Rapid set concrete for posts concreted in ground.",
              "Rapid Set 30kg"
            )
          );
        }
      } else if (run.productCode === "AF_TIMBER_PALING" || run.productCode === "AF_TIMBER_SLAT") {
        if (mountingType === "in_ground" || mountingType === "concreted-in-ground" || mountingType === "in-ground") {
          suggestions.push(
            componentSuggestion(
              "AF-CON-RAPID-30",
              postCount * 2,
              "fixing",
              "Rapid set concrete for timber posts concreted in ground.",
              "Rapid Set 30kg"
            )
          );
        }
        suggestions.push(
          componentSuggestion(
            "AF-SCR-BB-14g-100-500",
            1,
            "fixing",
            "Batten screws 14g × 100mm, galvanised, for framing.",
            "Batten Screws 14g × 100mm Galv (500 pack)"
          )
        );
        suggestions.push(
          componentSuggestion(
            "AF-NAIL-COIL-45-250",
            1,
            "fixing",
            "Coil nails 45mm ring shank galvanised for paling installation.",
            "Coil Nails 45mm Ring M Gal (250 pack)"
          )
        );
        suggestions.push(
          componentSuggestion(
            "AF-NAIL-COIL-57-250",
            1,
            "fixing",
            "Coil nails 57mm ring shank galvanised for rails/posts installation.",
            "Coil Nails 57mm Ring M Gal (250 pack)"
          )
        );
      } else {
        if (mountingType === "in_ground" || mountingType === "concreted-in-ground" || mountingType === "in-ground") {
          suggestions.push(
            componentSuggestion(
              "AF-CON-RAPID-30",
              postCount * 2,
              "fixing",
              "Rapid set concrete for posts concreted in ground.",
              "Rapid Set 30kg"
            )
          );
        }
      }
      continue;
    }

    const postSize = Number(vars.post_size ?? 50);

    if (gateCount > 0) {
      suggestions.push(
        componentSuggestion(
          "LL-GH",
          gateCount,
          "catalogue_gap",
          "Optional D&D black polymer side-fixing gate handle, suggested once per gate.",
          "D&D black polymer side-fixing gate handle",
        ),
      );
    }

    if (postCount <= 0) continue;

    if (mountingType === "core_drill") {
      const dressRingSku =
        postSize === 65 ? `XP-65DR-${postColour}` : `XP-DR-${postColour}`;
      if (!hasBomSku(bomSkus, dressRingSku)) {
        suggestions.push(
          componentSuggestion(
            dressRingSku,
            postCount,
            "post_accessory",
            "Dress rings suit core-drilled posts.",
            "Core-drill dress ring",
          ),
        );
      }

      suggestions.push(
        componentSuggestion(
          postPlugSku(vars),
          Math.ceil(postCount / 4),
          "post_accessory",
          "Post plugs cap fixing-hole posts; selected in the nearest available B / MN / W finish.",
          "32mm OD post plug 4 pack",
        ),
      );
      suggestions.push(
        componentSuggestion(
          "SOUD-EPOFIX",
          1,
          "fixing",
          "Epoxy option for core-drilled post fixing.",
          "Soudal Epofix epoxy",
        ),
      );
      if (postCount > 5) {
        const kitTotal = diamondRevolutionKitTotal();
        const kitReason =
          kitTotal > 0
            ? `Need a core drill? Full Diamond Revolution kit totals about $${kitTotal.toFixed(2)} ex-GST from current SKU prices.`
            : "Need a core drill? We sell a full Diamond Revolution kit for larger core-drilled jobs.";
        for (const sku of DIAMOND_REVOLUTION_KIT_SKUS) {
          suggestions.push(
            componentSuggestion(
              sku,
              1,
              "catalogue_gap",
              kitReason,
              "Diamond Revolution core drilling kit item",
            ),
          );
        }
      }
    }

    if (mountingType === "base_plate") {
      const basePlateSku =
        postSize === 65
          ? `XP-65BP-SET-${postColour}`
          : `XP-BP-SET-${postColour}`;
      const coverSku =
        postSize === 65
          ? `XP-65DC-2P-${postColour}`
          : `XP-DC-2P-${postColour}`;

      if (!hasBomSku(bomSkus, basePlateSku)) {
        suggestions.push(
          componentSuggestion(
            basePlateSku,
            postCount,
            "post_accessory",
            "Base plate sets suit base-plate-mounted posts.",
            "Base plate set",
          ),
        );
      }
      if (!hasBomSku(bomSkus, coverSku)) {
        suggestions.push(
          componentSuggestion(
            coverSku,
            postCount,
            "post_accessory",
            "Cover rings tidy up base-plate-mounted posts.",
            "Base plate cover ring",
          ),
        );
      }
      suggestions.push(
        componentSuggestion(
          postPlugSku(vars),
          Math.ceil(postCount / 4),
          "post_accessory",
          "Post plugs cap fixing-hole posts; selected in the nearest available B / MN / W finish.",
          "32mm OD post plug 4 pack",
        ),
      );
      suggestions.push(
        componentSuggestion(
          "ULTRALOC-3242",
          1,
          "fixing",
          "Threadlocker for base-plate mounting fixings.",
          "Ultraloc 3242 threadlocker",
        ),
      );
      if (String(vars.base_plate_substrate ?? "concrete") === "concrete") {
        suggestions.push(
          componentSuggestion(
            "SOUD-CA1400",
            postCount,
            "fixing",
            "For damp or soft concrete; provides pressure-free anchor fixing.",
            "Soudafix chemical anchor",
          ),
        );
      }
    }

    if (finishFamily !== "alumawood") {
      const longPostSku =
        postSize === 65 ? `XP-6000-65HD-${postColour}` : `XP-6000-FP-${postColour}`;
      const cutLengthMm =
        mountingType === "in_ground" && postHeight <= 1200
          ? 1800
          : Math.min(6000, Math.max(1, postHeight));
      suggestions.push(
        componentSuggestion(
          longPostSku,
          Math.ceil((postCount * cutLengthMm) / 6000),
          "catalogue_gap",
          "Optional: full-length post stock if the installer wants to cut posts on site.",
          "Full-length post stock",
        ),
      );
    }

    const panelCounts = fencePanelCounts(run, vars);
    if (run.productCode === "VS") {
      const verticalPanelCount = panelCounts.reduce((sum, item) => sum + item.panels, 0);
      suggestions.push(
        componentSuggestion(
          "XP-FOOT-ADJ",
          verticalPanelCount,
          "post_accessory",
          "Suggested for vertical slat panels as a 100mm adjustable support foot.",
          "100mm adjustable support foot",
        ),
      );
    } else {
      const csrPlateCount = panelCounts.reduce((sum, item) => {
        const csrPerPanel =
          item.panelWidthMm < 2000 ? 0 : item.panelWidthMm < 4000 ? 1 : item.panelWidthMm < 6000 ? 2 : 3;
        return sum + csrPerPanel * item.panels * 2;
      }, 0);
      if (csrPlateCount > 0) {
        suggestions.push(
          componentSuggestion(
            csrPlateSku(vars),
            csrPlateCount,
            "post_accessory",
            "Optional: centre support rail top/base plates are suggested, not added to the standard BOM.",
            "Centre support rail top/base plate",
          ),
        );
      }
    }

    const shortSlidingGates = run.segments.filter((segment) => {
      if (segment.segmentKind !== "gate_opening") return false;
      const movement = String(segment.variables?.[GATE_SEGMENT_STUB_KEYS.gateMovement] ?? "");
      return movement === "sliding" && Number(segment.segmentWidthMm ?? 0) <= 3000;
    });
    if (shortSlidingGates.length > 0) {
      suggestions.push(
        componentSuggestion(
          csrSku(vars),
          shortSlidingGates.length,
          "catalogue_gap",
          "Optional: centre support rail for sliding gates at or under 3000mm.",
          "Optional sliding gate centre support rail",
        ),
      );
      suggestions.push(
        componentSuggestion(
          csrCapSku(vars),
          shortSlidingGates.length,
          "catalogue_gap",
          "Optional: cap to finish the sliding gate centre support rail.",
          "Optional centre support rail cap",
        ),
      );
      suggestions.push(
        componentSuggestion(
          csrPlateSku(vars),
          shortSlidingGates.length * 2,
          "catalogue_gap",
          "Optional: top and bottom plates if adding a sliding gate centre support rail.",
          "Optional centre support rail top/base plate",
        ),
      );
    }
  }

  if (!isAF) {
    const finishColours = new Set<string>();
    const fenceColour = String(payload.variables.colour_code ?? "B");
    finishColours.add(fenceColour);
    const postColour = postColourFromVars(payload.variables);
    finishColours.add(postColour);
    for (const run of payload.runs) {
      for (const segment of run.segments) {
        if (segment.segmentKind !== "gate_opening") continue;
        const gateColour = String(segment.variables?.[GATE_SEGMENT_STUB_KEYS.colourCode] ?? "");
        if (gateColour) finishColours.add(gateColour);
      }
    }

    for (const colour of finishColours) {
      const sku = `PAINT-${colour}`;
      suggestions.push(
        componentSuggestion(
          sku,
          1,
          "finish",
          "Suggested for colour-matched touch-ups after cutting and installation.",
          `Touch up paint - ${colour}`,
        ),
      );
    }

    if (bomSkus.has("SOUD-CA1400")) {
      suggestions.push(
        componentSuggestion(
          "SOUD-GUN",
          1,
          "fixing",
          "Heavy duty cartridge gun for SOUD-CA1400.",
          "Soudafix cartridge gun",
        ),
      );
    }

    if (bomSkus.has("QSG-JOINER65-4PK") || bomSkus.has("QSG-JOINER90-4PK")) {
      suggestions.push(
        componentSuggestion(
          "DB-PH3",
          1,
          "fixing",
          "Phillips #3 driver bit suits QuickScreen gate joiner block screws.",
          "Phillips #3 driver bit",
        ),
      );
    }

    if (bomSkus.has("AR-SCR-BR-50PK")) {
      suggestions.push(
        componentSuggestion(
          "DB-SQ3.4",
          1,
          "fixing",
          "Square #3.4 driver bit suits gate rail screws.",
          "Square #3.4 driver bit",
        ),
      );
    }

    if (payload.runs.length > 0) {
      suggestions.push(
        componentSuggestion(
          "FB-V60",
          1,
          "fixing",
          "General-purpose glazing silicone for finishing and sealing on site.",
          "Bostik V60 glazing silicone",
        ),
      );
    }
  }

  const deduped = new Map<string, SuggestedAccessory>();
  for (const suggestion of suggestions) {
    const key = suggestion.sku ?? suggestion.id;
    const existing = deduped.get(key);
    if (existing) {
      deduped.set(key, {
        ...existing,
        quantity: existing.quantity + suggestion.quantity,
      });
    } else {
      deduped.set(key, suggestion);
    }
  }

  return [...deduped.values()];
}

export const buildAccessorySuggestions = suggestAccessories;
