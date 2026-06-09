import type { ParsedRow, DiffItem } from './types';

export function diffCatalog(
  stagedRows: ParsedRow[],
  currentComponents: any[],
  currentPrices: any[]
): DiffItem[] {
  const componentsMap = new Map<string, any>();
  for (const c of currentComponents) {
    componentsMap.set(c.sku, c);
  }

  const pricesMap = new Map<string, Array<{ tier_code: string; min_quantity: number; price_cents: number }>>();
  for (const p of currentPrices) {
    const list = pricesMap.get(p.sku) || [];
    list.push({
      tier_code: p.tier_code || p.tierCode,
      min_quantity: p.min_quantity || p.minQuantity,
      price_cents: p.price_cents || p.priceCents
    });
    pricesMap.set(p.sku, list);
  }

  const diffItems: DiffItem[] = [];

  for (const row of stagedRows) {
    const stagedProduct = row.product;
    const stagedPrices = row.prices;
    const sku = stagedProduct.sku;

    const currentProduct = componentsMap.get(sku);
    const currPrices = pricesMap.get(sku) || [];

    const diffs: Record<string, { current: any; staged: any }> = {};

    if (!currentProduct) {
      diffItems.push({
        sku,
        status: 'new',
        currentProduct: null,
        stagedProduct,
        currentPrices: [],
        stagedPrices,
        diffs,
      });
      continue;
    }

    if (currentProduct.name !== stagedProduct.name) {
      diffs.name = { current: currentProduct.name, staged: stagedProduct.name };
    }
    if (currentProduct.category !== stagedProduct.category) {
      diffs.category = { current: currentProduct.category, staged: stagedProduct.category };
    }
    
    const currSystems = [...(currentProduct.system_types || [])].sort().join(',');
    const stagedSystems = [...(stagedProduct.system_types || [])].sort().join(',');
    if (currSystems !== stagedSystems) {
      diffs.system_types = { current: currentProduct.system_types, staged: stagedProduct.system_types };
    }
    
    for (const sp of stagedPrices) {
      const cp = currPrices.find(
        (p) => p.tier_code === sp.tier_code && p.min_quantity === sp.min_quantity
      );
      if (!cp) {
        diffs[`price_${sp.tier_code}_qty${sp.min_quantity}`] = {
          current: null,
          staged: sp.price_cents,
        };
      } else if (cp.price_cents !== sp.price_cents) {
        diffs[`price_${sp.tier_code}_qty${sp.min_quantity}`] = {
          current: cp.price_cents,
          staged: sp.price_cents,
        };
      }
    }

    const hasDiffs = Object.keys(diffs).length > 0;

    diffItems.push({
      sku,
      status: hasDiffs ? 'changed' : 'unchanged',
      currentProduct,
      stagedProduct,
      currentPrices: currPrices,
      stagedPrices,
      diffs,
    });
  }

  return diffItems;
}
export * from './types';
