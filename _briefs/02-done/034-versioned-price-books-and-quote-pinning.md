# Brief 034 — Versioned Price Books + Quote Pinning (schema + bom-calculator update)

**Status:** Ready for execution
**Repo:** `github.com/skybrookai-atlas/quickscreen-colorbond-generator`
**Default branch:** `main`
**Depends on:** brief 033 merged
**Estimated PR size:** medium (one schema migration + a small bom-calculator helper + types + tests)
**Primary reference:** `docs/multi-supplier-platform-architecture.md` Layer 4 — Pricing & Price Books

---

## Goal

Implement Layer 4 of the architecture: **versioned price books with quote pinning.** Today, `pricing_rules` is flat and there's no version history. After this brief, every supplier can have a series of price books (draft → reviewed → published → archived), and every saved quote remembers which published book it priced against.

**Why this matters:** without this, when a supplier updates their pricing, every old quote silently re-prices. That destroys margin accountability and breaks the "real margin before you send" thesis.

After this lands, **brief 035** adds the admin UI for managing price books, and **brief 036** adds CSV/Cin7 bulk-import staging.

## Hard rules

- **`localBomCalculator.ts` must NOT change.** It's the offline path; it reads from seed JSON and is not pricing-aware in the production sense. The server-side `bom-calculator` edge function gets the pricing-resolution helper.
- **`localBomCalculator.test.ts` passes UNCHANGED.**
- **Existing `pricing_rules` rows continue to work.** This brief introduces price_books / price_book_items in parallel; the resolver prefers the new path but falls back to `pricing_rules` if no published book matches.
- **Do NOT touch the seed JSON files.** Brief 036 evolves seed shape; this brief is schema + resolver only.
- **PR base branch is `main`.**
- **Skip Deno integration job.**
- **Draft PR only.**

## Verified preconditions (audited via GitHub API for this brief)

- **`pricing_rules` shape (after migration 008):** `id, org_id, component_id (FK → product_components.id), tier_code, rule (math.js), price NUMERIC(10,2), priority, active, valid_from, valid_to, updated_at`. **No `sku` column.** SKU is accessed via the `pricing_rules_with_sku` VIEW (defined in migration 008).
- **`product_components.sku`** is the canonical SKU surface — joined to via `component_id`.
- **`pricing_rules.price` is NUMERIC dollars**, not cents. New tables in this brief use `price_cents INTEGER` for the new path; the resolver translates `NUMERIC * 100 → cents` for the legacy fallback.
- **`public.touch_updated_at()`** is the canonical updated_at trigger function (migration 008). Do NOT redefine.

## Files this brief touches

| File | Type of change |
|---|---|
| `supabase/migrations/034_versioned_price_books.sql` | NEW — schema migration |
| `supabase/functions/bom-calculator/lib.ts` | UPDATE — **one-shot migration**: every existing pricing lookup is replaced with a call to `resolvePriceCents()` which wraps `public.resolve_price_cents()` (the SQL function). No parallel pricing paths after this PR. |
| `supabase/functions/bom-calculator/__tests__/pricing.test.ts` | NEW — Deno tests for the resolver (mocked DB rows) |
| `supabase/functions/bom-calculator/__tests__/regression.test.ts` | NEW — diff existing edge function output against the new path on a known Glass Outlet fixture (tier1) to confirm zero behavioural change for the no-price-book case |
| `src/types/pricing.ts` | NEW — TypeScript types for PriceBook + PriceBookItem |
| `src/lib/pricing/schemas.ts` | NEW — Zod validators |
| `src/lib/pricing/queries.ts` | NEW — read-only client queries (list published books for a supplier, get item for SKU+tier+qty) |
| `src/lib/pricing/__tests__/schemas.test.ts` | NEW — smoke tests |
| `docs/multi-supplier-platform-architecture.md` | UPDATE — Decision log row for "Brief 034 ships Layer 4; edge function migrated one-shot" |

**Explicitly NOT touched:** `localBomCalculator.ts`, canonical adapter, canvas engine, calculator UI, seed JSON, quotes table data.

## Trade pricing tier convention (committed in this brief)

Adopted as platform-wide convention (matches the existing Glass Outlet `pricing_rules` data):

- **`tier1`** = list / public retail / RRP (factor 1.0 from sticker)
- **`tier2`** = trade / reseller (Glass Outlet factor 0.86)
- **`tier3`** = volume / bulk (Glass Outlet factor 0.74)

When a supplier's price book is uploaded, `tier1` is the assumed default unless the source file explicitly indicates a discount tier. Discount Fencing's public retail prices (brief 043) seed as `tier1`. Their trade pricing PDF (when supplied) will seed as `tier2`. Verified suppliers can self-publish multiple tiers in one book.

## Migration SQL

```sql
-- ============================================================================
-- 034_versioned_price_books.sql
-- ============================================================================

-- ─── Price books (a versioned snapshot of pricing for a supplier) ──────────
CREATE TABLE price_books (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  source_file     TEXT,
  effective_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','reviewed','published','archived')),
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  authored_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_books_supplier ON price_books(supplier_id);
CREATE INDEX idx_price_books_status   ON price_books(status);
CREATE INDEX idx_price_books_active   ON price_books(supplier_id, status, effective_from)
  WHERE status = 'published';

-- ─── Price book items (per-SKU per-tier per-qty-break) ─────────────────────
CREATE TABLE price_book_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id  UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  tier_code      TEXT NOT NULL DEFAULT 'tier1',
  min_quantity   INTEGER NOT NULL DEFAULT 1,
  price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
  currency       TEXT NOT NULL DEFAULT 'AUD',
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (price_book_id, sku, tier_code, min_quantity)
);

CREATE INDEX idx_price_book_items_book ON price_book_items(price_book_id);
CREATE INDEX idx_price_book_items_lookup
  ON price_book_items(price_book_id, sku, tier_code, min_quantity DESC);

-- ─── Quote pinning ──────────────────────────────────────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS price_book_version_id UUID REFERENCES price_books(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_price_book_version
  ON quotes(price_book_version_id) WHERE price_book_version_id IS NOT NULL;

-- ─── Updated_at trigger ─────────────────────────────────────────────────────
CREATE TRIGGER trigger_price_books_updated_at
  BEFORE UPDATE ON price_books
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE price_books      ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book_items ENABLE ROW LEVEL SECURITY;

-- price_books: read published books for any supplier the user can see; read all books
-- for own org; admin reads everything.
CREATE POLICY "price_books_read_published" ON price_books FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR authored_by = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "price_books_insert" ON price_books FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (authored_by IS NULL OR authored_by = auth.uid())
  );

CREATE POLICY "price_books_update_author" ON price_books FOR UPDATE TO authenticated
  USING (authored_by = auth.uid() AND status IN ('draft','reviewed'))
  WITH CHECK (authored_by = auth.uid());

CREATE POLICY "price_books_update_admin" ON price_books FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "price_books_delete_admin" ON price_books FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON price_books TO authenticated;

-- price_book_items: read follows the parent book; admin writes only.
CREATE POLICY "price_book_items_read" ON price_book_items FOR SELECT TO authenticated
  USING (
    price_book_id IN (
      SELECT id FROM price_books
      WHERE status = 'published'
        OR authored_by = auth.uid()
        OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

CREATE POLICY "price_book_items_write_admin" ON price_book_items FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON price_book_items TO authenticated;

-- ─── Resolver helper (SQL function for the edge function to call) ──────────
-- Returns the effective price_cents for (supplier, sku, tier, quantity, at_time).
-- Prefers the active published price_book; falls back to legacy pricing_rules
-- (which stores price NUMERIC dollars → translated × 100 to cents here).

CREATE OR REPLACE FUNCTION public.resolve_price_cents(
  p_supplier_id UUID,
  p_sku         TEXT,
  p_tier_code   TEXT DEFAULT 'tier1',
  p_quantity    INTEGER DEFAULT 1,
  p_at          TIMESTAMPTZ DEFAULT now()
) RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_price_cents INTEGER;
  v_price_dollars NUMERIC(10,2);
BEGIN
  -- Path 1: active published price book (new, native cents)
  SELECT pbi.price_cents INTO v_price_cents
    FROM price_book_items pbi
    JOIN price_books pb ON pb.id = pbi.price_book_id
   WHERE pb.supplier_id = p_supplier_id
     AND pb.status = 'published'
     AND pb.effective_from <= p_at
     AND (pb.effective_to IS NULL OR pb.effective_to > p_at)
     AND pbi.sku = p_sku
     AND pbi.tier_code = p_tier_code
     AND pbi.min_quantity <= p_quantity
   ORDER BY pbi.min_quantity DESC
   LIMIT 1;
  IF v_price_cents IS NOT NULL THEN RETURN v_price_cents; END IF;

  -- Path 2: legacy pricing_rules fallback. Join via pricing_rules_with_sku VIEW
  -- (created in migration 008) which exposes sku via product_components.
  -- Price is NUMERIC(10,2) dollars → multiply by 100 to return cents.
  SELECT prws.price INTO v_price_dollars
    FROM pricing_rules_with_sku prws
   WHERE prws.sku = p_sku
     AND prws.tier_code = p_tier_code
     AND prws.active = TRUE
     AND (prws.valid_from IS NULL OR prws.valid_from <= p_at)
     AND (prws.valid_to   IS NULL OR prws.valid_to   >  p_at)
   ORDER BY prws.priority DESC
   LIMIT 1;
  IF v_price_dollars IS NOT NULL THEN
    RETURN ROUND(v_price_dollars * 100)::INTEGER;
  END IF;

  RETURN NULL;
END $$;

-- Service-role-only access to match the existing pricing_rules / pricing_rules_with_sku grants.
REVOKE ALL ON FUNCTION public.resolve_price_cents(UUID, TEXT, TEXT, INTEGER, TIMESTAMPTZ) FROM anon, authenticated;
```

> **Schema notes (audited):** `pricing_rules` has NO `sku` column after migration 008 — SKU joins via `pricing_rules.component_id → product_components.id → product_components.sku`. The `pricing_rules_with_sku` VIEW (created in migration 008) exposes this join. `pricing_rules.price` is `NUMERIC(10,2)` dollars; this brief multiplies by 100 to translate to cents at the fallback path. New `price_book_items.price_cents` stays as INTEGER cents (cleaner for new code).
>
> **Supplier scope on the fallback path:** pricing_rules doesn't carry `supplier_id` until brief 032 adds it as nullable. Until brief 033 backfills (after 032 lands), the fallback path returns the first matching SKU regardless of supplier — fine for the single-supplier Glass Outlet era, problematic once Discount Fencing's SKUs are in the same table. Brief 033 backfills `supplier_id` on pricing_rules, after which the fallback can be tightened by adding `AND prws.supplier_id = p_supplier_id` to the legacy path (TODO comment in the SQL — done in a follow-on brief once pricing_rules_with_sku is rebuilt to expose supplier_id).

## Edge function update

In `supabase/functions/bom-calculator/lib.ts`, expose a `resolvePriceCents(supabase, ctx)` helper that wraps the SQL function and is used at every spot the calculator currently reads `pricing_rules` directly. Add Deno tests with mocked supabase response.

## TypeScript types

```typescript
// src/types/pricing.ts
export type PriceBookStatus = 'draft' | 'reviewed' | 'published' | 'archived';

export interface PriceBook {
  id: string;
  supplierId: string;
  name: string;
  sourceFile?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: PriceBookStatus;
  publishedAt?: string;
  publishedBy?: string;
  authoredBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PriceBookItem {
  id: string;
  priceBookId: string;
  sku: string;
  tierCode: string;
  minQuantity: number;
  priceCents: number;
  currency: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

(Zod schemas and query helpers follow the same pattern as `multiSupplier/` — `priceBookSchema`, `priceBookItemSchema`, `listPublishedBooks(supplierId)`, `getPriceForSku(supplierId, sku, tier, qty)`.)

## Tests

- Resolver test: insert a published book + items, assert the SQL function returns the correct quantity-break price.
- Quantity break test: with min_quantity rows of (1, 10, 100), assert qty=1 returns the 1-row price, qty=15 returns the 10-row price, qty=200 returns the 100-row price.
- Fallback test: with NO published book but a legacy pricing_rules row, assert the SQL function returns the legacy price.
- Pin test: insert a published book, save a quote, archive the book and publish a new one with different prices, assert the quote re-reads the OLD price via its pinned `price_book_version_id`. (This proves quote pinning works.)

## PR description template

```markdown
## Brief 034 — Versioned Price Books + Quote Pinning

Implements Layer 4 of the architecture: versioned price books with status lifecycle (draft → reviewed → published → archived) and quote-level pinning. Old quotes never silently re-price.

### What's in this PR

- Migration 034: tables `price_books`, `price_book_items`; column `quotes.price_book_version_id`; SQL function `public.resolve_price_cents()`
- Edge function helper `resolvePriceCents()` (price-book-aware, with legacy `pricing_rules` fallback)
- TypeScript types, Zod schemas, query helpers, tests
- Doc update

### Verification

- [ ] typecheck / test / build passes; `localBomCalculator.test.ts` UNCHANGED
- [ ] Deno tests for `resolvePriceCents()` pass
- [ ] Migration applies cleanly
- [ ] Existing quotes still load (no schema break)
- [ ] PR base branch is `main`
```

## Stop points

- If `pricing_rules_with_sku` view doesn't include `tier_code`, `priority`, `active`, `valid_from`, `valid_to`, **STOP** and rebuild the view to expose them. The legacy fallback path needs them.
- If the existing `bom-calculator` edge function imports `pricing_rules_with_sku` via a different name or shape, surface and align.
- If `quotes.price_book_version_id` already exists (unlikely), confirm with Liam before reusing.

## After this PR merges

Brief 035 (Admin CRUD UI for suppliers + instances) can ship in parallel with brief 036 (Admin Products + bulk import, which will start using `price_books` for new imports). Until 035/036 land, price books are managed via direct SQL only.