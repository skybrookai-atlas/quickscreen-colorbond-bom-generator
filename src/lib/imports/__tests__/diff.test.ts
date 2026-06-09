import { describe, it, expect } from 'vitest';
import { diffCatalog } from '../diff';
import type { ParsedRow } from '../types';

describe('Catalog Diff Utility', () => {
  it('correctly classifies new, changed, and unchanged catalog items', () => {
    const stagedRows: ParsedRow[] = [
      {
        product: {
          sku: 'NEW-SKU',
          name: 'Brand New Accessory',
          category: 'accessory',
          system_types: ['QSHS'],
        },
        prices: [
          { sku: 'NEW-SKU', tier_code: 'tier1', min_quantity: 1, price_cents: 1000 },
        ],
      },
      {
        product: {
          sku: 'CHANGED-NAME-SKU',
          name: 'Updated Name',
          category: 'post',
          system_types: ['QSHS'],
        },
        prices: [
          { sku: 'CHANGED-NAME-SKU', tier_code: 'tier1', min_quantity: 1, price_cents: 2000 },
        ],
      },
      {
        product: {
          sku: 'CHANGED-PRICE-SKU',
          name: 'Same Name Post',
          category: 'post',
          system_types: ['QSHS'],
        },
        prices: [
          { sku: 'CHANGED-PRICE-SKU', tier_code: 'tier1', min_quantity: 1, price_cents: 2500 },
        ],
      },
      {
        product: {
          sku: 'UNCHANGED-SKU',
          name: 'Identical Slat',
          category: 'slat',
          system_types: ['QSHS', 'VS'],
        },
        prices: [
          { sku: 'UNCHANGED-SKU', tier_code: 'tier1', min_quantity: 1, price_cents: 5000 },
        ],
      },
    ];

    const currentComponents = [
      {
        sku: 'CHANGED-NAME-SKU',
        name: 'Old Name',
        category: 'post',
        system_types: ['QSHS'],
      },
      {
        sku: 'CHANGED-PRICE-SKU',
        name: 'Same Name Post',
        category: 'post',
        system_types: ['QSHS'],
      },
      {
        sku: 'UNCHANGED-SKU',
        name: 'Identical Slat',
        category: 'slat',
        system_types: ['QSHS', 'VS'],
      },
    ];

    const currentPrices = [
      { sku: 'CHANGED-NAME-SKU', tier_code: 'tier1', min_quantity: 1, price_cents: 2000 },
      { sku: 'CHANGED-PRICE-SKU', tier_code: 'tier1', min_quantity: 1, price_cents: 1800 }, // price was 1800, now 2500
      { sku: 'UNCHANGED-SKU', tier_code: 'tier1', min_quantity: 1, price_cents: 5000 },
    ];

    const results = diffCatalog(stagedRows, currentComponents, currentPrices);

    expect(results).toHaveLength(4);

    // 1. New item
    const newItem = results.find(r => r.sku === 'NEW-SKU');
    expect(newItem?.status).toBe('new');
    expect(newItem?.currentProduct).toBeNull();

    // 2. Changed name
    const changedName = results.find(r => r.sku === 'CHANGED-NAME-SKU');
    expect(changedName?.status).toBe('changed');
    expect(changedName?.diffs.name).toEqual({ current: 'Old Name', staged: 'Updated Name' });
    expect(changedName?.diffs.category).toBeUndefined();

    // 3. Changed price
    const changedPrice = results.find(r => r.sku === 'CHANGED-PRICE-SKU');
    expect(changedPrice?.status).toBe('changed');
    expect(changedPrice?.diffs.price_tier1_qty1).toEqual({ current: 1800, staged: 2500 });

    // 4. Unchanged item
    const unchangedItem = results.find(r => r.sku === 'UNCHANGED-SKU');
    expect(unchangedItem?.status).toBe('unchanged');
    expect(Object.keys(unchangedItem?.diffs || {})).toHaveLength(0);
  });
});
