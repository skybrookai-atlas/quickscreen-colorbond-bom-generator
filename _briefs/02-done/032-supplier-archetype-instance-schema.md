# Brief 032 — Supplier + Archetype + Instance Schema (schema only)

**Status:** Ready for execution
**Repo:** `github.com/skybrookai-atlas/quickscreen-colorbond-generator`
**Default branch:** `main` (NOT `master`)
**Depends on:** brief 028 merged (architecture docs + MASTER-BRIEF + INVENTORY on `main`)
**Estimated PR size:** medium (one schema migration + types + Zod validators + read-only query helpers; no UI; no calculator runtime change)
**Primary reference:** `docs/system-authoring-process.md` (Section 5 "Schema Additions") and `docs/multi-supplier-platform-architecture.md` (Layer 2 — Catalogue)

> **This brief supersedes** the obsoleted `_briefs/asset-archive/030-catalogue-model.md` draft from the architecture phase (which proposed a conflicting new `products` table; migrations 030 and 031 are already used in this repo). This brief uses migration **032** and **extends** the existing v3 catalogue tables rather than replacing them.

---

## Goal

Add the three-tier identity tables (`suppliers`, `system_archetypes`, `system_instances`) plus support tables (`system_instance_grants`, `system_instance_reports`). Add nullable provenance columns on the existing v3 catalogue tables (`products`, `product_components`, `product_variables`, `product_rules`, `product_component_selectors`, `product_companion_rules`, `pricing_rules`) so every entity can be tagged with which supplier, system archetype, and system instance it belongs to.

**This is a pure schema brief.** No UI changes. No calculator changes. No behaviour changes in production. Existing Glass Outlet seed JSON continues to deploy correctly via `npm run seed:products`. The deploy preview should look identical to `main`.

After this lands, **brief 033** backfills Glass Outlet supplier + the 12 archetype rows + system_instance rows for existing seed files + provenance on all existing rows.

## Verified preconditions (already confirmed in repo, do not re-derive)

- **Admin check pattern (canonical):** `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'` — established in migration 025_admin_rls.sql.
- **Org lookup pattern (canonical):** `public.user_org_id()` SECURITY DEFINER function — established in migration 002_create_profiles.sql. **Use this, do NOT define a new `auth_org_id()` helper.**
- **`profiles.role` column type:** declared TEXT in 002 with check `('owner', 'admin', 'member')`; migration 019 added a `user_role` enum but its `ADD COLUMN IF NOT EXISTS` is a no-op on the already-existing column. The column stays TEXT. The `= 'admin'` comparison works either way.
- **UUID generation:** `gen_random_uuid()` from `pgcrypto` is in use across existing migrations (e.g. 003, 008). The extension is enabled.
- **Updated-at trigger:** `public.touch_updated_at()` already exists from migration 008. **Reuse it exactly — do NOT redefine; do NOT alias as `set_updated_at`.**
- **`products` already has RLS:** migration 010 enabled `products_select_own_org` on `org_id = public.user_org_id()`. This brief adds nullable columns; it does not change products' existing RLS.
- **`pricing_rules` shape (after migration 008):** columns are `id, org_id, component_id (FK → product_components.id), tier_code, rule (math.js expression), price NUMERIC(10,2), priority, active, valid_from, valid_to, updated_at`. **There is NO `sku` column** — SKU is accessed via the `pricing_rules_with_sku` VIEW. Brief 032 only ADDs nullable `supplier_id` and `system_instance_id`; the existing columns stay.
- **`product_variables` shape (after migration 012):** columns are `id, org_id, product_id, name, label, data_type, unit, required, default_value_json, options_json, scope, sort_order, active`. **Note `name` not `variable_key`; `default_value_json`/`options_json` not `variable_value`.** Brief 033 must use these column names.

## Hard rules

- **`src/lib/localBomCalculator.ts` must NOT be modified.** Test suite (`localBomCalculator.test.ts`) must pass UNCHANGED.
- **`canonicalAdapter.ts` public function signatures must not be modified.**
- **`canvasEngine.ts` public types must not be modified.**
- **Do NOT create a new `products` table.** The existing one stays; we ADD nullable columns to it.
- **Do NOT touch `pricing_rules` data** — only ADD nullable `supplier_id` and `system_instance_id` columns.
- **Do NOT touch `package.json`** unless strictly necessary.
- **PR base branch is `main`** (NOT `master`). Verify before opening.
- **Skip the Deno integration job** — known red on XP-BTP-B fixture, pre-existing.
- **Draft PR only.** Human review gate.
- After merge: brief 033 must run before any code reads from the new tables in earnest. Brief 032 alone is safe to deploy — new columns are nullable, new tables are empty but valid.

## Files this brief touches

| File | Type of change |
|---|---|
| `supabase/migrations/032_supplier_archetype_instance_schema.sql` | NEW — schema migration |
| `src/types/multiSupplier.ts` | NEW — TypeScript types |
| `src/lib/multiSupplier/schemas.ts` | NEW — Zod runtime schemas |
| `src/lib/multiSupplier/queries.ts` | NEW — read-only query helpers |
| `src/lib/multiSupplier/index.ts` | NEW — public export surface |
| `src/lib/multiSupplier/__tests__/schemas.test.ts` | NEW — smoke tests |
| `docs/app-overview.md` | UPDATE — append `multiSupplier` module to the file map |

**Explicitly NOT touched:**

- `src/lib/localBomCalculator.ts`
- `src/lib/localBomCalculator.test.ts`
- `src/components/canvas/canvasEngine.ts`
- `src/components/canvas/canonicalAdapter.ts`
- `src/pages/CalculatorV3Page.tsx`
- Any other UI component
- Any existing seed JSON (`supabase/seeds/glass-outlet/products/*.json`)
- Any existing migration file
- `supabase/functions/bom-calculator/`

## Migration SQL

Create `supabase/migrations/032_supplier_archetype_instance_schema.sql`:

```sql
-- ============================================================================
-- 032_supplier_archetype_instance_schema.sql
--
-- Adds the three-tier identity model (supplier / archetype / instance) for the
-- multi-supplier platform rollout. See docs/system-authoring-process.md for the
-- full design. Reuses existing patterns:
--   - admin check: (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
--   - org lookup:  public.user_org_id()  (from migration 002)
--   - updated_at trigger: public.set_updated_at()  (from migration 008)
--   - UUID generation: gen_random_uuid()  (pgcrypto already enabled)
-- ============================================================================

-- ─── Suppliers ──────────────────────────────────────────────────────────────
-- Lightweight, growable. Can be platform-owned, verified-supplier-owned, or
-- user-created. Carried on every catalogue entity.
CREATE TABLE suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  logo_url      TEXT,
  brand_colour  TEXT,
  contact_email TEXT,
  trust_tier    TEXT NOT NULL DEFAULT 'user'
                CHECK (trust_tier IN ('platform','verified','community','user')),
  authored_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  org_id        UUID REFERENCES organisations(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','hidden','draft','discontinued')),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_slug ON suppliers(slug);
CREATE INDEX idx_suppliers_trust_tier ON suppliers(trust_tier);
CREATE INDEX idx_suppliers_org ON suppliers(org_id) WHERE org_id IS NOT NULL;

-- ─── System archetypes ──────────────────────────────────────────────────────
-- Abstract patterns shared across suppliers (slat-fence, panel-fence, etc.).
-- Controlled vocabulary. Admin-managed.
CREATE TABLE system_archetypes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT UNIQUE NOT NULL,
  name               TEXT NOT NULL,
  family             TEXT NOT NULL
                     CHECK (family IN ('fence','gate','pool-fence','balustrade','screen','enclosure','shower','other')),
  geometry_module    TEXT NOT NULL,  -- name of the canvas geometry adapter, e.g. 'fence_runs_v1'
  variable_schema    JSONB NOT NULL DEFAULT '{}'::jsonb,
  rule_template_ids  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','hidden','draft')),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_archetypes_family ON system_archetypes(family);
CREATE INDEX idx_archetypes_status ON system_archetypes(status);

-- ─── System instances ───────────────────────────────────────────────────────
-- supplier × archetype + supplier-specific config. What users actually pick
-- in the calculator picker.
CREATE TABLE system_instances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  archetype_id    UUID NOT NULL REFERENCES system_archetypes(id) ON DELETE RESTRICT,
  slug             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','hidden','discontinued')),
  readiness_status TEXT NOT NULL DEFAULT 'draft'
                   CHECK (readiness_status IN ('draft','imported','calculator_ready','price_checked','spreadsheet_tested','approved')),
  trust_tier       TEXT NOT NULL DEFAULT 'user'
                   CHECK (trust_tier IN ('platform','verified','community','user')),
  visibility       TEXT NOT NULL DEFAULT 'private'
                   CHECK (visibility IN ('private','org_shared','public')),
  authored_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  org_id           UUID REFERENCES organisations(id) ON DELETE SET NULL,
  approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  readiness_notes  TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, slug)
);

CREATE INDEX idx_system_instances_supplier   ON system_instances(supplier_id);
CREATE INDEX idx_system_instances_archetype  ON system_instances(archetype_id);
CREATE INDEX idx_system_instances_status     ON system_instances(status);
CREATE INDEX idx_system_instances_visibility ON system_instances(visibility);
CREATE INDEX idx_system_instances_readiness  ON system_instances(readiness_status);
CREATE INDEX idx_system_instances_authored   ON system_instances(authored_by) WHERE authored_by IS NOT NULL;
CREATE INDEX idx_system_instances_org        ON system_instances(org_id) WHERE org_id IS NOT NULL;

-- ─── System instance grants (B2B sharing) ──────────────────────────────────
-- Lets an admin grant a specific system_instance to another org.
CREATE TABLE system_instance_grants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_instance_id UUID NOT NULL REFERENCES system_instances(id) ON DELETE CASCADE,
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  granted_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system_instance_id, org_id)
);

CREATE INDEX idx_instance_grants_instance ON system_instance_grants(system_instance_id);
CREATE INDEX idx_instance_grants_org      ON system_instance_grants(org_id);

-- ─── System instance reports (community moderation) ────────────────────────
-- Quality reports on community-tier content. Used by brief 041 for demotion.
CREATE TABLE system_instance_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_instance_id UUID NOT NULL REFERENCES system_instances(id) ON DELETE CASCADE,
  reported_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason             TEXT NOT NULL,
  details            TEXT,
  status             TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','reviewing','resolved','dismissed')),
  resolved_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at        TIMESTAMPTZ,
  resolution_note    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_instance_reports_instance ON system_instance_reports(system_instance_id);
CREATE INDEX idx_instance_reports_status   ON system_instance_reports(status);

-- ─── Provenance columns on existing v3 catalogue tables ────────────────────
-- ALL new columns nullable initially. Brief 033 backfills them.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS system_instance_id UUID REFERENCES system_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS authored_by        UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier
  ON products(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_system_instance
  ON products(system_instance_id) WHERE system_instance_id IS NOT NULL;

ALTER TABLE product_components
  ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS system_instance_id UUID REFERENCES system_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_components_supplier
  ON product_components(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_components_system_instance
  ON product_components(system_instance_id) WHERE system_instance_id IS NOT NULL;

ALTER TABLE product_variables
  ADD COLUMN IF NOT EXISTS system_instance_id UUID REFERENCES system_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_variables_system_instance
  ON product_variables(system_instance_id) WHERE system_instance_id IS NOT NULL;

ALTER TABLE product_rules
  ADD COLUMN IF NOT EXISTS system_instance_id UUID REFERENCES system_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_rules_system_instance
  ON product_rules(system_instance_id) WHERE system_instance_id IS NOT NULL;

ALTER TABLE product_component_selectors
  ADD COLUMN IF NOT EXISTS system_instance_id UUID REFERENCES system_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_component_selectors_system_instance
  ON product_component_selectors(system_instance_id) WHERE system_instance_id IS NOT NULL;

ALTER TABLE product_companion_rules
  ADD COLUMN IF NOT EXISTS system_instance_id UUID REFERENCES system_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_companion_rules_system_instance
  ON product_companion_rules(system_instance_id) WHERE system_instance_id IS NOT NULL;

ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS system_instance_id UUID REFERENCES system_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_rules_supplier
  ON pricing_rules(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_system_instance
  ON pricing_rules(system_instance_id) WHERE system_instance_id IS NOT NULL;

-- ─── updated_at triggers ────────────────────────────────────────────────────
-- public.touch_updated_at() already exists from migration 008. Reuse exactly.
CREATE TRIGGER trigger_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trigger_system_archetypes_updated_at
  BEFORE UPDATE ON system_archetypes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trigger_system_instances_updated_at
  BEFORE UPDATE ON system_instances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_archetypes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_instances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_instance_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_instance_reports ENABLE ROW LEVEL SECURITY;

-- Suppliers: platform + verified + community visible to everyone; user-tier
-- visible only to author or same org. Admin can do anything.
CREATE POLICY "suppliers_read" ON suppliers FOR SELECT TO authenticated
  USING (
    trust_tier IN ('platform','verified','community')
    OR authored_by = auth.uid()
    OR org_id = public.user_org_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (authored_by IS NULL OR authored_by = auth.uid())
  );

CREATE POLICY "suppliers_update_author" ON suppliers FOR UPDATE TO authenticated
  USING (authored_by = auth.uid())
  WITH CHECK (authored_by = auth.uid());

CREATE POLICY "suppliers_update_admin" ON suppliers FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "suppliers_delete_admin" ON suppliers FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers TO authenticated;

-- Archetypes: controlled vocab. Read open to all authenticated; write admin-only.
CREATE POLICY "archetypes_read" ON system_archetypes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "archetypes_insert_admin" ON system_archetypes FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "archetypes_update_admin" ON system_archetypes FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "archetypes_delete_admin" ON system_archetypes FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON system_archetypes TO authenticated;

-- System instances: visibility-aware read; author or admin write.
CREATE POLICY "system_instances_read" ON system_instances FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR (visibility = 'org_shared' AND id IN (
        SELECT system_instance_id FROM system_instance_grants WHERE org_id = public.user_org_id()
    ))
    OR org_id = public.user_org_id()
    OR authored_by = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "system_instances_insert" ON system_instances FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (authored_by IS NULL OR authored_by = auth.uid())
  );

CREATE POLICY "system_instances_update_author" ON system_instances FOR UPDATE TO authenticated
  USING (authored_by = auth.uid())
  WITH CHECK (authored_by = auth.uid());

CREATE POLICY "system_instances_update_admin" ON system_instances FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "system_instances_delete_admin" ON system_instances FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON system_instances TO authenticated;

-- Grants: read by org members or admin; write admin-only.
CREATE POLICY "instance_grants_read" ON system_instance_grants FOR SELECT TO authenticated
  USING (
    org_id = public.user_org_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "instance_grants_write_admin" ON system_instance_grants FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON system_instance_grants TO authenticated;

-- Reports: reporter sees own; admin sees all; any authenticated can file.
CREATE POLICY "instance_reports_read" ON system_instance_reports FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "instance_reports_insert" ON system_instance_reports FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (reported_by IS NULL OR reported_by = auth.uid())
  );

CREATE POLICY "instance_reports_update_admin" ON system_instance_reports FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT, INSERT, UPDATE ON system_instance_reports TO authenticated;
```

## TypeScript types

Create `src/types/multiSupplier.ts`:

```typescript
export type TrustTier = 'platform' | 'verified' | 'community' | 'user';
export type EntityStatus = 'active' | 'hidden' | 'draft' | 'discontinued';
export type ReadinessStatus =
  | 'draft' | 'imported' | 'calculator_ready'
  | 'price_checked' | 'spreadsheet_tested' | 'approved';
export type Visibility = 'private' | 'org_shared' | 'public';
export type ArchetypeFamily =
  | 'fence' | 'gate' | 'pool-fence' | 'balustrade'
  | 'screen' | 'enclosure' | 'shower' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export interface Supplier {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  brandColour?: string;
  contactEmail?: string;
  trustTier: TrustTier;
  authoredBy?: string;
  orgId?: string;
  status: EntityStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SystemArchetype {
  id: string;
  slug: string;
  name: string;
  family: ArchetypeFamily;
  geometryModule: string;
  variableSchema: Record<string, unknown>;
  ruleTemplateIds: string[];
  description?: string;
  status: 'active' | 'hidden' | 'draft';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SystemInstance {
  id: string;
  supplierId: string;
  archetypeId: string;
  slug: string;
  name: string;
  description?: string;
  status: EntityStatus;
  readinessStatus: ReadinessStatus;
  trustTier: TrustTier;
  visibility: Visibility;
  authoredBy?: string;
  orgId?: string;
  approvedBy?: string;
  approvedAt?: string;
  readinessNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SystemInstanceGrant {
  id: string;
  systemInstanceId: string;
  orgId: string;
  grantedBy?: string;
  grantedAt: string;
}

export interface SystemInstanceReport {
  id: string;
  systemInstanceId: string;
  reportedBy?: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}
```

## Zod schemas

Create `src/lib/multiSupplier/schemas.ts`:

```typescript
import { z } from 'zod';

export const trustTierSchema = z.enum(['platform', 'verified', 'community', 'user']);
export const entityStatusSchema = z.enum(['active', 'hidden', 'draft', 'discontinued']);
export const readinessStatusSchema = z.enum([
  'draft','imported','calculator_ready','price_checked','spreadsheet_tested','approved',
]);
export const visibilitySchema = z.enum(['private', 'org_shared', 'public']);
export const archetypeFamilySchema = z.enum([
  'fence','gate','pool-fence','balustrade','screen','enclosure','shower','other',
]);
export const reportStatusSchema = z.enum(['open', 'reviewing', 'resolved', 'dismissed']);

export const supplierSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  logoUrl: z.string().url().optional(),
  brandColour: z.string().optional(),
  contactEmail: z.string().email().optional(),
  trustTier: trustTierSchema,
  authoredBy: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  status: entityStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const systemArchetypeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  family: archetypeFamilySchema,
  geometryModule: z.string().min(1),
  variableSchema: z.record(z.unknown()),
  ruleTemplateIds: z.array(z.string()),
  description: z.string().optional(),
  status: z.enum(['active', 'hidden', 'draft']),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const systemInstanceSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid(),
  archetypeId: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  status: entityStatusSchema,
  readinessStatus: readinessStatusSchema,
  trustTier: trustTierSchema,
  visibility: visibilitySchema,
  authoredBy: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().optional(),
  readinessNotes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

## Query helpers

Create `src/lib/multiSupplier/queries.ts`:

```typescript
import { supabase } from '@/lib/supabaseClient'; // adjust to repo's actual import path
import type { Supplier, SystemArchetype, SystemInstance } from '@/types/multiSupplier';

// All queries below are read-only. Writes happen via the admin UI in brief 035+.

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers').select('*').eq('status', 'active').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToSupplier);
}

export async function getSupplierBySlug(slug: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? rowToSupplier(data) : null;
}

export async function listArchetypes(): Promise<SystemArchetype[]> {
  const { data, error } = await supabase
    .from('system_archetypes').select('*').eq('status', 'active').order('family').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToArchetype);
}

export async function listSystemInstances(opts: {
  supplierId?: string;
  archetypeId?: string;
  status?: 'active' | 'hidden' | 'draft' | 'discontinued';
} = {}): Promise<SystemInstance[]> {
  let q = supabase.from('system_instances').select('*');
  if (opts.supplierId) q = q.eq('supplier_id', opts.supplierId);
  if (opts.archetypeId) q = q.eq('archetype_id', opts.archetypeId);
  if (opts.status) q = q.eq('status', opts.status);
  q = q.order('name');
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToSystemInstance);
}

function rowToSupplier(row: any): Supplier {
  return {
    id: row.id, slug: row.slug, name: row.name,
    logoUrl: row.logo_url ?? undefined,
    brandColour: row.brand_colour ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    trustTier: row.trust_tier,
    authoredBy: row.authored_by ?? undefined,
    orgId: row.org_id ?? undefined,
    status: row.status, metadata: row.metadata ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function rowToArchetype(row: any): SystemArchetype {
  return {
    id: row.id, slug: row.slug, name: row.name, family: row.family,
    geometryModule: row.geometry_module,
    variableSchema: row.variable_schema ?? {},
    ruleTemplateIds: row.rule_template_ids ?? [],
    description: row.description ?? undefined,
    status: row.status, metadata: row.metadata ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function rowToSystemInstance(row: any): SystemInstance {
  return {
    id: row.id, supplierId: row.supplier_id, archetypeId: row.archetype_id,
    slug: row.slug, name: row.name,
    description: row.description ?? undefined,
    status: row.status, readinessStatus: row.readiness_status,
    trustTier: row.trust_tier, visibility: row.visibility,
    authoredBy: row.authored_by ?? undefined,
    orgId: row.org_id ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    readinessNotes: row.readiness_notes ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
```

> **Note:** Verify the supabase client import path. The current repo uses `@/lib/supabaseClient` (`supabaseClient.ts` exporting `supabase`). If that has changed, align.

## Public exports

Create `src/lib/multiSupplier/index.ts`:

```typescript
export * from './queries';
export * as multiSupplierSchemas from './schemas';
```

## Tests

Create `src/lib/multiSupplier/__tests__/schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  supplierSchema, systemArchetypeSchema, systemInstanceSchema,
  trustTierSchema, readinessStatusSchema, archetypeFamilySchema,
} from '../schemas';

describe('multiSupplier schemas', () => {
  const now = new Date().toISOString();
  const u = '11111111-1111-1111-1111-111111111111';

  it('parses a valid supplier row', () => {
    const ok = supplierSchema.safeParse({
      id: u, slug: 'glass-outlet', name: 'Glass Outlet',
      trustTier: 'platform', status: 'active', createdAt: now, updatedAt: now,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an invalid trust_tier', () => {
    expect(trustTierSchema.safeParse('founder').success).toBe(false);
  });

  it('rejects an invalid readiness_status', () => {
    expect(readinessStatusSchema.safeParse('shipping').success).toBe(false);
  });

  it('parses each archetype family', () => {
    const families = ['fence','gate','pool-fence','balustrade','screen','enclosure','shower','other'];
    for (const f of families) expect(archetypeFamilySchema.safeParse(f).success).toBe(true);
    expect(archetypeFamilySchema.safeParse('roof').success).toBe(false);
  });

  it('parses a valid system_archetype row', () => {
    const ok = systemArchetypeSchema.safeParse({
      id: u, slug: 'slat-fence', name: 'Slat Fence', family: 'fence',
      geometryModule: 'fence_runs_v1', variableSchema: {},
      ruleTemplateIds: ['slat_counting_v1'], status: 'active',
      createdAt: now, updatedAt: now,
    });
    expect(ok.success).toBe(true);
  });

  it('parses a valid system_instance row', () => {
    const ok = systemInstanceSchema.safeParse({
      id: u, supplierId: u, archetypeId: u, slug: 'qshs',
      name: 'QuickScreen Horizontal Slat', status: 'active',
      readinessStatus: 'approved', trustTier: 'platform', visibility: 'public',
      createdAt: now, updatedAt: now,
    });
    expect(ok.success).toBe(true);
  });
});
```

**Critical:** `localBomCalculator.test.ts` must continue to pass UNCHANGED.

## CI checks expected to pass

- `npm run typecheck` — green
- `npm run test` — green (`localBomCalculator.test.ts` UNCHANGED)
- `npm run build` — green
- Migration applies cleanly to a fresh Supabase instance
- Deno integration job — skip (known red)

## PR description template

```markdown
## Brief 032 — Supplier + Archetype + Instance Schema (schema only)

Implements the three-tier identity model (supplier / archetype / instance) defined in `docs/system-authoring-process.md` Section 2. Pure schema brief — no UI changes, no calculator changes, no behaviour changes in production.

### What's in this PR

- Migration `032_supplier_archetype_instance_schema.sql`:
  - Tables: `suppliers`, `system_archetypes`, `system_instances`, `system_instance_grants`, `system_instance_reports`
  - Nullable provenance columns: `products.{supplier_id, system_instance_id, authored_by}`, `product_components.{supplier_id, system_instance_id}`, `product_variables.system_instance_id`, `product_rules.system_instance_id`, `product_component_selectors.system_instance_id`, `product_companion_rules.system_instance_id`, `pricing_rules.{supplier_id, system_instance_id}`
  - Visibility-aware RLS policies (reuse `public.user_org_id()` and the existing admin-role pattern from migration 025)
- TypeScript types: `src/types/multiSupplier.ts`
- Zod schemas: `src/lib/multiSupplier/schemas.ts`
- Read-only query helpers: `src/lib/multiSupplier/queries.ts`
- Smoke tests: `src/lib/multiSupplier/__tests__/schemas.test.ts`
- Updated `docs/app-overview.md`

### What's NOT in this PR (by design)

- No UI changes
- No calculator behaviour changes
- No data population (brief 033 backfills Glass Outlet + existing system instances + provenance)
- No admin UI (brief 035)
- No modifications to `localBomCalculator.ts`, `canonicalAdapter.ts`, `canvasEngine.ts`, or seed JSON

### Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes including `localBomCalculator.test.ts` UNCHANGED
- [ ] `npm run build` passes
- [ ] Migration applies cleanly to a fresh Supabase instance
- [ ] No visible changes in the deploy preview (intentional — schema-only)
- [ ] PR base branch is `main` (NOT `master`)
```

## Stop points

If any of these are encountered, **PAUSE** and surface to Liam:

1. **Supabase client import path mismatch.** Check `src/lib/supabaseClient.ts` (or wherever the existing client lives) for the current export shape before pasting into `queries.ts`.

2. **RLS policy name collisions.** If a policy name in this migration already exists from a prior migration (unlikely — these names are scoped to the new tables), surface and rename.

3. **`public.touch_updated_at()` missing.** It should exist from migration 008 (verified by inspecting the migration via GitHub API). If not, add a guarded `CREATE OR REPLACE FUNCTION` at the top of this migration. **Do NOT use the name `set_updated_at` — the canonical name is `touch_updated_at`.**

4. **`pgcrypto` not enabled.** `gen_random_uuid()` should work because earlier migrations use it. If it errors, add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at the top.

5. **profiles.role column type confusion.** Migrations 002 (TEXT) and 019 (`user_role` enum, no-op ADD COLUMN) leave this ambiguous in theory. In practice the column is TEXT and the comparison `= 'admin'` works either way. If the deploy fails on RLS check, surface and inspect the actual column type.

## After this PR merges

- **Brief 033** runs immediately: backfill Glass Outlet supplier, the 12 archetype rows, system_instance rows for existing seed files, and provenance on all existing products / components / variables / rules / selectors / companion_rules / pricing_rules.
- **Brief 034** runs after 033: versioned price books + quote pinning (the pricing layer of the 5-layer architecture).
- **Brief 035** runs after 033: admin CRUD UI for suppliers + system_instances.

The platform now has identity, but is not yet usable end-to-end until 033-035 land.