import { z } from 'zod';

export const priceBookStatusSchema = z.enum(['draft', 'reviewed', 'published', 'archived']);

export const priceBookSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid(),
  name: z.string().min(1),
  sourceFile: z.string().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  status: priceBookStatusSchema,
  publishedAt: z.string().optional(),
  publishedBy: z.string().uuid().optional(),
  authoredBy: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const priceBookItemSchema = z.object({
  id: z.string().uuid(),
  priceBookId: z.string().uuid(),
  sku: z.string().min(1),
  tierCode: z.string().min(1),
  minQuantity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
});
