import { read, utils, type WorkSheet } from 'xlsx';
import { z } from 'zod';
import type { ParsedRow, ParsedProduct, ParsedPrice } from '../types';

const Cin7RowSchema = z.object({
  ProductId: z.union([z.number(), z.string()]),
  ManufacturerSKU: z.string().nullable().optional(),
  SupplierSKU: z.string().nullable().optional(),
  ShortDescription: z.string(),
  Size: z.string().nullable().optional(),
  Colour: z.string().nullable().optional(),
  Custom1: z.string().nullable().optional(),
  Custom2: z.string().nullable().optional(),
  Custom3: z.string().nullable().optional(),
  BuyPriceEx: z.union([z.number(), z.string()]).nullable().optional(),
  RRP: z.union([z.number(), z.string()]).nullable().optional(),
});

type Cin7Row = z.infer<typeof Cin7RowSchema>;

function findHeaderRow(ws: WorkSheet, searchKey: string): number {
  const range = utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (cell && cell.v && String(cell.v).trim() === searchKey) {
        return R;
      }
    }
  }
  return 0;
}

function parseNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function inferCategory(desc: string, c1?: string | null, c2?: string | null, c3?: string | null): string {
  const tokens = (desc + ' ' + (c1 || '') + ' ' + (c2 || '') + ' ' + (c3 || '')).toLowerCase();
  
  if (tokens.includes('slat')) return 'slat';
  if (tokens.includes('post')) return 'post';
  if (tokens.includes('rail')) return 'rail';
  if (tokens.includes('bracket')) return 'bracket';
  if (tokens.includes('screw') || tokens.includes('fastener') || tokens.includes('fixings')) return 'screw';
  if (tokens.includes('hinge') || tokens.includes('latch') || tokens.includes('lock') || tokens.includes('dropbolt') || tokens.includes('gate stop') || tokens.includes('drop bolt')) return 'hardware';
  if (tokens.includes('gate') || tokens.includes('leaf') || tokens.includes('frame')) return 'gate';
  if (tokens.includes('cap') || tokens.includes('spacer') || tokens.includes('plugs') || tokens.includes('cover')) return 'accessory';
  
  return 'accessory';
}

function inferSystemTypes(desc: string, c1?: string | null, c2?: string | null, c3?: string | null): string[] {
  const tokens = (desc + ' ' + (c1 || '') + ' ' + (c2 || '') + ' ' + (c3 || '')).toUpperCase();
  const systems: string[] = [];
  
  if (tokens.includes('QSHS') || tokens.includes('HORIZONTAL')) systems.push('QSHS');
  if (tokens.includes('VS') || tokens.includes('VERTICAL')) systems.push('VS');
  if (tokens.includes('XPL') || tokens.includes('XPRESS')) systems.push('XPL');
  if (tokens.includes('BAYG') || tokens.includes('BAY-G') || tokens.includes('BAY G')) systems.push('BAYG');
  
  if (tokens.includes('GATE')) systems.push('GATE');
  
  if (systems.length === 0) {
    // If it's a general component, it might be compatible with all system types.
    return ['QSHS'];
  }
  
  return systems;
}

function normaliseCin7Row(row: Cin7Row): ParsedRow {
  const sku = (row.ManufacturerSKU || row.SupplierSKU || `cin7-${row.ProductId}`).trim();
  const name = row.ShortDescription.trim();
  
  const category = inferCategory(name, row.Custom1, row.Custom2, row.Custom3);
  const system_types = inferSystemTypes(name, row.Custom1, row.Custom2, row.Custom3);
  
  // Parse sizes (width/height/depth) from Size string if available, e.g. "50x50", "1800mm"
  const sizes: Record<string, any> = {};
  if (row.Size) {
    sizes.raw = row.Size;
    const matchMatch = row.Size.match(/(\d+)\s*[xX]\s*(\d+)/);
    if (matchMatch) {
      sizes.width = parseInt(matchMatch[1], 10);
      sizes.height = parseInt(matchMatch[2], 10);
    } else {
      const singleNum = row.Size.match(/(\d+)/);
      if (singleNum) {
        sizes.length = parseInt(singleNum[1], 10);
      }
    }
  }

  const colours = row.Colour ? [row.Colour.trim().toLowerCase()] : [];

  const product: ParsedProduct = {
    sku,
    name,
    category,
    system_types,
    colours: colours.length > 0 ? colours : null,
    sizes: Object.keys(sizes).length > 0 ? sizes : null,
    metadata: {
      productId: row.ProductId,
      manufacturerSku: row.ManufacturerSKU || null,
      supplierSku: row.SupplierSKU || null,
      custom1: row.Custom1 || null,
      custom2: row.Custom2 || null,
      custom3: row.Custom3 || null,
    },
  };

  const buyPrice = parseNumber(row.BuyPriceEx) || 0;
  const rrp = parseNumber(row.RRP) || 0;

  const t1Price = rrp > 0 ? Math.round(rrp * 100) : Math.round(buyPrice * 1.5 * 100);
  const t2Price = Math.round(buyPrice * 1.3 * 100);
  const t3Price = Math.round(buyPrice * 1.15 * 100);

  const prices: ParsedPrice[] = [
    { sku, tier_code: 'tier1', min_quantity: 1, price_cents: t1Price },
    { sku, tier_code: 'tier2', min_quantity: 1, price_cents: t2Price },
    { sku, tier_code: 'tier3', min_quantity: 1, price_cents: t3Price },
  ];

  return { product, prices };
}

export async function parseCin7MassDownload(fileBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const wb = read(fileBuffer, { type: 'array' });
  const sheetName = wb.SheetNames.includes('Product Master') ? 'Product Master' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }

  const headerRow = findHeaderRow(ws, 'ProductId');
  const rows = utils.sheet_to_json<any>(ws, { range: headerRow, defval: null });
  
  const results: ParsedRow[] = [];
  for (const r of rows) {
    // Basic filter: must have a ProductId and ShortDescription to be valid
    if (r.ProductId === null || r.ProductId === undefined || !r.ShortDescription) {
      continue;
    }
    
    const parsed = Cin7RowSchema.safeParse(r);
    if (parsed.success) {
      results.push(normaliseCin7Row(parsed.data));
    }
  }

  return results;
}
