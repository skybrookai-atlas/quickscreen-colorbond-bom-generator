export type BOMCategory =
  | 'screening'
  | 'frames_and_covers'
  | 'posts_and_mounting'
  | 'gate_components'
  | 'gate_hardware'
  | 'sliding_gate_running_gear'
  | 'caps_and_plugs'
  | 'fasteners_and_screws'
  | 'spacers'
  | 'fixings'
  | 'tools_and_consumables'
  | 'post'
  | 'post_accessory'
  | 'rail'
  | 'rail_insert'
  | 'slat'
  | 'side_frame'
  | 'cfc_cover'
  | 'centre_support_rail'
  | 'f_section'
  | 'bracket'
  | 'screw'
  | 'gate'
  | 'hardware'
  | 'automation'
  | 'accessory';
export type BOMUnit = 'each' | 'length' | 'pack' | 'box' | 'bag';

export interface BOMSource {
  scopeKind: 'fence_run' | 'gate' | 'enclosure' | 'global';
  scopeId: string;
  scopeLabel: string;
  qty: number;
}

export interface BOMLineItem {
  category: BOMCategory;
  subCategory?: string;
  companionOf?: string;
  optionalChildOf?: string[];
  isOptionalAccessory?: boolean;
  sortPriority?: number;
  sku: string;
  /** Short component name from product_components.name */
  name?: string;
  /** Longer description from product_components.description */
  description: string;
  quantity: number;
  totalQty?: number;
  sources?: BOMSource[];
  unit: BOMUnit;
  unitPrice: number | null;    // ex-GST
  lineTotal: number | null;    // quantity × unitPrice
  notes?: string;
  runId?: string;
  segmentId?: string;
  productCode?: string;
}

export interface PostPosition {
  x: number;
  y: number;
  label?: string;
}

export interface BOMResult {
  fenceItems: BOMLineItem[];
  gateItems: BOMLineItem[];
  total: number;
  gst: number;
  grandTotal: number;
  pricingTier: 'tier1' | 'tier2' | 'tier3';
  generatedAt: string;
  /** Optional post positions in canvas world coordinates (same space as drawn nodes).
   *  Populated by the edge function once post-position calculation is implemented. */
  postPositions?: PostPosition[];
}

export type PricingTier = 'tier1' | 'tier2' | 'tier3';

export interface SegmentDiagnostic {
  segmentId: string;
  runId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface CalculatorBOMResult {
  runResults: Array<{ runId: string; items: BOMLineItem[] }>;
  gateResults?: Array<{ id: string; label: string; items: BOMLineItem[] }>;
  gateItems: BOMLineItem[];
  allItems: BOMLineItem[];
  total: number;
  gst: number;
  grandTotal: number;
  pricingTier: PricingTier;
  generatedAt: string;
  segmentDiagnostics?: SegmentDiagnostic[];
}

/** Ad-hoc line item added manually by staff — not from the BOM calculation */
export interface ExtraItem {
  id: string;           // generated UUID / nanoid
  description: string;
  quantity: number;
  unitPrice: number;    // ex-GST
  sku?: string;         // set when selected from autocomplete; undefined for free-text entries
}
