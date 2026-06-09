export interface ParsedProduct {
  sku: string;
  name: string;
  category: string;
  system_types: string[];
  colours?: string[] | null;
  sizes?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface ParsedPrice {
  sku: string;
  tier_code: string;
  min_quantity: number;
  price_cents: number;
}

export interface ParsedRow {
  product: ParsedProduct;
  prices: ParsedPrice[];
}

export interface ImportRun {
  id: string;
  supplierId: string;
  sourceFormat: string;
  sourceFilename: string | null;
  status: 'parsing' | 'ready_for_review' | 'approved' | 'rejected' | 'imported';
  rowCount: number | null;
  authoredBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface StagingProduct {
  id: string;
  importRunId: string;
  supplierId: string;
  sku: string | null;
  name: string | null;
  rawPayload: Record<string, any>;
  mappedPayload: ParsedProduct | null;
  decision: 'pending' | 'approve' | 'reject' | 'needs_review';
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface StagingPriceBookItem {
  id: string;
  importRunId: string;
  sku: string;
  tierCode: string;
  minQuantity: number;
  priceCents: number | null;
  rawPayload: Record<string, any> | null;
}

export interface DiffItem {
  sku: string;
  status: 'new' | 'changed' | 'unchanged' | 'unmapped';
  currentProduct?: {
    id: string;
    sku: string;
    name: string;
    category: string;
    system_types: string[];
    colours?: string[] | null;
    sizes?: any | null;
    metadata?: any | null;
  } | null;
  stagedProduct: ParsedProduct;
  currentPrices?: Array<{
    tier_code: string;
    min_quantity: number;
    price_cents: number;
  }>;
  stagedPrices: ParsedPrice[];
  diffs: Record<string, { current: any; staged: any }>;
}
