import { describe, it, expect } from 'vitest';
import { priceBookSchema, priceBookItemSchema, priceBookStatusSchema } from '../schemas';

describe('pricing schemas', () => {
  const now = new Date().toISOString();
  const u = '11111111-1111-4111-8111-111111111111'; // RFC-compliant UUID

  it('parses a valid price book row', () => {
    const ok = priceBookSchema.safeParse({
      id: u,
      supplierId: u,
      name: 'Glass Outlet 2026 Q2 Trade Pricing',
      effectiveFrom: now,
      status: 'published',
      createdAt: now,
      updatedAt: now,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an invalid price book status', () => {
    expect(priceBookStatusSchema.safeParse('pending').success).toBe(false);
  });

  it('parses a valid price book item row', () => {
    const ok = priceBookItemSchema.safeParse({
      id: u,
      priceBookId: u,
      sku: 'QSHS-SLAT-65',
      tierCode: 'tier1',
      minQuantity: 1,
      priceCents: 1000,
      currency: 'AUD',
      createdAt: now,
    });
    expect(ok.success).toBe(true);
  });
});
