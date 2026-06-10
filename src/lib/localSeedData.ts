import qshsRaw from "../../supabase/seeds/glass-outlet/products/qshs.json?raw";
import baygRaw from "../../supabase/seeds/glass-outlet/products/bayg.json?raw";
import vsRaw from "../../supabase/seeds/glass-outlet/products/vs.json?raw";
import xplRaw from "../../supabase/seeds/glass-outlet/products/xpl.json?raw";
import qsGateRaw from "../../supabase/seeds/glass-outlet/products/qs_gate.json?raw";
import priceCatalogueRaw from "../../supabase/seeds/glass-outlet/products/price_catalogue.json?raw";
import ccaPinePalingRaw from "../../supabase/seeds/discount-fencing/products/cca-pine-paling.json?raw";
import timberPalingRaw from "../../supabase/seeds/amazing-fencing/products/timber-paling.json?raw";
import colorbondRaw from "../../supabase/seeds/amazing-fencing/products/colorbond.json?raw";
import retainingWallRaw from "../../supabase/seeds/amazing-fencing/products/retaining-wall.json?raw";
import amazingPriceCatalogueRaw from "../../supabase/seeds/amazing-fencing/products/price_catalogue.json?raw";
import type { Product } from "../hooks/useProducts";
import type { SchemaField } from "../components/calculator-v3/SchemaDrivenForm";
import type { ProductSearchItem } from "../hooks/useProductSearch";

type SeedProduct = Product & { product_type?: string };

type SeedComponent = {
  sku: string;
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  companionOf?: string;
  sortPriority?: number;
  isOptionalAccessory?: boolean;
  optionalChildOf?: string[];
  qtyPerParent?: number;
  qtyFormula?: string | null;
  unit?: string;
  default_price?: number;
  system_types?: string[];
  metadata?: Record<string, unknown>;
  active?: boolean;
};

type SeedVariable = {
  product_system_type: string;
  name: string;
  label: string;
  data_type: string;
  unit?: string | null;
  required?: boolean;
  default_value_json?: unknown;
  options_json?: unknown[];
  scope: "job" | "run" | "segment";
  sort_order?: number;
  options_group?: string | null;
  active?: boolean;
};

export type LocalPricingRule = {
  sku: string;
  tier_code: "tier1" | "tier2" | "tier3";
  rule?: string | null;
  price: number;
  priority?: number;
  active?: boolean;
};

type SeedFile = {
  products?: SeedProduct[];
  product_components?: SeedComponent[];
  product_variables?: SeedVariable[];
  pricing_rules?: LocalPricingRule[];
};

const seedFiles: SeedFile[] = [
  JSON.parse(qshsRaw) as SeedFile,
  JSON.parse(baygRaw) as SeedFile,
  JSON.parse(vsRaw) as SeedFile,
  JSON.parse(xplRaw) as SeedFile,
  JSON.parse(qsGateRaw) as SeedFile,
  JSON.parse(priceCatalogueRaw) as SeedFile,
  JSON.parse(ccaPinePalingRaw) as SeedFile,
  JSON.parse(timberPalingRaw) as SeedFile,
  JSON.parse(colorbondRaw) as SeedFile,
  JSON.parse(retainingWallRaw) as SeedFile,
  JSON.parse(amazingPriceCatalogueRaw) as SeedFile,
];

function component(
  sku: string,
  name: string,
  description: string,
  category: string,
  unit: string,
  defaultPrice: number,
  systemTypes: string[] = ["QSHS"],
): SeedComponent {
  return {
    sku,
    name,
    description,
    category,
    unit,
    default_price: defaultPrice,
    system_types: systemTypes,
    active: true,
  };
}

function pricing(
  sku: string,
  tier1: number,
  tier2: number,
  tier3: number,
): LocalPricingRule[] {
  return [
    { sku, tier_code: "tier1", rule: null, price: tier1, priority: 0, active: true },
    { sku, tier_code: "tier2", rule: null, price: tier2, priority: 0, active: true },
    { sku, tier_code: "tier3", rule: null, price: tier3, priority: 0, active: true },
  ];
}

const QSG_GATE_COLOUR_CODES = ["B", "BS", "D", "G", "M", "MN", "P", "PB", "S", "SM", "W"] as const;

function qsgGateColourPrice(colour: string, coatedPrice: number, millPrice: number): number {
  return colour === "M" ? millPrice : coatedPrice;
}

const syntheticComponents: SeedComponent[] = [
  {
    sku: "PAINT-B",
    name: "Touch Up Paint Black Satin",
    description: "Touch up paint spray can - Black Satin",
    category: "accessory",
    unit: "each",
    default_price: 11.35,
    system_types: ["QSHS", "VS", "XPL", "BAYG"],
    active: true,
  },
  {
    sku: "PAINT-MN",
    name: "Touch Up Paint Monument Matt",
    description: "Touch up paint spray can - Monument Matt",
    category: "accessory",
    unit: "each",
    default_price: 11.35,
    system_types: ["QSHS", "VS", "XPL", "BAYG"],
    active: true,
  },
  {
    sku: "XP-6500-E65-B",
    name: "65mm Economy Slat Black Satin",
    description: "65mm Economy slat, no centre web, 6500mm stock",
    category: "slat",
    unit: "length",
    default_price: 32.85,
    system_types: ["QSHS", "VS"],
    active: true,
  },
  {
    sku: "XP-6500-E65-MN",
    name: "65mm Economy Slat Monument Matt",
    description: "65mm Economy slat, no centre web, 6500mm stock",
    category: "slat",
    unit: "length",
    default_price: 32.85,
    system_types: ["QSHS", "VS"],
    active: true,
  },
  {
    sku: "XP-6500-E65-SM",
    name: "65mm Economy Slat Surfmist",
    description: "65mm Economy slat, no centre web, 6500mm stock",
    category: "slat",
    unit: "length",
    default_price: 31.05,
    system_types: ["QSHS", "VS"],
    active: true,
  },
  component(
    "XP-1800-FP-MN",
    "XPRESS 50mm Full Post Monument 1800mm",
    "XPRESS Screening 50 x 50mm full post, 1800mm long - Monument Matt",
    "post",
    "each",
    26,
    ["QSHS", "BAYG", "VS", "XPL"],
  ),
  component(
    "XP-1800-FP-W",
    "XPRESS 50mm Full Post Pearl White 1800mm",
    "XPRESS Screening 50 x 50mm full post, 1800mm long - Pearl White Gloss",
    "post",
    "each",
    26,
    ["QSHS", "BAYG", "VS", "XPL"],
  ),
  component(
    "XP-FOOT-ADJ",
    "XPRESS 100mm Adjustable Support Foot",
    "XPRESS Screening 100mm support foot, height adjustable, SS316 polished",
    "post_accessory",
    "each",
    12.24,
    ["VS"],
  ),
  ...QSG_GATE_COLOUR_CODES.flatMap((colour) => [
    component(
      `QSG-4200-GSF50-${colour}`,
      `QSG 50x50 Gate Side Frame ${colour}`,
      `QuickScreen Gate System 50x50mm gate side frame, 4200mm stock - ${colour}`,
      "gate_side_frame",
      "length",
      qsgGateColourPrice(colour, 90.04, 80.59),
      ["GATE"],
    ),
    component(
      `QSG-4800-RAIL65-${colour}`,
      `QSG 65mm Horizontal Gate Rail ${colour}`,
      `QuickScreen Gate System 65x50mm horizontal gate rail, 4800mm stock - ${colour}`,
      "gate_rail",
      "length",
      0,
      ["GATE"],
    ),
    component(
      `QSG-4800-RAIL90-${colour}`,
      `QSG 90mm Horizontal Gate Rail ${colour}`,
      `QuickScreen Gate System 90x50mm horizontal gate rail, 4800mm stock - ${colour}`,
      "gate_rail",
      "length",
      0,
      ["GATE"],
    ),
    component(
      `QSG-S-6100-TR65-${colour}`,
      `QSG 65mm Sliding Gate Top Rail ${colour}`,
      `QuickScreen Gate System 65mm sliding gate top rail, 6100mm stock - ${colour}`,
      "gate_rail",
      "length",
      colour === "M" ? 134.78 : 147.48,
      ["GATE"],
    ),
    component(
      `QSG-S-6100-TR90-${colour}`,
      `QSG 90mm Sliding Gate Top Rail ${colour}`,
      `QuickScreen Gate System 90mm sliding gate top rail, 6100mm stock - ${colour}`,
      "gate_rail",
      "length",
      colour === "M" ? 134.78 : 147.48,
      ["GATE"],
    ),
    component(
      `QSG-S-6100-BR-${colour}`,
      `QSG Sliding Gate Bottom Rail ${colour}`,
      `QuickScreen Gate System sliding gate bottom rail, 6100mm stock - ${colour}`,
      "gate_rail",
      "length",
      colour === "M" ? 134.78 : 147.48,
      ["GATE"],
    ),
    component(
      `QSG-4800-INF-${colour}`,
      `QSG Gate Infill ${colour}`,
      `QuickScreen Gate System gate infill, 4800mm stock - ${colour}`,
      "gate_infill",
      "length",
      qsgGateColourPrice(colour, 15.7, 11.29),
      ["GATE"],
    ),
    component(
      `QSG-4200-CINF-${colour}`,
      `QSG Channel Infill ${colour}`,
      `QuickScreen Gate System channel infill, 4200mm stock - ${colour}`,
      "gate_infill",
      "length",
      qsgGateColourPrice(colour, 39.65, 28.96),
      ["GATE"],
    ),
    component(
      `QSG-4200-COVER-${colour}`,
      `QSG Gate Screw Cover ${colour}`,
      `QuickScreen Gate System screw cover, 4200mm stock - ${colour}`,
      "gate_screw_cover",
      "length",
      qsgGateColourPrice(colour, 8.03, 5.51),
      ["GATE"],
    ),
    component(
      `QSG-GFC-50X50-${colour}`,
      `QSG 50x50 Gate Top Cap ${colour}`,
      `QuickScreen Gate System 50x50mm flat gate top cap - ${colour}`,
      "frame_top_cap",
      "each",
      qsgGateColourPrice(colour, 2.73, 2.31),
      ["GATE"],
    ),
  ]),
  ...[
    ["KF-AH-AT", "D&D Kwik Fit aluminium hinge adjustable tension", 45.45],
    ["KF-H-FT", "D&D Kwik Fit hinge set fixed tension pair", 14.5],
    ["KF-H-NT", "D&D Kwik Fit hinge set no tension pair", 12.5],
    ["TC-H-AT-B", "D&D TruClose hinge set adjustable tension - black", 25.52],
    ["TC-H-AT-2L-B", "D&D TruClose two-leg adjustable tension hinge - black", 25.52],
    ["TC-H-AT-HD-B", "D&D TruClose heavy duty hinge set adjustable tension - black", 39.75],
    ["TC-H-AT-HD-2L-B", "D&D TruClose heavy duty two-leg hinge - black", 40.49],
    ["TC-CAPS3", "D&D TruClose hinge safety caps", 1.39],
    ["SURECLOSE-HH", "D&D SureClose ReadyFit hydraulic hinge closer", 340.64],
    ["SURECLOSE-NSC", "D&D SureClose ReadyFit non self-closing hinge", 142.21],
    ["SS-BH10075-B", "Six Star 100x75 butt hinge - black", 5.1],
    ["ZF-BBH-L", "Zeus ball bearing hinge - left hand", 18.46],
    ["ZF-BBH-R", "Zeus ball bearing hinge - right hand", 18.46],
    ["CB-HINGE-B-2PK", "Colourbond hinge pair - black", 8.22],
    ["LL-DL", "D&D Lokk Latch Deluxe lockable keyed different", 65.12],
    ["LL-DL-KA", "D&D Lokk Latch Deluxe lockable keyed alike", 66.07],
    ["LL-DL-W", "D&D Lokk Latch Deluxe lockable - white", 73.89],
    ["LLAA", "D&D Lokk Latch general purpose lockable latch", 27.79],
    ["LLAA-W", "D&D Lokk Latch general purpose lockable latch - white", 33.27],
    ["LLB", "D&D Lokk Latch external access push-button kit", 19.36],
    ["T-L", "D&D T-Latch padlockable", 18.69],
    ["ML-TL-W", "D&D Magna Latch top pull - white", 51.87],
    ["QB124", "D&D Q-Bolt 610mm padlockable drop bolt", 45],
    ["LB-PL", "D&D Lokk Bolt 450mm lockable security drop bolt", 72.42],
    ["ZF-DB400-B", "Zeus Fencing 400mm drop bolt - black", 9.26],
    ["SS-0300DB-B", "300mm drop bolt - black powdercoated", 3.95],
    ["SS-0300DB-ZP", "300mm drop bolt - zinc plated", 5.1],
    ["SS-DL-B", "Six Star tubular D latch and striker - black", 8.62],
    ["MR-FMLSL", "D&D Magna Latch side-pull latch", 36.4],
    ["LL-GH", "D&D Lokk Latch gate handle", 5.9],
    ["SS-GS", "D&D gate stop", 7.02],
    ["SS-GS-SLIMLINE", "Slimline gate stop", 3.02],
    ["KF-AH-AT-W", "D&D Kwik Fit aluminium adjustable hinge - white", 49.4],
    ["TC-H-AT-2L-W", "D&D TruClose two-leg adjustable tension hinge - white", 31.78],
    ["TC-H-AT-HD-2L-W", "D&D TruClose heavy duty two-leg hinge - white", 54.05],
    ["XPSG-3000-TRACK-ST", "XPRESS sliding gate steel track 3000mm", 26.52],
    ["XPSG-6000-TRACK-ST", "XPRESS sliding gate steel track 6000mm", 50.44],
    ["XPSG-6000-TRACK-AL", "XPRESS sliding gate aluminium track 6000mm", 54.08],
    ["XPSG-ANCHOR", "XPRESS sliding gate galvanised steel track anchor pin", 0.72],
    ["XPSG-CATCH-F", "XPRESS sliding gate adjustable F catch", 27.37],
    ["XPSG-CATCH-U", "XPRESS sliding gate U catch", 13.88],
    ["XPSG-FILO-400", "XPRESS FILO 400 Pro sliding gate motor kit", 726.55],
    ["XPSG-FILO-400PRO-SP", "XPRESS FILO 400 Pro split-pack motor kit", 847.85],
    ["XPSG-FILO-BATTERY", "Backup battery for FILO sliding gate motor", 189.22],
    ["XPSG-FILO-RACK", "Rack for sliding gate motor, 1m section", 25.48],
    ["XPSG-FILO-REMOTE", "Remote control for FILO 400 motor", 59.03],
    ["XPSG-FILO-SOLAR", "Solar power kit for FILO 400 motor", 758.16],
    ["XPSG-FILO-WKP", "Wireless keypad for FILO 400 motor", 199.32],
    ["XPSG-GUIDE", "XPRESS sliding gate self-adjusting slide guide", 38.69],
    ["XPSG-STOP", "XPRESS sliding gate bolt down stop", 18.2],
    ["XPSG-TOPROLL-2PK", "XPRESS sliding gate nylon top roller 2 pack", 37.96],
    ["XPSG-WHEEL", "XPRESS sliding gate 80mm wheel", 21.53],
    ["XPSG-WHEEL-CS", "XPRESS sliding gate wheel clamping set 2 pack", 6],
    ["QSG-S-WHEEL", "QuickScreen sliding gate 80mm wheel", 21.53],
    ["QSG-S-WHEEL-CS-2PK", "QuickScreen sliding gate wheel clamping set 2 pack", 6],
  ].map(([sku, description, price]) =>
    component(
      String(sku),
      String(description),
      String(description),
      "hardware",
      "each",
      Number(price),
      ["GATE", "QS_GATE", "XPL"],
    ),
  ),
  ...["B", "BS", "D", "G", "MN", "P", "PB", "S", "SM", "W"].map((colour) =>
    component(
      `XP-6000-135-${colour}`,
      `XPRESS/QuickScreen 135 Degree Adapter ${colour}`,
      `XPRESS/QuickScreen 44 x 22mm 135 degree adapter, 6000mm stock - ${colour}`,
      "accessory",
      "length",
      42.63,
      ["QSHS", "BAYG", "VS"],
    ),
  ),
  ...["B", "BS", "D", "G", "M", "MN", "PB", "S", "SM", "W"].map((colour) =>
    component(
      `QS-LB-${colour}`,
      `QuickScreen/Xpress Louvre Bracket Pack ${colour}`,
      `Louvre bracket pack for 65 x 16.5mm slat, includes left bracket, right bracket and screws - ${colour}`,
      "bracket",
      "pack",
      colour === "M" ? 3.4 : colour === "PB" || colour === "W" ? 4.26 : 4.43,
      ["QSHS"],
    ),
  ),
  component(
    "XP-6000-135-M",
    "XPRESS/QuickScreen 135 Degree Adapter Mill",
    "XPRESS/QuickScreen 44 x 22mm 135 degree adapter, 6000mm stock - Mill",
    "accessory",
    "length",
    34.87,
    ["QSHS", "BAYG", "VS"],
  ),
  component(
    "AW-5800-135-KWI",
    "Alumawood 135 Degree Adapter Kwila",
    "Alumawood 44 x 22mm 135 degree adapter, 5800mm stock - Kwila",
    "accessory",
    "length",
    65.73,
    ["QSHS", "BAYG", "VS"],
  ),
  component(
    "AW-5800-135-WRC",
    "Alumawood 135 Degree Adapter Western Red Cedar",
    "Alumawood 44 x 22mm 135 degree adapter, 5800mm stock - Western Red Cedar",
    "accessory",
    "length",
    65.73,
    ["QSHS", "BAYG", "VS"],
  ),
  component(
    "QS-SCREWS-50PK",
    "QuickScreen 10gx16mm Screws 50 Pack",
    "QuickScreen 10gx16mm screws, 50 pack",
    "screw",
    "pack",
    1.42,
  ),
  ...["B", "BS", "D", "G", "M", "MN", "P", "S", "SM", "W"].map((colour) =>
    component(
      `XP-SCREWS-${colour}`,
      `XPRESS Screening Screws ${colour}`,
      `XPRESS Screening 10g x 16mm self drilling wafer head screws, bag of 100 - ${colour}`,
      "screw",
      "pack",
      6.36,
    ),
  ),
  ...[
    ["05MM", "5", 1.42],
    ["09MM", "9", 2.63],
    ["12MM", "12", 3.47],
    ["15MM", "15", 4.1],
    ["20MM", "20", 5.2],
    ["30MM", "30", 7.3],
  ].map(([gapCode, gapLabel, price]) =>
    component(
      `QS-SPACER-${gapCode}-50PK`,
      `QuickScreen ${gapLabel}mm Spacer 50 Pack`,
      `QuickScreen snap-in spacer for ${gapLabel}mm slat gap, 50 pack`,
      "accessory",
      "pack",
      Number(price),
    ),
  ),
  component(
    "AW-5800-S65-KWI",
    "Alumawood 65mm Slat Kwila",
    "Alumawood 65 x 16.5mm slat, 5800mm stock - Kwila",
    "slat",
    "length",
    50.49,
  ),
  component(
    "AW-5800-S65-WRC",
    "Alumawood 65mm Slat Western Red Cedar",
    "Alumawood 65 x 16.5mm slat, 5800mm stock - Western Red Cedar",
    "slat",
    "length",
    50.49,
  ),
  component(
    "AWQS-5800-S90-WRC",
    "Alumawood 90mm QuickScreen Slat Western Red Cedar",
    "Alumawood 90 x 16.5mm QuickScreen slat with centre web, 5800mm stock - Western Red Cedar",
    "slat",
    "length",
    64.72,
  ),
  component(
    "AWQS-5800-SF-KWI",
    "Alumawood QuickScreen Side Frame Kwila",
    "Alumawood QuickScreen 27 x 26mm side frame, 5800mm stock - Kwila",
    "side_frame",
    "length",
    35.21,
  ),
  component(
    "AWQS-5800-SF-WRC",
    "Alumawood QuickScreen Side Frame Western Red Cedar",
    "Alumawood QuickScreen 27 x 26mm side frame, 5800mm stock - Western Red Cedar",
    "side_frame",
    "length",
    35.21,
  ),
  component(
    "AWQS-5800-CFC-KWI",
    "Alumawood QuickScreen Concealed Fixing Cover Kwila",
    "Alumawood QuickScreen concealed fixing cover, 5800mm stock - Kwila",
    "cfc_cover",
    "length",
    19.82,
  ),
  component(
    "AWQS-5800-CFC-WRC",
    "Alumawood QuickScreen Concealed Fixing Cover Western Red Cedar",
    "Alumawood QuickScreen concealed fixing cover, 5800mm stock - Western Red Cedar",
    "cfc_cover",
    "length",
    19.82,
  ),
  component(
    "AWQS-5800-F-KWI",
    "Alumawood QuickScreen F Section Kwila",
    "Alumawood QuickScreen 50 x 35mm F section, 5800mm stock - Kwila",
    "f_section",
    "length",
    42.11,
  ),
  component(
    "AWQS-5800-F-WRC",
    "Alumawood QuickScreen F Section Western Red Cedar",
    "Alumawood QuickScreen 50 x 35mm F section, 5800mm stock - Western Red Cedar",
    "f_section",
    "length",
    42.11,
  ),
  component(
    "AW-5800-CSR-KWI",
    "Alumawood Centre Support Rail Kwila",
    "Alumawood 40 x 13mm centre support rail with snap-on CFC, 5800mm stock - Kwila",
    "centre_support_rail",
    "length",
    51.59,
  ),
  component(
    "AW-5800-CSR-WRC",
    "Alumawood Centre Support Rail Western Red Cedar",
    "Alumawood 40 x 13mm centre support rail with snap-on CFC, 5800mm stock - Western Red Cedar",
    "centre_support_rail",
    "length",
    51.59,
  ),
  component(
    "AW-2400-FP-KWI",
    "Alumawood 50mm Full Post Kwila",
    "Alumawood 50 x 50mm full post, 2400mm long - Kwila",
    "post",
    "each",
    50.91,
  ),
  component(
    "AW-2400-FP-WRC",
    "Alumawood 50mm Full Post Western Red Cedar",
    "Alumawood 50 x 50mm full post, 2400mm long - Western Red Cedar",
    "post",
    "each",
    50.91,
  ),
  component(
    "AW-2400-65HD-KWI",
    "Alumawood 65mm Heavy Duty Post Kwila",
    "Alumawood 65 x 65mm heavy duty post, 2400mm long - Kwila",
    "post",
    "each",
    84.24,
  ),
  component(
    "AW-2400-65HD-WRC",
    "Alumawood 65mm Heavy Duty Post Western Red Cedar",
    "Alumawood 65 x 65mm heavy duty post, 2400mm long - Western Red Cedar",
    "post",
    "each",
    84.24,
  ),
  component(
    "AW-5800-FP-KWI",
    "Alumawood 50mm Full Post Kwila 5800mm",
    "Alumawood 50 x 50mm full post, 5800mm long - Kwila",
    "post",
    "each",
    109.67,
  ),
  component(
    "AW-5800-FP-WRC",
    "Alumawood 50mm Full Post Western Red Cedar 5800mm",
    "Alumawood 50 x 50mm full post, 5800mm long - Western Red Cedar",
    "post",
    "each",
    109.67,
  ),
  component(
    "AW-5800-65HD-KWI",
    "Alumawood 65mm Heavy Duty Post Kwila 5800mm",
    "Alumawood 65 x 65mm heavy duty post, 5800mm long - Kwila",
    "post",
    "each",
    187.14,
  ),
  component(
    "AW-5800-65HD-WRC",
    "Alumawood 65mm Heavy Duty Post Western Red Cedar 5800mm",
    "Alumawood 65 x 65mm heavy duty post, 5800mm long - Western Red Cedar",
    "post",
    "each",
    187.14,
  ),
  component(
    "AW-TP-TR",
    "Alumawood 50mm Post Flat Top Plate Terrain",
    "Alumawood 50mm post flat top plate - Terrain Matt",
    "post_accessory",
    "each",
    1.82,
  ),
  component(
    "AW-BTP-TR",
    "Alumawood Centre Support Rail Top/Base Plate Terrain",
    "Alumawood centre support rail base/top plate - Terrain Matt",
    "accessory",
    "each",
    5.94,
  ),
  component(
    "AW-65TP-TR",
    "Alumawood 65mm Post Flat Top Plate Terrain",
    "Alumawood 65mm post flat top plate - Terrain Matt",
    "post_accessory",
    "each",
    3.52,
  ),
  component(
    "AW-BP-SET-TR",
    "Alumawood 50mm Post Base Plate Set Terrain",
    "Alumawood 50mm post base plate set - Terrain Matt",
    "post_accessory",
    "each",
    12.01,
  ),
  component(
    "AW-65BP-SET-TR",
    "Alumawood 65mm Post Base Plate Set Terrain",
    "Alumawood 65mm post base plate set - Terrain Matt",
    "post_accessory",
    "each",
    10.3,
  ),
  component(
    "AW-DC-2P-TR",
    "Alumawood 50mm Domical Cover Terrain",
    "Alumawood 50mm two-part domical cover - Terrain Matt",
    "post_accessory",
    "each",
    5.25,
  ),
  component(
    "AW-65DC-2P-TR",
    "Alumawood 65mm Domical Cover Terrain",
    "Alumawood 65mm two-part domical cover - Terrain Matt",
    "post_accessory",
    "each",
    5.51,
  ),
  component(
    "AW-DR-TR",
    "Alumawood 50mm Dress Ring Terrain",
    "Alumawood 50mm post dress ring - Terrain Matt",
    "post_accessory",
    "each",
    3.52,
  ),
  component(
    "AW-65DR-TR",
    "Alumawood 65mm Dress Ring Terrain",
    "Alumawood 65mm post dress ring - Terrain Matt",
    "post_accessory",
    "each",
    4.73,
  ),
  component(
    "GROUT-RSC",
    "Rapid set concrete 20kg",
    "Rapid set concrete, 20kg bag, common 30 minute post footing mix",
    "fixing",
    "bag",
    0,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "GROUT-CONCRETE",
    "General concrete mix 20kg",
    "General concrete mix, 20kg bag",
    "fixing",
    "bag",
    0,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "GROUT-POL-10KG",
    "Polaris non-shrink grout 10kg",
    "Polaris high-strength non-shrink expansion grout, 10kg bag",
    "fixing",
    "bag",
    0,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "GROUT-BOS",
    "Bostik HES grout 20kg",
    "Bostik high early strength grout, 20kg bag",
    "fixing",
    "bag",
    0,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "GROUT-SIKA",
    "Sika HES grout 20kg",
    "Sika high early strength water-resistant grout, 20kg bag",
    "fixing",
    "bag",
    0,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "S-110LAG-4PK",
    "Timber fixing kit 4 pack",
    "4x M10 x 110mm SS316 lag screws with nuts and washers for timber substrate",
    "fixing",
    "pack",
    9.76,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "S-120ROD-4PK",
    "Concrete fixing kit 4 pack",
    "4x M10 x 120mm threaded rods with nuts and washers for concrete substrate",
    "fixing",
    "pack",
    6.77,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "SOUD-CA1400",
    "Soudafix CA1400 chemical anchor",
    "280ml chemical anchor for damp or soft concrete and pressure-free anchor fixing",
    "fixing",
    "each",
    19.61,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  component(
    "SOUD-GUN",
    "Soudafix heavy-duty cartridge gun",
    "Heavy-duty 18:1 cartridge gun for SOUD-CA1400",
    "fixing",
    "each",
    31.1,
    ["QSHS", "VS", "XPL", "BAYG"],
  ),
  ...[
    ["DB-PH3", "Phillips #3 driver bit", "Phillips #3 driver bit for QuickScreen gate joiner screws", "fixing", "each", 1.56],
    ["DB-SQ3.4", "Square #3.4 driver bit", "Square #3.4 driver bit for gate rail screws", "fixing", "each", 1.5],
    ["SS-POSTPLUG-4PK", "Black post plug 4 pack", "32mm OD post plugs, black, 4 pack", "post_accessory", "pack", 1.56],
    ["SS-POSTPLUG-4PK-MN", "Monument post plug 4 pack", "32mm OD post plugs, Monument, 4 pack", "post_accessory", "pack", 1.56],
    ["SS-POSTPLUG-4PK-W", "White post plug 4 pack", "32mm OD post plugs, white, 4 pack", "post_accessory", "pack", 1.56],
    ["REV-CD-2S", "Diamond Revolution 1500W 2-speed drill", "Diamond Revolution 1500W 2-speed core drill", "tooling", "each", 239.2],
    ["REV-STAND", "Diamond Revolution drill stand", "Diamond Revolution core drill stand", "tooling", "each", 251.59],
    ["REV-TEMPLATE", "Diamond Revolution drilling template", "Diamond Revolution core-drilling template", "tooling", "each", 36.49],
    ["REV-LEVEL", "Diamond Revolution level", "Diamond Revolution core drill level", "tooling", "each", 11.2],
    ["REV-GUARD", "Diamond Revolution splash guard", "Diamond Revolution core drill splash guard", "tooling", "each", 31.45],
    ["REV-BASE", "Diamond Revolution base", "Diamond Revolution core drill base", "tooling", "each", 80.36],
    ["REV-BIT-08", "Diamond Revolution core bit 8mm", "Diamond Revolution 8mm core drill bit", "tooling", "each", 11.87],
    ["REV-BIT-10", "Diamond Revolution core bit 10mm", "Diamond Revolution 10mm core drill bit", "tooling", "each", 13.86],
    ["REV-BIT-12", "Diamond Revolution core bit 12mm", "Diamond Revolution 12mm core drill bit", "tooling", "each", 16.45],
    ["REV-BIT-14", "Diamond Revolution core bit 14mm", "Diamond Revolution 14mm core drill bit", "tooling", "each", 18.94],
    ["REV-BIT-20", "Diamond Revolution core bit 20mm", "Diamond Revolution 20mm core drill bit", "tooling", "each", 35.38],
    ["REV-BIT-42", "Diamond Revolution core bit 42mm", "Diamond Revolution 42mm core drill bit", "tooling", "each", 40.68],
    ["REV-BIT-53", "Diamond Revolution core bit 53mm", "Diamond Revolution 53mm core drill bit", "tooling", "each", 58.81],
    ["REV-BIT-63", "Diamond Revolution core bit 63mm", "Diamond Revolution 63mm core drill bit", "tooling", "each", 64.69],
    ["REV-BIT-76", "Diamond Revolution core bit 76mm", "Diamond Revolution 76mm core drill bit", "tooling", "each", 73.99],
    ["REV-BIT-83", "Diamond Revolution core bit 83mm", "Diamond Revolution 83mm core drill bit", "tooling", "each", 81.46],
    ["REV-BIT-89", "Diamond Revolution core bit 89mm", "Diamond Revolution 89mm core drill bit", "tooling", "each", 85.3],
    ["ULTRALOC-3242", "Ultraloc 3242 threadlocker", "Ultraloc 3242 threadlocker for base-plate fixings", "fixing", "each", 12.92],
    ["FB-V60", "Bostik V60 glazing silicone", "Bostik V60 glazing silicone", "fixing", "each", 12.24],
    ["SOUD-EPOFIX", "Soudal Epofix epoxy", "Soudal Epofix epoxy for core-drilled post fixing", "fixing", "each", 8.42],
  ].map(([sku, name, description, category, unit, price]) =>
    component(
      String(sku),
      String(name),
      String(description),
      String(category),
      String(unit),
      Number(price),
      ["QSHS", "VS", "XPL", "BAYG", "GATE", "QS_GATE"],
    ),
  ),
];

const syntheticPricingRules: LocalPricingRule[] = [
  ...pricing("QS-SCREWS-50PK", 1.42, 1.42, 1.42),
  ...["B", "BS", "D", "G", "M", "MN", "P", "S", "SM", "W"].flatMap((colour) =>
    pricing(`XP-SCREWS-${colour}`, 6.36, 5.99, 5.16),
  ),
  ...["B", "BS", "D", "G", "MN", "S", "SM"].flatMap((colour) =>
    pricing(`QS-LB-${colour}`, 4.43, 4.11, 3.67),
  ),
  ...pricing("QS-LB-M", 3.4, 3.17, 2.9),
  ...pricing("QS-LB-PB", 4.26, 3.95, 3.53),
  ...pricing("QS-LB-W", 4.26, 3.95, 3.53),
  ...pricing("QS-SPACER-05MM-50PK", 1.42, 1.22, 1.05),
  ...pricing("QS-SPACER-09MM-50PK", 2.63, 2.26, 1.95),
  ...pricing("QS-SPACER-12MM-50PK", 3.47, 2.98, 2.57),
  ...pricing("QS-SPACER-15MM-50PK", 4.1, 3.53, 3.03),
  ...pricing("QS-SPACER-20MM-50PK", 5.2, 4.47, 3.85),
  ...pricing("QS-SPACER-30MM-50PK", 7.3, 6.28, 5.4),
  ...pricing("XP-1800-FP-MN", 26, 26, 26),
  ...pricing("XP-1800-FP-W", 26, 26, 26),
  ...pricing("XP-FOOT-ADJ", 12.24, 11.4, 10.41),
  ...["B", "BS", "D", "G", "M", "MN", "P", "PB", "S", "SM", "W"].flatMap((colour) => {
    const prices = colour === "M" ? [134.78, 128.04, 119.93] : [147.48, 140.1, 131.26];
    return [
      ...pricing(`QSG-S-6100-TR65-${colour}`, prices[0], prices[1], prices[2]),
      ...pricing(`QSG-S-6100-TR90-${colour}`, prices[0], prices[1], prices[2]),
      ...pricing(`QSG-S-6100-BR-${colour}`, prices[0], prices[1], prices[2]),
    ];
  }),
  ...[
    ["KF-AH-AT", 45.45, 45.45, 45.45],
    ["KF-H-FT", 14.5, 14.5, 14.5],
    ["KF-H-NT", 12.5, 12.5, 12.5],
    ["TC-H-AT-B", 25.52, 25.52, 25.52],
    ["TC-H-AT-2L-B", 25.52, 25.52, 25.52],
    ["TC-H-AT-HD-B", 39.75, 39.75, 39.75],
    ["TC-H-AT-HD-2L-B", 40.49, 40.49, 40.49],
    ["TC-CAPS3", 1.39, 1.39, 1.39],
    ["SURECLOSE-HH", 340.64, 327.6, 327.6],
    ["SURECLOSE-NSC", 142.21, 134.16, 134.16],
    ["SS-BH10075-B", 5.1, 4.48, 4.48],
    ["ZF-BBH-L", 18.46, 15.69, 15.69],
    ["ZF-BBH-R", 18.46, 15.69, 15.69],
    ["CB-HINGE-B-2PK", 8.22, 7.56, 7.56],
    ["LL-DL", 65.12, 65.12, 65.12],
    ["LL-DL-KA", 66.07, 66.07, 66.07],
    ["LL-DL-W", 73.89, 73.89, 73.89],
    ["LLAA", 27.79, 27.79, 27.79],
    ["LLAA-W", 33.27, 33.27, 33.27],
    ["LLB", 19.36, 19.36, 19.36],
    ["T-L", 18.69, 18.69, 18.69],
    ["ML-TL-W", 51.87, 51.87, 51.87],
    ["QB124", 45, 45, 45],
    ["LB-PL", 72.42, 72.42, 72.42],
    ["ZF-DB400-B", 9.26, 8.42, 7.8],
    ["SS-0300DB-B", 3.95, 3.95, 3.95],
    ["SS-0300DB-ZP", 5.1, 4.08, 4.08],
    ["SS-DL-B", 8.62, 7.54, 6.45],
    ["MR-FMLSL", 36.4, 33.49, 30.94],
    ["LL-GH", 5.9, 5.9, 5.9],
    ["SS-GS", 7.02, 7.02, 7.02],
    ["SS-GS-SLIMLINE", 3.02, 2.74, 2.74],
    ["KF-AH-AT-W", 49.4, 49.4, 49.4],
    ["TC-H-AT-2L-W", 31.78, 31.78, 31.78],
    ["TC-H-AT-HD-2L-W", 54.05, 54.05, 54.05],
    ["XPSG-3000-TRACK-ST", 26.52, 24.29, 22.53],
    ["XPSG-6000-TRACK-ST", 50.44, 46.46, 44.52],
    ["XPSG-6000-TRACK-AL", 54.08, 51.91, 49.75],
    ["XPSG-ANCHOR", 0.72, 0.64, 0.58],
    ["XPSG-CATCH-F", 27.37, 24.65, 24.65],
    ["XPSG-CATCH-U", 13.88, 12.5, 12.5],
    ["XPSG-FILO-400", 726.55, 661.17, 661.17],
    ["XPSG-FILO-400PRO-SP", 847.85, 771.54, 771.54],
    ["XPSG-FILO-BATTERY", 189.22, 172.19, 172.19],
    ["XPSG-FILO-RACK", 25.48, 21.93, 21.93],
    ["XPSG-FILO-REMOTE", 59.03, 53.73, 53.73],
    ["XPSG-FILO-SOLAR", 758.16, 671.54, 671.54],
    ["XPSG-FILO-WKP", 199.32, 181.38, 181.38],
    ["XPSG-GUIDE", 38.69, 35.06, 35.06],
    ["XPSG-STOP", 18.2, 15.64, 15.64],
    ["XPSG-TOPROLL-2PK", 37.96, 34.15, 34.15],
    ["XPSG-WHEEL", 21.53, 19.38, 19.38],
    ["XPSG-WHEEL-CS", 6, 5.4, 5.4],
    ["QSG-S-WHEEL", 21.53, 19.38, 19.38],
    ["QSG-S-WHEEL-CS-2PK", 6, 5.4, 5.4],
    ["S-110LAG-4PK", 9.76, 8.96, 8.29],
    ["S-120ROD-4PK", 6.77, 6.23, 5.75],
    ["SOUD-CA1400", 19.61, 18.64, 18.64],
    ["SOUD-GUN", 31.1, 29.55, 29.55],
    ["SOUD-EPOFIX", 8.42, 8.01, 8.01],
    ["FB-V60", 12.24, 11.12, 11.12],
    ["ULTRALOC-3242", 12.92, 12.92, 12.92],
    ["DB-PH3", 1.56, 1.56, 1.56],
    ["DB-SQ3.4", 1.5, 1.5, 1.5],
    ["SS-POSTPLUG-4PK", 1.56, 1.34, 1.34],
    ["SS-POSTPLUG-4PK-MN", 1.56, 1.56, 1.56],
    ["SS-POSTPLUG-4PK-W", 1.56, 1.34, 1.34],
    ["REV-CD-2S", 239.2, 239.2, 239.2],
    ["REV-STAND", 251.59, 226.43, 226.43],
    ["REV-TEMPLATE", 36.49, 32.83, 32.83],
    ["REV-LEVEL", 11.2, 10.09, 10.09],
    ["REV-GUARD", 31.45, 28.3, 28.3],
    ["REV-BASE", 80.36, 72.33, 72.33],
    ["REV-BIT-08", 11.87, 10.4, 10.4],
    ["REV-BIT-10", 13.86, 11.44, 11.44],
    ["REV-BIT-12", 16.45, 13.52, 13.52],
    ["REV-BIT-14", 18.94, 15.6, 15.6],
    ["REV-BIT-20", 35.38, 31.2, 31.2],
    ["REV-BIT-42", 40.68, 36.4, 36.4],
    ["REV-BIT-53", 58.81, 50.96, 50.96],
    ["REV-BIT-63", 64.69, 58.24, 58.24],
    ["REV-BIT-76", 73.99, 67.6, 67.6],
    ["REV-BIT-83", 81.46, 71.76, 71.76],
    ["REV-BIT-89", 85.3, 76.96, 76.96],
  ].flatMap(([sku, tier1, tier2, tier3]) =>
    pricing(String(sku), Number(tier1), Number(tier2), Number(tier3)),
  ),
  ...["B", "BS", "D", "G", "MN", "P", "PB", "S", "SM", "W"].flatMap((colour) =>
    pricing(`XP-6000-135-${colour}`, 42.63, 42.63, 42.63),
  ),
  ...pricing("XP-6000-135-M", 34.87, 34.87, 34.87),
  ...pricing("AW-5800-135-KWI", 65.73, 65.73, 65.73),
  ...pricing("AW-5800-135-WRC", 65.73, 65.73, 65.73),
  ...pricing("AW-5800-S65-KWI", 50.49, 47.96, 45.96),
  ...pricing("AW-5800-S65-WRC", 50.49, 47.96, 45.96),
  ...pricing("AWQS-5800-S90-WRC", 64.72, 60.84, 56.95),
  ...pricing("AWQS-5800-SF-KWI", 35.21, 33.11, 30.99),
  ...pricing("AWQS-5800-SF-WRC", 35.21, 33.11, 30.99),
  ...pricing("AWQS-5800-CFC-KWI", 19.82, 18.65, 17.45),
  ...pricing("AWQS-5800-CFC-WRC", 19.82, 18.65, 17.45),
  ...pricing("AWQS-5800-F-KWI", 42.11, 40.02, 37.9),
  ...pricing("AWQS-5800-F-WRC", 42.11, 40.02, 37.9),
  ...pricing("AW-5800-CSR-KWI", 51.59, 48.5, 45.4),
  ...pricing("AW-5800-CSR-WRC", 51.59, 48.5, 45.4),
  ...pricing("AW-2400-FP-KWI", 50.91, 48.61, 45.53),
  ...pricing("AW-2400-FP-WRC", 50.91, 48.61, 45.53),
  ...pricing("AW-2400-65HD-KWI", 84.24, 78.11, 74.02),
  ...pricing("AW-2400-65HD-WRC", 84.24, 78.11, 74.02),
  ...pricing("AW-5800-FP-KWI", 109.67, 102.01, 95.41),
  ...pricing("AW-5800-FP-WRC", 109.67, 102.01, 95.41),
  ...pricing("AW-5800-65HD-KWI", 187.14, 175.37, 166.01),
  ...pricing("AW-5800-65HD-WRC", 187.14, 175.37, 166.01),
  ...pricing("AW-TP-TR", 1.82, 1.71, 1.52),
  ...pricing("AW-BTP-TR", 5.94, 5.53, 4.75),
  ...pricing("AW-65TP-TR", 3.52, 3.28, 2.82),
  ...pricing("AW-BP-SET-TR", 12.01, 11.17, 9.6),
  ...pricing("AW-65BP-SET-TR", 10.3, 9.59, 8.24),
  ...pricing("AW-DC-2P-TR", 5.25, 4.68, 4.2),
  ...pricing("AW-65DC-2P-TR", 5.51, 4.95, 4.41),
  ...pricing("AW-DR-TR", 3.52, 3.28, 2.82),
  ...pricing("AW-65DR-TR", 4.73, 4.41, 3.79),
];

export const localProducts: Product[] = seedFiles
  .flatMap((seed) => seed.products ?? [])
  .filter((product) => product.active !== false)
  .map((product) => ({
    id: product.id ?? product.system_type,
    name: product.name,
    system_type: product.system_type,
    description: product.description ?? null,
    image_url: product.image_url ?? null,
    active: product.active !== false,
    sort_order: product.sort_order ?? 999,
    metadata: product.metadata,
  }))
  .sort((a, b) => a.sort_order - b.sort_order);

export const localFenceProducts = localProducts.filter((product) => {
  const seedProduct = seedFiles
    .flatMap((seed) => seed.products ?? [])
    .find((p) => p.system_type === product.system_type);
  return (
    seedProduct?.product_type !== "gate" &&
    [
      "QSHS",
      "VS",
      "XPL",
      "BAYG",
      "DF_CCA_PAL",
      "AF_TIMBER_PALING",
      "AF_COLORBOND",
      "AF_RETAINING_WALL",
    ].includes(product.system_type)
  );
});

export const localComponents: SeedComponent[] = seedFiles
  .flatMap((seed) => seed.product_components ?? [])
  .concat(syntheticComponents)
  .filter((component) => component.active !== false);

export const localPricingRules: LocalPricingRule[] = seedFiles
  .flatMap((seed) => seed.pricing_rules ?? [])
  .concat(syntheticPricingRules)
  .filter((rule) => rule.active !== false);

export function getLocalVariables(
  systemType: string,
  scope: "job" | "run" | "segment",
): SchemaField[] {
  return seedFiles
    .flatMap((seed) => seed.product_variables ?? [])
    .filter(
      (field) =>
        field.active !== false &&
        field.product_system_type === systemType &&
        field.scope === scope,
    )
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((field) => ({
      id: `${field.product_system_type}-${field.name}-${field.scope}`,
      field_key: field.name,
      label: field.label,
      control_type:
        field.data_type === "enum"
          ? "select"
          : field.data_type === "number" || field.data_type === "integer"
            ? "number"
            : field.data_type === "boolean"
              ? "toggle"
              : "text",
      data_type: field.data_type,
      unit: field.unit ?? undefined,
      required: Boolean(field.required),
      default_value_json: field.default_value_json,
      options_json: Array.isArray(field.options_json) ? field.options_json : [],
      visible_when_json: {},
      sort_order: field.sort_order ?? 0,
      options_group: field.options_group ?? undefined,
    }));
}

export function searchLocalProducts(query: string, limit = 10): ProductSearchItem[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return [];

  return localComponents
    .filter((component) => {
      const haystack = [
        component.sku,
        component.name,
        component.description,
        component.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit)
    .map((component) => ({
      sku: component.sku,
      name: component.name ?? component.sku,
      description: component.description ?? component.name ?? component.sku,
      category: component.category ?? "accessory",
      unit: component.unit ?? "each",
      unitPrice:
        typeof component.default_price === "number"
          ? component.default_price
          : undefined,
    }));
}

export function getComponent(sku: string): SeedComponent | undefined {
  return localComponents.find((component) => component.sku === sku);
}
