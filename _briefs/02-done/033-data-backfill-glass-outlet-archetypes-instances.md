# Brief 033 — Data backfill: Glass Outlet supplier + archetypes + system instances + provenance

**Status:** Ready for execution
**Repo:** `github.com/skybrookai-atlas/quickscreen-colorbond-generator`
**Default branch:** `main` (NOT `master`)
**Depends on:** brief 032 merged (the new tables exist; provenance columns are nullable but present)
**Estimated PR size:** medium (one data migration, no code changes other than seed script touch-up if needed)
**Primary reference:** `docs/system-authoring-process.md` (Appendix A "Initial Archetype Seed") + `docs/multi-supplier-platform-architecture.md`

---

## Goal

Populate the new identity tables and backfill provenance on existing rows so the platform's current Glass Outlet data has supplier + archetype + system_instance tagging. After this lands:

- Every existing product / component / variable / rule / selector / companion_rule / pricing_rule is tagged with `supplier_id = glass-outlet` and the appropriate `system_instance_id`.
- The 12 canonical archetypes (per `system-authoring-process.md` Appendix A) exist as rows.
- 8 system_instance rows exist representing the Glass Outlet seed files (QSHS, VS, XPL, BAYG, ColorBond, QS_GATE swing, QSG sliding, XPSG_GATE).
- Liam's existing calculator continues to work unchanged — no behaviour change, no UI change.

After this lands, **brief 034** adds the versioned-price-books layer and **brief 035** adds the admin CRUD UI.

## Hard rules

- **`src/lib/localBomCalculator.ts` must NOT be modified.** Test suite passes UNCHANGED.
- **Do NOT change existing data values.** Only ADD `supplier_id` / `system_instance_id` references via UPDATE.
- **Do NOT change the seed JSON files in this brief.** They keep their current shape. Mapping to system_instances happens at DB-update time, not at JSON-edit time. (Brief 034+ may evolve the seed shape; not here.)
- **Treat the data migration as idempotent.** Use `ON CONFLICT DO NOTHING` on inserts; use guarded UPDATEs (`WHERE supplier_id IS NULL`).
- **PR base branch is `main`** (NOT `master`).
- **Skip the Deno integration job** — known red on XP-BTP-B fixture, pre-existing.
- **Draft PR only.** Human review gate.
- **After merge:** run `npm run seed:products` to confirm the seed script still works against the augmented schema. Brief 036 will eventually update the seed script to carry supplier_id / system_instance_id on every row it upserts; for now, the seed JSON has no provenance fields and `seed:products` should be unaffected.

## Files this brief touches

| File | Type of change |
|---|---|
| `supabase/migrations/033_backfill_glass_outlet_supplier_and_instances.sql` | NEW — data migration |
| `docs/system-authoring-process.md` | UPDATE — append a row to the "Decision log" noting backfill date and admin choice (Glass Outlet trust_tier remains `platform` for now; Liam can demote to `verified` later via the admin UI in brief 035) |

**Explicitly NOT touched:**

- `src/lib/localBomCalculator.ts`
- `localBomCalculator.test.ts`
- `canonicalAdapter.ts`, `canvasEngine.ts`
- Any UI file
- Existing migration files
- Existing seed JSON
- `supabase/functions/bom-calculator/`

## Mapping table (seed file → system_instance)

Used in the migration SQL below.

| Seed file | system_type | supplier slug | archetype slug | system_instance slug | system_instance name | trust_tier | readiness_status |
|---|---|---|---|---|---|---|---|
| `qshs.json` | `QSHS` | glass-outlet | slat-fence | qshs | QuickScreen Horizontal Slat | platform | approved |
| `vs.json` | `VS` | glass-outlet | slat-fence | vs | QuickScreen Vertical Slat | platform | approved |
| `xpl.json` | `XPL` | glass-outlet | slat-fence | xpl | XPress Plus | platform | approved |
| `bayg.json` | `BAYG` | glass-outlet | slat-fence | bayg | Buy As You Go | platform | approved |
| `colorbond.json` | `ColorBond` | glass-outlet | panel-fence | go-colorbond | Glass Outlet ColorBond | platform | calculator_ready |
| `qs_gate.json` | `QS_GATE` | glass-outlet | swing-gate | qs-gate | QS Gate (swing + sliding variants) | platform | calculator_ready |
| `xpsg_gate.json` | `XPSG_GATE` | glass-outlet | sliding-gate | xpsg-gate | XP Sliding Gate component catalogue | platform | approved |

ColorBond and QS Gate are at `calculator_ready` (not `approved`) until workbook regression passes (the QSG sliding work from 2026-05-27 is still pending workbook regression).

**Important architectural note (corrected after schema audit):** The existing schema enforces `UNIQUE (org_id, system_type)` on `products` (migration 022). The `qs_gate.json` seed file produces a SINGLE row in `products` with `system_type='QS_GATE'` that internally covers BOTH swing AND sliding gate variants via product_variables + rules (the prior `codex/qsg-sliding-gates-calculator` branch extends `qs_gate.json` for the sliding variant within the same product). We therefore tag it with ONE `system_instance_id = qs-gate` against archetype `swing-gate` (the original). The sliding variant lives WITHIN that instance via existing rule machinery. If we ever want to split into two product rows, that requires schema change to relax the uniqueness — out of scope for this brief.

**Column references (canonical from schema audit):**
- `products.system_type` — TEXT
- `pricing_rules` has NO `sku` column; it joins via `pricing_rules.component_id → product_components.id → product_components.product_id → products.id`
- `product_variables` columns are `name`, `default_value_json`, `options_json` (NOT `variable_key`, `variable_value`)
- All existing rows have `org_id = (the glass-outlet org)`; new `supplier_id` is conceptually different from `org_id` (org = the tenant on the platform; supplier = who makes the product)

## Migration SQL

Create `supabase/migrations/033_backfill_glass_outlet_supplier_and_instances.sql`:

```sql
-- ============================================================================
-- 033_backfill_glass_outlet_supplier_and_instances.sql
--
-- Populates the new identity tables (suppliers, system_archetypes, system_instances)
-- and backfills supplier_id + system_instance_id on existing v3 catalogue rows.
--
-- Idempotent: re-running is a no-op.
-- ============================================================================

-- ─── 1. Suppliers ───────────────────────────────────────────────────────────
INSERT INTO suppliers (slug, name, trust_tier, status, metadata)
VALUES (
  'glass-outlet',
  'Glass Outlet',
  'platform',
  'active',
  '{"description":"The Glass Outlet - aluminium slat fencing, gates, and ColorBond. The original supplier on the platform.","website":"https://glassoutlet.com.au"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. System archetypes (per docs/system-authoring-process.md Appendix A) ──
INSERT INTO system_archetypes (slug, name, family, geometry_module, rule_template_ids, description) VALUES
  ('slat-fence',           'Slat Fence',            'fence',       'fence_runs_v1',   ARRAY['slat_counting_v1','bay_post_v1','rail_cut_v1'],
    'Horizontal or vertical slat-based fence systems.'),
  ('panel-fence',          'Panel Fence',           'fence',       'fence_runs_v1',   ARRAY['panel_per_bay_v1','bay_post_v1'],
    'Steel / aluminium panel systems like ColorBond.'),
  ('mesh-fence',           'Mesh Fence',            'fence',       'fence_runs_v1',   ARRAY['panel_per_bay_v1','bay_post_v1'],
    'Chainwire / weldmesh fencing.'),
  ('timber-fence',         'Timber Fence',          'fence',       'fence_runs_v1',   ARRAY['paling_count_v1','rail_per_bay_v1','bay_post_v1'],
    'Timber paling and lap-and-cap fences.'),
  ('glass-pool-fence',     'Glass Pool Fence',      'pool-fence',  'panel_runs_v1',   ARRAY['glass_panel_v1','spigot_per_panel_v1'],
    'Frameless glass pool fencing with spigots / clamps.'),
  ('aluminium-pool-fence', 'Aluminium Pool Fence',  'pool-fence',  'panel_runs_v1',   ARRAY['panel_per_bay_v1','bay_post_v1'],
    'Aluminium pool fencing — Trojan / flat-top / spear-top style.'),
  ('balustrade',           'Balustrade',            'balustrade',  'balustrade_v1',   ARRAY['panel_per_bay_v1','handrail_v1'],
    'Balcony / staircase balustrade systems.'),
  ('swing-gate',           'Swing Gate',            'gate',        'gate_segment_v1', ARRAY['swing_gate_hardware_v1'],
    'Single / double swing gates.'),
  ('sliding-gate',         'Sliding Gate',          'gate',        'gate_segment_v1', ARRAY['sliding_track_v1','sliding_hardware_v1'],
    'Sliding gates including automated.'),
  ('equipment-enclosure',  'Equipment Enclosure',   'enclosure',   'enclosure_v1',    ARRAY['enclosure_wall_v1','enclosure_door_v1'],
    'CTS-style enclosed equipment housing.'),
  ('screen',               'Privacy Screen',        'screen',      'screen_panel_v1', ARRAY['panel_per_bay_v1'],
    'Privacy / decorative screens.'),
  ('shower',               'Shower Enclosure',      'shower',      'shower_v1',       ARRAY['glass_panel_v1','channel_cut_v1'],
    'Frameless / semi-frameless shower screens.')
ON CONFLICT (slug) DO NOTHING;

-- ─── 3. System instances for existing Glass Outlet seed files ────────────────
WITH go AS (SELECT id FROM suppliers WHERE slug = 'glass-outlet')
INSERT INTO system_instances (supplier_id, archetype_id, slug, name, status, readiness_status, trust_tier, visibility, description) VALUES
  ((SELECT id FROM go), (SELECT id FROM system_archetypes WHERE slug='slat-fence'),
    'qshs', 'QuickScreen Horizontal Slat', 'active', 'approved', 'platform', 'public',
    'Glass Outlet flagship horizontal slat fence. 65mm and 90mm slat sizes; multiple gap presets; full colour range.'),
  ((SELECT id FROM go), (SELECT id FROM system_archetypes WHERE slug='slat-fence'),
    'vs', 'QuickScreen Vertical Slat', 'active', 'approved', 'platform', 'public',
    'Vertical orientation variant of QuickScreen slat fencing.'),
  ((SELECT id FROM go), (SELECT id FROM system_archetypes WHERE slug='slat-fence'),
    'xpl', 'XPress Plus', 'active', 'approved', 'platform', 'public',
    'Friction-fit post system. 1W/2W/90 post types; no side frames; restricted option set.'),
  ((SELECT id FROM go), (SELECT id FROM system_archetypes WHERE slug='slat-fence'),
    'bayg', 'Buy As You Go', 'active', 'approved', 'platform', 'public',
    'Per-panel retail model. 3000mm panels; explicit panel_quantity input. Alumawood finish via AW- prefix.'),
  ((SELECT id FROM go), (SELECT id FROM system_archetypes WHERE slug='panel-fence'),
    'go-colorbond', 'Glass Outlet ColorBond', 'active', 'calculator_ready', 'platform', 'public',
    'ColorBond steel panel fencing supplied by Glass Outlet. Workbook regression pending.'),
  ((SELECT id FROM go), (SELECT id FROM system_archetypes WHERE slug='swing-gate'),
    'qs-gate', 'QS Gate (swing + sliding variants)', 'active', 'calculator_ready', 'platform', 'public',
    'QuickScreen pedestrian gate. Swing variant is the historical default; sliding variant (QSG Sliding) was added in the 2026-05-27 Codex work and shares the same product row + rule set. Compatible with QSHS / VS / XPL / BAYG. Workbook regression pending against Order-Form+QSG+Sliding+Gates+V2-T1.xlsx.'),
  ((SELECT id FROM go), (SELECT id FROM system_archetypes WHERE slug='sliding-gate'),
    'xpsg-gate', 'XP Sliding Gate components', 'active', 'approved', 'platform', 'public',
    'XPSG sliding gate component catalogue consumed by QS Gate sliding rules.')
ON CONFLICT (supplier_id, slug) DO NOTHING;

-- ─── 4. Backfill provenance on existing rows ────────────────────────────────
-- supplier_id = glass-outlet on every Glass-Outlet-era row.

UPDATE products            SET supplier_id = (SELECT id FROM suppliers WHERE slug='glass-outlet') WHERE supplier_id IS NULL;
UPDATE product_components  SET supplier_id = (SELECT id FROM suppliers WHERE slug='glass-outlet') WHERE supplier_id IS NULL;
UPDATE pricing_rules       SET supplier_id = (SELECT id FROM suppliers WHERE slug='glass-outlet') WHERE supplier_id IS NULL;

-- system_instance_id on products by system_type. UNIQUE(org_id, system_type) per
-- migration 022 means at most one row per (org, system_type) — straightforward 1:1 map.

UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug='qshs')         WHERE system_instance_id IS NULL AND system_type = 'QSHS';
UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug='vs')           WHERE system_instance_id IS NULL AND system_type = 'VS';
UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug='xpl')          WHERE system_instance_id IS NULL AND system_type = 'XPL';
UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug='bayg')         WHERE system_instance_id IS NULL AND system_type = 'BAYG';
UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug='go-colorbond') WHERE system_instance_id IS NULL AND system_type = 'ColorBond';
UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug='qs-gate')      WHERE system_instance_id IS NULL AND system_type = 'QS_GATE';
UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug='xpsg-gate')    WHERE system_instance_id IS NULL AND system_type = 'XPSG_GATE';

-- Backfill the related v3-engine tables by joining through to their parent product.

UPDATE product_components pc
   SET system_instance_id = p.system_instance_id
  FROM products p
 WHERE pc.product_id = p.id
   AND pc.system_instance_id IS NULL
   AND p.system_instance_id IS NOT NULL;

UPDATE product_variables pv
   SET system_instance_id = p.system_instance_id
  FROM products p
 WHERE pv.product_id = p.id
   AND pv.system_instance_id IS NULL
   AND p.system_instance_id IS NOT NULL;

UPDATE product_rules pr
   SET system_instance_id = p.system_instance_id
  FROM products p
 WHERE pr.product_id = p.id
   AND pr.system_instance_id IS NULL
   AND p.system_instance_id IS NOT NULL;

UPDATE product_component_selectors pcs
   SET system_instance_id = p.system_instance_id
  FROM products p
 WHERE pcs.product_id = p.id
   AND pcs.system_instance_id IS NULL
   AND p.system_instance_id IS NOT NULL;

UPDATE product_companion_rules pcr
   SET system_instance_id = p.system_instance_id
  FROM products p
 WHERE pcr.product_id = p.id
   AND pcr.system_instance_id IS NULL
   AND p.system_instance_id IS NOT NULL;

-- pricing_rules joins via pricing_rules.component_id → product_components.id → product_components.product_id → products.system_instance_id.
-- (After migration 008, pricing_rules has NO sku column; component_id is the canonical FK.)
UPDATE pricing_rules pr
   SET system_instance_id = p.system_instance_id
  FROM product_components pc
  JOIN products p ON p.id = pc.product_id
 WHERE pr.component_id = pc.id
   AND pr.system_instance_id IS NULL
   AND p.system_instance_id IS NOT NULL;

-- ─── 5. Sanity check: log any rows that didn't get tagged ───────────────────
-- These should be 0. If non-zero, surface to Liam — there's an unmapped system_type
-- or a join column shape that differs from what this brief assumes.

DO $$
DECLARE
  v_unmapped_products INT;
  v_unmapped_components INT;
  v_unmapped_pricing INT;
BEGIN
  SELECT COUNT(*) INTO v_unmapped_products
    FROM products WHERE supplier_id IS NULL OR system_instance_id IS NULL;
  SELECT COUNT(*) INTO v_unmapped_components
    FROM product_components WHERE supplier_id IS NULL OR system_instance_id IS NULL;
  SELECT COUNT(*) INTO v_unmapped_pricing
    FROM pricing_rules WHERE supplier_id IS NULL OR system_instance_id IS NULL;
  RAISE NOTICE 'backfill complete. unmapped: products=%, components=%, pricing_rules=%',
    v_unmapped_products, v_unmapped_components, v_unmapped_pricing;
END $$;
```

> **Note on schema assumptions:** This migration assumes `products.system_type` (text), `product_variables.{product_id, variable_key, variable_value}`, and `pricing_rules.product_sku` exist in the current schema. Verify against `supabase/migrations/008_restructure_schema.sql` and `011_engine_core.sql` before applying. If column names differ, adjust the UPDATE join keys but keep the logic identical.

## CI checks expected to pass

- `npm run typecheck` — green (no code changes)
- `npm run test` — green (`localBomCalculator.test.ts` UNCHANGED)
- `npm run build` — green
- Migration applies cleanly to a Supabase instance that has migration 032 + the existing Glass Outlet seed data
- The migration's `RAISE NOTICE` should show `unmapped: products=0, components=0, pricing_rules=0` on a fully-seeded DB

## PR description template

```markdown
## Brief 033 — Data backfill: Glass Outlet + archetypes + system instances + provenance

Pure data migration. Populates the identity tables introduced in brief 032 and tags every existing Glass Outlet row with supplier + system_instance provenance.

### What's in this PR

- Migration `033_backfill_glass_outlet_supplier_and_instances.sql`:
  - INSERT INTO suppliers — `glass-outlet` row (trust_tier = `platform`)
  - INSERT INTO system_archetypes — the 12 canonical archetypes (per `docs/system-authoring-process.md` Appendix A)
  - INSERT INTO system_instances — 8 Glass Outlet instances (QSHS, VS, XPL, BAYG, go-colorbond, qs-gate-swing, qsg-sliding, xpsg-gate)
  - UPDATE products / product_components / product_variables / product_rules / product_component_selectors / product_companion_rules / pricing_rules — backfill supplier_id + system_instance_id
- Updated `docs/system-authoring-process.md` Decision log

### What's NOT in this PR (by design)

- No schema changes (brief 032 covered those)
- No code changes
- No UI changes
- No seed JSON changes (brief 036 evolves the seed shape)

### Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes including `localBomCalculator.test.ts` UNCHANGED
- [ ] `npm run build` passes
- [ ] Migration applies cleanly to a fresh Supabase instance with brief 032 applied
- [ ] `RAISE NOTICE` shows `unmapped: products=0, components=0, pricing_rules=0` on the fully-seeded DB
- [ ] PR base branch is `main` (NOT `master`)
```

## Stop points

If `unmapped > 0` for any table after the migration runs, **STOP** and report which rows weren't tagged. The most likely cause: a `system_type` value in seed JSON that isn't in the mapping table above (e.g. `gate_legacy.json.disabled` was reactivated, or a new seed was added that this brief didn't account for). Surface to Liam — extending the mapping is a one-line change.

If any of the schema assumptions verified in this brief turn out to be different on the actual DB (column names, FK shapes), **STOP** and surface the actual schema. The most safety-critical ones (already audited via GitHub API for this brief):
- `pricing_rules.component_id` (FK → `product_components.id`) — verified
- `product_components.product_id` (FK → `products.id`) — verified (migrations 006 + 008)
- `products.system_type` — verified (migration 005 + 022)
- `pricing_rules` has NO `sku` column — verified (dropped in migration 008)

## After this PR merges

- **Run** `npm run seed:products` to confirm the seed script still works (it should — seed JSON hasn't changed).
- **Brief 034** runs: versioned price books + quote pinning. After 034 lands, every existing pricing_rule has a price_book entry too.
- **Brief 035** runs: admin CRUD UI for suppliers + instances. After 035 lands, Liam can promote/demote suppliers, edit instance metadata, and change readiness_status through the UI.

The platform is now "identity-aware" — every entity carries supplier + system_instance provenance. Visibility and trust-tier policies are enforceable. The next phase is adding the pricing layer (034) and the admin UI surface (035).