import Papa from 'papaparse';
import type { ParsedRow, ParsedProduct, ParsedPrice } from '../types';

export async function parseGenericCsv(fileBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const decoder = new TextDecoder('utf-8');
  const csvText = decoder.decode(fileBuffer);

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        try {
          const parsedRows: ParsedRow[] = [];
          
          for (const row of results.data) {
            // Find key values by checking common aliases
            const skuVal = row.sku || row.SKU || row.Sku || row.ManufacturerSKU || row.SupplierSKU || row.code || row.Code;
            const nameVal = row.name || row.Name || row.description || row.Description || row.ShortDescription || row.title || row.Title;
            
            if (!skuVal || !nameVal) {
              continue;
            }

            const sku = String(skuVal).trim();
            const name = String(nameVal).trim();
            
            const categoryVal = row.category || row.Category || row.type || row.Type || 'accessory';
            const category = String(categoryVal).trim().toLowerCase();

            // Extract system types (can be comma-separated)
            const systemsVal = row.system_types || row.system_type || row.SystemTypes || row.SystemType;
            let system_types = ['QSHS'];
            if (systemsVal) {
              system_types = String(systemsVal)
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter((s) => ['QSHS', 'VS', 'XPL', 'BAYG', 'GATE'].includes(s));
            }

            const coloursVal = row.colours || row.colour || row.Colour || row.Color || row.color;
            const colours = coloursVal ? [String(coloursVal).trim().toLowerCase()] : null;

            const sizeVal = row.size || row.Size || row.dimensions || row.Dimensions;
            const sizes = sizeVal ? { raw: String(sizeVal).trim() } : null;

            const product: ParsedProduct = {
              sku,
              name,
              category,
              system_types,
              colours,
              sizes,
              metadata: { ...row },
            };

            // Parse price
            const priceVal = row.price || row.Price || row.price_cents || row.priceCents || row.priceExGst || row.BuyPriceEx || row.BuyPrice || 0;
            let buyPrice = 0;
            if (typeof priceVal === 'number') {
              buyPrice = priceVal;
            } else {
              buyPrice = parseFloat(String(priceVal).replace(/[^\d.]/g, '')) || 0;
            }

            // If the CSV specifically has price_cents or priceCents, it might be in cents already. Otherwise, assume dollars.
            const isPriceInCents = ('price_cents' in row) || ('priceCents' in row);
            const basePriceCents = isPriceInCents ? Math.round(buyPrice) : Math.round(buyPrice * 100);

            // Replicate pricing rules across tiers
            const prices: ParsedPrice[] = [
              { sku, tier_code: 'tier1', min_quantity: 1, price_cents: basePriceCents },
              { sku, tier_code: 'tier2', min_quantity: 1, price_cents: Math.round(basePriceCents * 0.85) },
              { sku, tier_code: 'tier3', min_quantity: 1, price_cents: Math.round(basePriceCents * 0.72) },
            ];

            parsedRows.push({ product, prices });
          }

          resolve(parsedRows);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
}
