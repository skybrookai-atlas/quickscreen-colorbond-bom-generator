import { supabase } from '../supabase';
import type { PriceBook, PriceBookItem } from '../../types/pricing';

// All queries below are read-only.
export async function listPublishedBooks(supplierId: string): Promise<PriceBook[]> {
  const { data, error } = await supabase
    .from('price_books')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('status', 'published')
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPriceBook);
}

export async function getPriceBookItem(
  priceBookId: string,
  sku: string,
  tierCode: string,
  quantity: number
): Promise<PriceBookItem | null> {
  const { data, error } = await supabase
    .from('price_book_items')
    .select('*')
    .eq('price_book_id', priceBookId)
    .eq('sku', sku)
    .eq('tier_code', tierCode)
    .lte('min_quantity', quantity)
    .order('min_quantity', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToPriceBookItem(data) : null;
}

function rowToPriceBook(row: any): PriceBook {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    name: row.name,
    sourceFile: row.source_file ?? undefined,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to ?? undefined,
    status: row.status,
    publishedAt: row.published_at ?? undefined,
    publishedBy: row.published_by ?? undefined,
    authoredBy: row.authored_by ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPriceBookItem(row: any): PriceBookItem {
  return {
    id: row.id,
    priceBookId: row.price_book_id,
    sku: row.sku,
    tierCode: row.tier_code,
    minQuantity: row.min_quantity,
    priceCents: row.price_cents,
    currency: row.currency,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}
