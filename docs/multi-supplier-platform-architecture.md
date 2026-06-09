# Multi-Supplier Platform Architecture

> **Source of truth for the QuickScreen platform's evolution from a single-supplier calculator into a multi-supplier catalogue platform.** All future Codex briefs reference this document. If a brief and this doc disagree, this doc wins until updated here first.

**Status:** Draft v1
**Last updated:** 2026-05-26
**Authors:** Liam Boyd, plus architectural synthesis from Hyperagent thread (Codex + developer consultation)
**Audience:** Codex agents, future developers, SkyBrookAI dev org
**Repo:** `github.com/skybrookai-atlas/quickscreen-colorbond-generator` (forked from `skybrook-tech/quickscreen-bom-generator` 2026-05-26, default branch `main`)

## Relationship to existing docs

This architecture **extends** the decisions in two existing documents in this repo. It does not re-decide them.

- **`docs/calculator-architecture-tradeoffs.md`** — already chose **Approach A (server-side BOM via `bom-calculator` Supabase Edge function + Postgres-driven seeds)** as the canonical production path, with client-side calculation explicitly marked non-authoritative. Every layer described below operates inside that decision.
- **`docs/catalogue-gap-analysis.md`** — already enumerates the SKU and rule gaps that need to flow into the new catalogue schema. The first wave of seed data after brief 030 lands comes from this gap analysis (QSHS coloured SKUs, XPL extrusions, QS_GATE rails, BAYG Island Grey, ColorBond, sliding gate system, Alumawall).
- **`docs/seed-data-mapping-spec.md`**, **`docs/canonical-payload.md`**, **`docs/engine-schema.md`** — current contracts that the catalogue schema must extend cleanly without breaking.
- **`catalogues/`** — source-of-truth PDFs and text extractions Liam is feeding into the gap analysis and eventually the staging-and-publish pipeline.

If this doc and one of those disagree, the question is whether to update this doc or the other — never silently diverge.

---

## Executive Summary

The current QuickScreen app is a single-supplier (Glass Outlet) BOM calculator. It works in production and serves Glass Outlet's product range well. To grow into a platform that supports hundreds of products across many suppliers and systems, the architecture has to shift from **"the calculator that has products added to it"** to **"a catalogue platform with a calculator on top."**

This is a mindset shift, not just a refactor. The calculator becomes one consumer of catalogue data, not the system that owns the data.

The architecture has **five layers**:

1. **Geometry** — universal, hardcoded. Runs, segments, gates, corners, canvas behaviour, canonical payloads. Same for every supplier.
2. **Catalogue** — fully data-driven. Suppliers, systems, product families, SKUs, colours, profiles, heights, accessories, documents, diagrams.
3. **System Rules** — hybrid, three tiers. Reusable rule templates for simple systems, data-driven math for medium-complexity systems, custom code modules behind a stable interface for unusual systems.
4. **Pricing & Price Books** — versioned, with status lifecycle (draft / reviewed / published / archived). Quotes remember which price book version they used, so old quotes never silently drift.
5. **Visibility & Access** — first-class. Backend-resolved rules for which suppliers, systems, and products each user sees. Not frontend `if` statements.

The rollout is **admin-first then self-serve**: Liam ingests supplier price lists via an admin workflow today; the data model and APIs are designed so suppliers can self-serve their own uploads in phase two without retrofit.

The deliverable from this architecture is a phased migration that ships as a series of Codex briefs, each respecting the protected files (`localBomCalculator.ts`, `canonicalAdapter.ts` public signatures, `canvasEngine.ts` public types) and the strict-sequential dependency rule that has prevented bad-merge regressions.

---

## Current State Audit

### What is already data-driven (good — keep extending this)

- **Supabase tables** for products, product_variables, product_rules, selectors, companion rules, warnings, pricing rules (v3 rule tables)
- **Seed JSON** at `supabase/seeds/{supplier}/products/{family}.json` for the structured product catalogue
- **Schema-driven form rendering** via `SchemaDrivenForm.tsx` — pure renderer that reads field definitions and produces UI without per-system hardcoding
- **Canonical form** as a stable contract between UI, canvas, and BOM calculator

### What still forces code changes (the problem we are solving)

- **`src/lib/productOptionRules.ts`** — per-system option logic still in TypeScript. Adding a new system means editing this file.
- **`src/lib/localBomCalculator.ts`** — 1334 lines of BOM rules embedded in code. Some logic genuinely needs to be code (algorithmic edge cases); much of it is parametric and could be data.
- **Hardcoded UI metadata** — labels, helper text, option ordering, group headings sometimes live in code rather than per-product data
- **Hardcoded supplier visibility** — Glass Outlet is the only supplier; there is no real visibility/scoping layer yet
- **Pricing model is too thin** — `(sku, tier_code)` keyed pricing without effective dates, status, or version history
- **No import pipeline** — supplier updates today happen by editing seed JSON files by hand
- **No QA / readiness tracking** — no formal lifecycle for "is this system ready to ship?"

### Scaling pain points concretely

- Adding ColorBond (panel-based fencing) today requires: a new seed JSON, new option rules in `productOptionRules.ts`, new BOM branches in `localBomCalculator.ts`, and UI updates to surface the new system. That is ~4 files changed and the `if (system === 'ColorBond')` anti-pattern starts to take hold.
- Updating Glass Outlet pricing today means editing seed JSON manually. There is no diff view, no review step, no rollback, and no history of what price was used on which quote.
- Hiding discontinued products requires a code deploy.
- Restricting a customer to a subset of suppliers (B2B scenario) is not possible without code.

The architecture below resolves all of these.

---

## The 5-Layer Model

### Layer 1: Geometry (stays hardcoded)

**Responsibilities:**

- Fence runs, segments, gates, corners, terminations
- Layout canvas behaviour (drawing, zoom, undo/redo, touch gestures)
- Heights, widths, and other dimensional inputs
- Canonical payload shape — the contract every other layer reads from
- Quote payload structure persisted to Supabase

**What stays in code:**

- `src/components/canvas/canvasEngine.ts` (internal coordinate refactor allowed, public types stable)
- `src/components/canvas/canonicalAdapter.ts` (signatures stable across V2/V3/V4)
- `src/components/canvas/FenceLayoutCanvas.tsx`
- All canvas toolbars, gesture handlers, and overlay components
- Canonical form TypeScript types and Zod schemas

**Why:** This is the "shape of a job." It is supplier-agnostic and changes only when the platform itself evolves (e.g., adding a new geometric primitive). It is also where physics, UX, and platform-level performance live — none of that belongs in data.

### Layer 2: Catalogue (data-driven)

**Responsibilities:**

- Suppliers
- Systems / product families
- Products / SKUs / components
- Colours, finishes, profiles
- Heights, widths, slat sizes, gap presets, post types
- Accessories (gates, end posts, brackets, hardware)
- Documents (installation guides, spec sheets)
- Diagrams (component-numbered images for "what is this part?")
- Compatibility relationships (which gates work with which systems)

**Where it lives:** Supabase tables (canonical), seed JSON (development + version control + initial import), admin UI for editing (phase 2).

**What stays in code:**

- The schemas (TypeScript types + Zod validators) for these entities
- Query / mutation helpers
- Migration files

**Why data-driven:** This is where supplier diversity lives. Glass Outlet has slat-based systems; ColorBond will be panel-based; future suppliers will have their own taxonomies. Forcing this into code creates `if (system === X)` branches that compound over time.

### Layer 3: System Rules (hybrid, three tiers)

**Responsibilities:**

- BOM calculation logic per system
- Component selection (which SKUs feed into a segment of length L at height H)
- Quantity formulas (how many sheets per bay, how many posts per run, etc.)
- Warning/optional/suggested rules
- Cut-list generation

**Three tiers** (this is the most important section of the doc — read carefully):

#### Tier 3a: Reusable rule templates

For systems that share patterns (e.g., QSHS / VS / XPL all share gate compatibility logic and slat-based BOM math), define **rule templates** — parameterised formulas with named placeholders:

```yaml
template: slat_count_per_segment
formula: ceil((segment_width_mm - 2 * post_diameter_mm) / (slat_width_mm + gap_mm))
parameters:
  post_diameter_mm: from products[type=post].diameter
  slat_width_mm: from products[type=slat].width
  gap_mm: from system.default_gap_mm
```

Instances of the template bind concrete data. New systems that match a known pattern get a template binding instead of new code.

#### Tier 3b: Data-driven math (current v3 engine)

For systems with system-specific but expressible math, define rules directly in the product_rules / pricing_rules tables. This is what the current v3 engine already does and should be extended.

```yaml
rule: bay_screw_count
input: bay_width_mm
output_sku: GO-SCREW-50
formula: ceil(bay_width_mm / 600) * 2
taxonomy: auto_add
```

#### Tier 3c: Custom code modules behind a stable interface

For systems with truly unusual logic that resists expression as a formula (e.g., conditional channel-post placement that depends on terrain or a particular supplier's quirky install rule), allow a **per-system code module** with a stable interface:

```typescript
// src/lib/bom/systems/colorbond.ts
export const colorbondRules: SystemRuleModule = {
  systemId: 'colorbond',
  computeBomForSegment(segment, context): BomLine[] { ... },
  computeBomForRun(run, context): BomLine[] { ... },
  computeBomForJob(job, context): BomLine[] { ... },
};
```

A dispatcher at `src/lib/bom/index.ts` routes by `systemId` to the right module. The dispatcher reads the `system` row from the catalogue layer (which declares `rule_strategy: 'template' | 'data' | 'custom_module'` and the relevant binding/template/module name) and applies the right tier.

**Preserving the BOM rule taxonomy:** The existing taxonomy of `auto_add / suggested / optional / warning` is preserved across all three tiers. Every rule, whether template, data, or code, produces line items tagged with one of these taxonomies. UI rendering and customer mode behaviour depend on this taxonomy.

**Why hybrid:** Pure data is too brittle for algorithmic edge cases. Pure code is too inflexible for the scale we want (hundreds of products). The three-tier approach lets simple cases stay declarative and complex cases stay maintainable.

### Layer 4: Pricing & Price Books (data-driven, versioned)

**Responsibilities:**

- Per-supplier, per-SKU pricing
- Quantity breaks
- Trade tier discounts
- Effective dates (when did this price apply?)
- Status lifecycle (draft / reviewed / published / archived)
- Quote-level pinning (which version did this quote use?)

**Schema:**

```sql
CREATE TABLE price_books (
  id uuid PRIMARY KEY,
  supplier_id uuid REFERENCES suppliers(id),
  name text NOT NULL,              -- e.g. "Glass Outlet 2026 Q2 Trade Pricing"
  source_file text,                -- original workbook filename / URL
  effective_from timestamp,
  effective_to timestamp,          -- null = current
  status text CHECK (status IN ('draft','reviewed','published','archived')),
  created_at timestamp DEFAULT now(),
  published_at timestamp,
  published_by uuid REFERENCES users(id),
  metadata jsonb                   -- importer notes, tier mappings, etc.
);

CREATE TABLE price_book_items (
  id uuid PRIMARY KEY,
  price_book_id uuid REFERENCES price_books(id),
  sku text NOT NULL,
  tier_code text,                  -- e.g. 'trade_1', 'trade_2', 'rrp'
  min_quantity int DEFAULT 1,
  price_cents int NOT NULL,
  currency text DEFAULT 'AUD',
  UNIQUE(price_book_id, sku, tier_code, min_quantity)
);

ALTER TABLE quotes ADD COLUMN price_book_version_id uuid REFERENCES price_books(id);
```

**Quote pinning:** When a quote is saved, the `price_book_version_id` of the active published book is captured. Recalculating an old quote uses the pinned version. This means a quote sent in March doesn't silently change in May when the supplier issues a new price list.

**Why separate from catalogue:** Catalogue changes infrequently (a supplier adds a new SKU or discontinues an old one a few times a year). Pricing changes frequently (weekly is normal for some suppliers). They need different update cadences, different review workflows, and different ownership.

### Layer 5: Visibility & Access (data-driven, first-class)

**Responsibilities:**

- Which suppliers does this user / organisation see?
- Which systems are visible to which customer group?
- Which products are active / hidden / draft / discontinued / internal-only?
- Which products are available in which region (depot-based)?

**Schema:**

```sql
CREATE TABLE supplier_visibility (
  id uuid PRIMARY KEY,
  supplier_id uuid REFERENCES suppliers(id),
  scope_type text CHECK (scope_type IN ('global','org','user','customer_group','region')),
  scope_id text,                   -- null for global, org_id for org, etc.
  visible boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE system_visibility (
  -- analogous to supplier_visibility
);

CREATE TABLE product_visibility (
  -- analogous to supplier_visibility
);

-- Product-level status flag (separate concern from visibility)
ALTER TABLE products ADD COLUMN status text
  CHECK (status IN ('active','hidden','draft','discontinued','internal_only'))
  DEFAULT 'active';
```

**Resolution:** Backend resolves visibility at query time. The frontend asks "what systems can this user see?" and the backend returns the filtered list. The frontend never carries `if user.org === X` logic.

**Why first-class:** B2B platforms inevitably need scoping. Glass Outlet is the obvious example today, but the moment a second supplier signs on, you need "show ColorBond only to customers who have agreed to ColorBond pricing terms." This is impossible without a visibility layer and painful to retrofit later.

---

## What Stays Hardcoded (explicit list)

These belong in code and should never become data:

- Authentication, session, RLS policies
- Canvas / layout / drawing behaviour
- Canonical payload shape (TypeScript types + Zod)
- Generic form renderer (`SchemaDrivenForm.tsx`)
- Generic BOM table component
- Quote workflow and lifecycle
- PDF generation layout (template structure; per-row content is data)
- CSV export layout
- Save / load quote mechanics
- Rule evaluator engine (the dispatcher + template runner; the rules themselves are data)
- Import pipeline code (the staging-and-diff machinery; the data flowing through it is data)
- Regression tests
- Stable calculator APIs (`canonicalAdapter.ts` signatures, `canvasEngine.ts` public types)

## What Moves Into Data (explicit list)

These belong in Supabase / seed files and should never be hardcoded:

- Supplier names and metadata
- Systems and product families
- Products / SKUs / components
- Colours, finishes, profiles
- Heights, widths, slat sizes, gap presets, post types
- Accessories
- Component diagrams / installation guides / spec sheets
- BOM rules (as templates, data-driven math, or pointers to code modules — but the routing is data)
- Compatibility relationships (which gate works with which system)
- Warnings, install notes, suggested upgrades
- Product availability per region / depot
- Pricing (all of it — base, tiered, quantity-broken, regional)
- Price book history
- Supplier / system / product visibility rules
- Capability flags (see below)

---

## Catalogue Schema (full)

### Core tables

```sql
CREATE TABLE suppliers (
  id uuid PRIMARY KEY,
  slug text UNIQUE NOT NULL,        -- e.g. 'glass-outlet'
  name text NOT NULL,
  logo_url text,
  brand_color text,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE TABLE systems (
  id uuid PRIMARY KEY,
  supplier_id uuid REFERENCES suppliers(id),
  slug text NOT NULL,               -- e.g. 'quickscreen-horizontal-slat'
  name text NOT NULL,
  family text NOT NULL,             -- 'slat-based', 'panel-based', 'mesh', 'glass'
  rule_strategy text CHECK (rule_strategy IN ('template','data','custom_module')),
  rule_binding text,                -- template name, ruleset id, or module id
  description text,
  metadata jsonb,
  status text DEFAULT 'active',
  UNIQUE(supplier_id, slug)
);

CREATE TABLE product_families (
  id uuid PRIMARY KEY,
  system_id uuid REFERENCES systems(id),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  metadata jsonb
);

CREATE TABLE products (
  id uuid PRIMARY KEY,
  product_family_id uuid REFERENCES product_families(id),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  type text,                        -- 'slat', 'post', 'rail', 'screw', 'gate', etc.
  status text DEFAULT 'active',
  metadata jsonb,                   -- dimensions, weight, etc.
  created_at timestamp DEFAULT now()
);

CREATE TABLE product_options (
  id uuid PRIMARY KEY,
  product_id uuid REFERENCES products(id),
  option_type text NOT NULL,        -- 'colour', 'finish', 'profile', 'height'
  value text NOT NULL,
  display_order int DEFAULT 0,
  metadata jsonb
);

CREATE TABLE compatibility (
  id uuid PRIMARY KEY,
  parent_product_id uuid REFERENCES products(id),
  child_product_id uuid REFERENCES products(id),
  relation text NOT NULL,           -- 'requires', 'compatible_with', 'replaces'
  metadata jsonb
);

CREATE TABLE documents (
  id uuid PRIMARY KEY,
  system_id uuid REFERENCES systems(id),
  product_id uuid REFERENCES products(id),
  doc_type text,                    -- 'install_guide', 'spec_sheet', 'warranty', 'diagram'
  url text NOT NULL,
  metadata jsonb
);
```

### Capability flags (next section)

The above plus capability flags (see Capability Model section) form the full catalogue schema.

---

## Capability Model

Per-system and per-product capability flags so the UI knows what to render without hardcoding:

```sql
CREATE TABLE system_capabilities (
  system_id uuid REFERENCES systems(id) PRIMARY KEY,
  supports_gates boolean DEFAULT true,
  supports_canvas boolean DEFAULT true,
  supports_voice_input boolean DEFAULT true,
  has_install_diagram boolean DEFAULT false,
  uses_colourbond_profiles boolean DEFAULT false,
  requires_cut_list boolean DEFAULT false,
  requires_height_picker boolean DEFAULT true,
  uses_slat_calculator boolean DEFAULT false,
  metadata jsonb
);

CREATE TABLE product_capabilities (
  product_id uuid REFERENCES products(id) PRIMARY KEY,
  has_diagram boolean DEFAULT false,
  has_install_video boolean DEFAULT false,
  is_consumable boolean DEFAULT false,
  metadata jsonb
);
```

The UI reads capability flags to decide which form sections, calculator modes, and product pickers to surface. New capabilities can be added by inserting a column (schema migration) — UI then enables them via data flag, not code branch.

---

## Visibility & Access Schema

(Already shown above in Layer 5.)

**Resolution at query time:**

```typescript
// Conceptual: backend resolves what the user sees
async function listVisibleSystems(userId: string): Promise<System[]> {
  const userOrg = await getOrgForUser(userId);
  return supabase.rpc('list_visible_systems', { user_id: userId, org_id: userOrg });
}
```

The RPC function applies all visibility rules in order of specificity (user > org > customer_group > region > global default). No frontend `if` statements.

---

## Pricing & Price-Book Schema

(Already shown above in Layer 4.)

**Effective price lookup at quote time:**

```sql
-- Pseudocode for the lookup
SELECT pbi.price_cents
FROM price_book_items pbi
JOIN price_books pb ON pb.id = pbi.price_book_id
WHERE pb.supplier_id = $supplier_id
  AND pbi.sku = $sku
  AND pbi.tier_code = $user_tier
  AND pb.status = 'published'
  AND pb.effective_from <= now()
  AND (pb.effective_to IS NULL OR pb.effective_to > now())
  AND pbi.min_quantity <= $quantity
ORDER BY pbi.min_quantity DESC
LIMIT 1;
```

The active published book for the supplier at the moment of quote creation is the pinned version (stored on the quote row).

---

## Three-Tier Rule Storage (deep dive)

### When to use each tier

| Situation | Tier | Example |
|---|---|---|
| New system uses a known calculation pattern | **Template (3a)** | QSHS, VS, XPL all share slat-counting logic — define one template, bind three instances |
| System has unique but expressible math | **Data (3b)** | A supplier's specific bay-screw count formula |
| System has algorithmic logic that resists data expression | **Custom module (3c)** | ColorBond's panel placement with terrain-dependent fasteners |

### Template format (proposed)

Templates live in `src/lib/bom/templates/` as TypeScript files (so they get type-checking and tooling), but they are **declarative** — they describe formulas, not procedures.

```typescript
// src/lib/bom/templates/slat-counting.ts
export const slatCountingTemplate: RuleTemplate = {
  id: 'slat_counting_v1',
  describes: 'Slat count per segment for slat-based systems',
  inputs: {
    segment_width_mm: 'number',
    post_diameter_mm: 'number from products[type=post].diameter',
    slat_width_mm: 'number from products[type=slat].width',
    gap_mm: 'number from system.default_gap_mm',
  },
  formula: 'ceil((segment_width_mm - 2 * post_diameter_mm) / (slat_width_mm + gap_mm))',
  output: { sku: 'from products[type=slat].sku', taxonomy: 'auto_add' },
};
```

Catalogue rows bind templates:

```sql
INSERT INTO system_rule_bindings (system_id, template_id, parameter_overrides)
VALUES ('uuid_for_qshs', 'slat_counting_v1', '{"gap_mm": 12}');
```

### Custom module interface

```typescript
// src/lib/bom/index.ts
import { SystemRuleModule } from './types';
import { colorbondRules } from './systems/colorbond';
import { qshsRules } from './systems/qshs';
// etc.

const moduleRegistry: Record<string, SystemRuleModule> = {
  colorbond: colorbondRules,
  qshs: qshsRules,
  // ...
};

export function computeBom(canonical: CanonicalForm, context: Context): BomResult {
  const system = lookupSystem(canonical.systemId);
  switch (system.rule_strategy) {
    case 'template': return computeFromTemplate(canonical, system, context);
    case 'data':     return computeFromDataRules(canonical, system, context);
    case 'custom_module': return moduleRegistry[system.rule_binding].computeBomForJob(canonical, context);
  }
}
```

### Preserving the BOM rule taxonomy

Every rule output, regardless of tier, produces a `BomLine` tagged with one of:

- `auto_add` — added without prompting
- `suggested` — added by default but user can remove
- `optional` — not added by default, surfaced as a recommendation
- `warning` — not added, but flagged as something the installer should think about

This taxonomy is **not** going to change. UI components, customer mode logic, and PDF formatting all depend on it. Templates and data rules and custom modules all emit `BomLine` with `taxonomy: ...`.

### Where `localBomCalculator.ts` fits

`localBomCalculator.ts` becomes the **template + data rule runner**. Custom modules are imported and dispatched. The public function signature stays unchanged (`computeBom(canonical) → BomResult`). The internals refactor to dispatch through the new system, but the regression test suite (`localBomCalculator.test.ts`) continues to pass unchanged because the function signature and behaviour for existing Glass Outlet inputs is identical.

This is the protection strategy — the file evolves internally while the contract stays stable.

---

## Import & Review Pipeline

The pipeline that takes a supplier's update (workbook, CSV, PDF) and turns it into a published catalogue + price book.

### Stages

1. **Source** — supplier sends a workbook, CSV, or PDF. **The workbook is the trust anchor.** Excel formulas are pre-validated against real jobs before being entered into staging. This is established practice and must be preserved.
2. **Parse** — automated parser extracts rows into staging tables (`staging_products`, `staging_prices`). Parser is per-source-format (one for Glass Outlet's workbook, one for ColorBond's CSV, etc.).
3. **Map** — staging rows are mapped to canonical SKUs / products. Unmapped rows surface as "needs review" for human resolution.
4. **Diff** — staged catalogue is diffed against the currently published one: new SKUs, changed prices, removed items, changed metadata. Diff view is the human review surface.
5. **Approve** — human (Liam today; supplier in phase two) approves the diff. Each item can be approved/rejected individually.
6. **Publish** — a new price book row is created with `status = 'published'`, old published book moves to `archived` (but stays accessible for historical quote lookups). Catalogue changes are applied. Quotes created from this moment forward pin to the new book.

### Self-serve path (phase two)

The schema and APIs support self-serve from day one. The phase-two work is just the supplier-facing UI:

- Supplier logs in to their portal
- Uploads workbook
- Sees their own staging diff
- Submits for SkyBrookAI review (or auto-publishes within their scope, depending on trust tier)

### Workbook-as-source-of-truth

The pipeline never lets supplier uploads write straight into live catalogue / pricing tables. All updates flow through staging → diff → review → publish. This is non-negotiable.

---

## QA & Readiness Dashboard

Each system tracks its own lifecycle state so the team knows what is shippable:

```sql
ALTER TABLE systems ADD COLUMN readiness_status text
  CHECK (readiness_status IN (
    'draft',                  -- created, not ready
    'imported',               -- catalogue data loaded, not yet calculator-ready
    'calculator_ready',       -- BOM rules wired up, tested in isolation
    'price_checked',          -- price book validated against supplier workbook
    'spreadsheet_tested',     -- BOM output cross-checked against Excel for sample jobs
    'approved'                -- ready for tradies to use in production
  ))
  DEFAULT 'draft';

ALTER TABLE systems ADD COLUMN readiness_notes text;
ALTER TABLE systems ADD COLUMN approved_by uuid REFERENCES users(id);
ALTER TABLE systems ADD COLUMN approved_at timestamp;
```

Surface this in an internal admin dashboard. Systems below `approved` are not shown to tradies (except admins in test mode).

---

## Migration Sequence (9 steps → Codex briefs)

Each step maps to one or more Codex briefs that respect strict dependencies and protected files.

| Step | Brief # (proposed) | Depends on | Touches |
|---|---|---|---|
| 1. Architecture audit doc | (this document) | — | docs only |
| 2. Catalogue model schema | 030 | this doc merged | new migrations, new types, no UI |
| 3. Price-book versioning | 031 | 030 merged | new migrations, quotes table change, no UI |
| 4. Visibility model | 032 | 030 merged | new migrations, no UI |
| 5. Capability model | 033 | 030 merged | new migrations, no UI |
| 6. Rule template runner | 034 | 030 + 033 merged | new code in `src/lib/bom/templates/`, dispatcher in `src/lib/bom/index.ts`, no change to `localBomCalculator.ts` public signature |
| 7. Retire hardcoded option rules | 035-040 (one per system) | 034 merged | `productOptionRules.ts` shrinks per brief, replaced by data + templates |
| 8. Admin import / review MVP | 041 | 030 + 031 merged | new admin routes, new staging tables, no impact on calculator |
| 9. QA readiness dashboard | 042 | 030 merged | new admin route, schema change to `systems` table |

### Hard rules

- Every brief PR must pass `localBomCalculator.test.ts` **unchanged**
- No brief modifies `localBomCalculator.ts` internals until step 6 (rule template runner), and even then only as a dispatcher addition, not a behavioural change
- No two briefs touching the same file are in flight simultaneously
- Briefs 030-033 are pure schema; they can ship in parallel after 030 lands
- Brief 034 is the first one that touches code paths the calculator reads from, so a bigger fix-up budget is warranted
- **PR base branch is `main`** (this repo's default), not `master` (which was the original `skybrook-tech` repo's default)

### Where catalogue data comes from for the first wave

`docs/catalogue-gap-analysis.md` enumerates the existing SKU and rule gaps across QSHS, XPL, QS_GATE, BAYG, plus the upcoming sliding gate system and Alumawall. After brief 030 deploys the schema, the data wave that populates the new catalogue tables is driven by that gap analysis. The `catalogues/` directory holds the source-of-truth PDFs and text extractions feeding it. ColorBond catalogue extraction (`docs/colorbond-catalogue-extraction.md`) provides the first non-Glass-Outlet system.

---

## Protecting `localBomCalculator.ts` Through the Migration

This file is the BOM regression guard. The strategy:

**Phase 1 (briefs 030-033):** No changes. The file continues to consume canonical form and produce BOM output exactly as today.

**Phase 2 (brief 034):** Internal refactor only. Public function signature stays identical. The internal implementation grows a dispatcher that calls into the new template runner for systems flagged `rule_strategy = 'template'`. For systems still flagged `data` (default), behaviour is unchanged — same code path as today. The test suite passes unchanged because the test inputs are existing Glass Outlet systems on the `data` path.

**Phase 3 (briefs 035-040):** As individual systems migrate to `template` rule_strategy (or new systems are added with `custom_module`), the dispatcher routes them differently. The data path for existing systems remains until they are explicitly migrated. The test suite continues to pass unchanged because the original Glass Outlet behaviour is preserved bit-for-bit.

**Phase 4 (future):** Once all systems have migrated off the `data` path, the legacy code in `localBomCalculator.ts` can be deleted. But this is a years-out cleanup, not an immediate concern.

**Guarantee:** At no point does `localBomCalculator.test.ts` need to change. The regression guard remains intact.

---

## Open Decisions

### Server-side vs client-side BOM calculation — ALREADY DECIDED

This is **not open**. `docs/calculator-architecture-tradeoffs.md` already chose **Approach A — server-side BOM via the `bom-calculator` Supabase Edge function with Postgres-driven seeds** as the canonical production path. Client-side calculation (`localBomCalculator.ts` and friends) is explicitly **non-authoritative** — it remains in the codebase as a sandbox / offline-estimate path, but real quotes always go through the edge function.

This architecture is **fully consistent with that decision**. The three-tier rule storage (templates / data / custom modules) lives server-side. The dispatcher described in this doc runs inside the edge function. Templates and data rules are interpreted server-side against the active price book. Custom code modules are also server-side TypeScript imported by the edge function.

**Implication for design:** Module interfaces and template runners must be pure functions (no DOM, no `window`, no React imports inside rule code). This was already a requirement of Approach A and is reaffirmed here.

**Local `localBomCalculator.ts` status:** The protection strategy in this doc (signature stable, test suite passes unchanged) still applies — it remains the regression guard for the canonical-form contract and the offline-estimate path. But the server engine is the authoritative one going forward.

### Multi-tenancy model

**Current state:** Effectively single-tenant — Glass Outlet's data is the only data.

**Future:** Multi-tenant SkyBrookAI with many suppliers and many tradie organisations.

**Decision:** Defer the full multi-tenancy migration. But every new table designed in this architecture includes scope-aware columns (`supplier_id`, `org_id` where relevant) and RLS policies are stubbed in.

### Self-serve supplier portal

**Phase one:** Admin-managed. Liam approves all updates.

**Phase two:** Self-serve with tiered trust. Suppliers can submit their own updates; high-trust suppliers can publish within their scope without review.

**Decision:** Build the data model to support self-serve from day one. UI ships in phase two.

---

## Appendix A: Mapping to Codex Brief Queue

The 9-step migration becomes ~13 Codex briefs (some steps split into multiple briefs to respect file-overlap rules). See the "Migration Sequence" section for the table.

**First brief (030 — Catalogue Model):** Adds the catalogue schema as a Supabase migration plus TypeScript types. No UI changes, no calculator changes, no impact on production. Glass Outlet's existing data continues to flow through unchanged. The new tables exist but are not yet populated. Subsequent briefs populate them.

This brief is drafted alongside this architecture document — see `_briefs/00-inbox/030-catalogue-model.md`.

---

## Appendix B: Glossary

- **Catalogue layer** — the data describing what products and systems exist
- **Rule engine** — the system that computes a BOM from a canonical form
- **Price book** — a versioned snapshot of pricing for a supplier
- **Capability flag** — a boolean on a system or product describing what features it supports
- **Visibility rule** — a row controlling who can see what
- **Workbook** — the supplier's Excel source-of-truth file
- **Staging** — the area where incoming supplier data lives before being approved
- **Quote pinning** — a quote remembering which price book version it was calculated against

---

## Appendix C: Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-26 | Adopt "catalogue platform with calculator on top" framing | Developer's mindset shift; supports scaling to hundreds of products |
| 2026-05-26 | 5-layer model | Synthesised across three architectural opinions in thread |
| 2026-05-26 | Three-tier rule storage | Avoids both "all code" and "all data" extremes |
| 2026-05-26 | Versioned price books with quote pinning | Historical quote integrity |
| 2026-05-26 | Capability flags on systems & products | UI knows what to render without hardcoding |
| 2026-05-26 | First-class visibility tables | B2B scoping; multi-supplier readiness |
| 2026-05-26 | Admin-first then self-serve, data model supports both | User decision in Hyperagent thread |
| (pre-existing) | Server-side BOM is canonical (Approach A) | Per `docs/calculator-architecture-tradeoffs.md` — not re-decided here |
| 2026-05-26 | New repo `quickscreen-colorbond-generator` (fork of `quickscreen-bom-generator`) | Liam's call — clean slate for the multi-supplier rollout; default branch `main` |
| 2026-05-26 | `localBomCalculator.ts` evolves internally, signature stable | Preserves regression guard; remains the offline-estimate path |
| 2026-06-08 | Brief 034 - Layer 4 Versioned Price Books & Pinning | Edge function and SQL resolver migrated to one-shot DB price book lookup with legacy fallback |

---

*This document is the canonical reference. Every future Codex brief in this project should cite the relevant section. Updates land here first, then propagate to briefs.*