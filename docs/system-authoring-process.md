# System Authoring — How Products and System Types Get Added

> Companion document to `docs/multi-supplier-platform-architecture.md`. Defines the process for introducing new products and system types. Used by Liam today as an admin; designed to extend to end-users (tradies authoring their own calculators) in phase two.

**Status:** Draft v1
**Last updated:** 2026-05-27
**Repo:** `github.com/skybrookai-atlas/quickscreen-colorbond-generator`
**Source of strategic decision:** Liam, Hyperagent thread 2026-05-27 — "make the system versatile so users can pick their own suppliers and system types... if we make it easy for users to build their own systems then we won't have to do it all and they can do it themselves and we can distribute the app much cheaper."

---

## 1. Strategic Direction

This document encodes a deliberate strategic shift in how the platform scales:

**From:** SkyBrookAI hand-builds a calculator for every supplier × system combination.
**To:** SkyBrookAI builds the calculator-building machinery; anyone (Liam, suppliers, tradies) builds calculators on top.

The implication: instead of every new supplier being a 1-4 week build for the SkyBrookAI team, a new supplier is hours of self-service authoring by the person who actually knows that supplier's products. The platform scales without SkyBrookAI being the bottleneck.

The tradeoffs (real, addressable):

- **Quality control** — user-authored calculators can be wrong. Need explicit readiness states, workbook regression gates, and visibility tiers so untested calculators don't blow up real quotes.
- **Liability** — if a tradie self-authors a calculator that under-quotes a job, who pays? Need clear T&Cs, "untested" warnings on draft calculators, and audit trail on every quote (which calculator version, which price book version).
- **Curation** — a public marketplace of calculators fills with junk fast. Two paths: light-touch (auto-publish, take-down on report) or active gatekeeping (verified-supplier route only). Recommendation: start with active gatekeeping, loosen later.
- **Pricing isolation** — a user-authored calculator runs on the user's own price book, which is commercially sensitive. The calculator structure can be shared publicly; the prices cannot. Visibility model treats these separately.

---

## 2. The Three-Tier Identity Model

Every product, component, rule, and selector in the platform carries three identity attributes. This is the most important architectural addition.

### 2.1 Supplier

**Who makes the products.** Lightweight entity: name, slug, logo, brand colour, contact, trust tier.

Examples today: Glass Outlet. Examples coming: ColorBond / Bluescope, Stratco, Stoddart, Whites, Bunnings (depot pricing), individual tradies' preferred local suppliers.

### 2.2 System Archetype

**The abstract pattern.** Shared across suppliers. Defines geometry, UI form schema, and rule template library.

Examples (the controlled vocabulary):

| Archetype | Family | Geometry | Examples in market |
|---|---|---|---|
| `slat-fence` | fence | runs / segments / posts / slats | Glass Outlet QSHS, ColorBond Slatted, any horizontal-slat aluminium fence |
| `panel-fence` | fence | runs / segments / posts / panels | ColorBond Steel Fence, Trimdek, Stratco Smartspan |
| `mesh-fence` | fence | runs / panels / posts | Chainwire, weldmesh, ProtectaScreen |
| `timber-fence` | fence | runs / panels / posts / rails / palings | Hardwood paling, treated pine lap-and-cap |
| `glass-pool-fence` | pool-fence | panels / spigots / gates / clamps | Frameless glass pool fencing |
| `aluminium-pool-fence` | pool-fence | panels / posts / gates | Trojan aluminium pool fence |
| `balustrade` | balustrade | runs / panels / posts / handrail | Frameless glass, semi-frameless, aluminium |
| `sliding-gate` | gate | gate / track / motor / hardware | QSG sliding, CTS Hamptons, Stratco sliding |
| `swing-gate` | gate | gate / hinges / latch | QS Gate swing, custom timber, ColorBond gate |
| `equipment-enclosure` | enclosure | walls / roof / doors / ventilation | CTS equipment enclosures |
| `screen` | screen | panels / posts / fixings | Privacy screens, decorative screens |
| `shower` | shower | screens / channels / doors / hinges | Frameless glass showers |

This list is extensible. New archetypes are added as new product categories show up. **An archetype is added when no existing one fits;** instances of an existing archetype don't trigger a new one.

### 2.3 System Instance

**The supplier-specific implementation.** What users actually pick in the calculator picker.

Example: "Glass Outlet QuickScreen Horizontal Slat" is the instance — supplier `glass-outlet`, archetype `slat-fence`. "ColorBond Slatted by Bluescope" would be a different instance — supplier `bluescope`, archetype `slat-fence` (same archetype, different supplier).

### 2.4 Why this matters in concrete terms

- **Cross-supplier swap, same UI.** A user who switches from Glass Outlet's slat fence to a competitor's slat fence sees the same form fields, same canvas, same BOM categorisation — because they're the same archetype. Only the SKUs and rule details differ.
- **Rule templates are archetype-scoped, not supplier-scoped.** The `slat_counting_v1` rule template lives at the archetype layer. A new supplier's slat fence inherits all the archetype's templates by selecting the archetype — the new supplier only fills in their parameter values.
- **Onboarding gets simple.** "Which archetypes do you work with?" → "Which suppliers within each?" The cross-product is the user's calculator universe.
- **Pricing stays per supplier.** Same archetype across suppliers, different price books per supplier. Users can compare BOM costs across suppliers for the same job (a feature unlocked by this model).

---

## 3. Authoring Workflow

Same machinery for admin (Liam) and user (tradies). Only the trust tier and visibility defaults differ.

### Step 1: Choose / create the archetype

**Existing archetype:** pick from the controlled vocabulary above.
**New archetype:** triggers a deeper process — see Section 6 ("Adding a new archetype").

### Step 2: Declare the system instance

Form fields:
- Supplier — existing or create new (suppliers are lightweight)
- Archetype — locked to choice from Step 1
- Instance name — e.g. "ColorBond Slatted Fence", "Trojan Aluminium Pool"
- Slug — auto-generated, editable
- Description — one-paragraph, surfaces in calculator picker
- Initial readiness status — `draft`
- Visibility — `private` by default

### Step 3: Add products / SKUs

Form-driven entry per product. For each:
- SKU
- Display name
- Type — controlled vocab per archetype (slat / post / rail / panel / sheet / screw / gate / bracket / accessory)
- Dimensions — height / width / thickness / stock length (per type)
- Option types — colour, profile, finish, height variant — each with its own option values
- Status — `active` by default
- Optional: image URL, install diagram, spec sheet URL

**Bulk import path** for high-volume catalogues:
1. Upload CSV or workbook
2. Parser maps rows to staging table (per supplier-format)
3. Diff view: new SKUs / changed SKUs / removed SKUs / unmapped rows
4. Reviewer approves item-by-item
5. Commit to live catalogue

### Step 4: Add rules

Three tiers:

**Tier A — Template binding (preferred).** Pick a rule template from the archetype's library. Fill in parameters.

```
Template: slat_counting_v1
Parameter bindings:
  segment_width_mm: variable
  post_diameter_mm: products[type=post].diameter
  slat_width_mm: products[type=slat].width
  gap_mm: 12  ← supplier-specific
```

**Tier B — Data-driven math.** Direct entry in the v3 engine format — math.js expression + selector match. For rules that don't match any template but are still expressible as a formula.

```
Stage: derive
Expression: ceil(bay_width_mm / 600) * 2
Output: qty_screw_50
Selector match: {sku_pattern: "GO-SCREW-50-{colour}"}
Taxonomy: auto_add
```

**Tier C — Custom code module.** TypeScript module behind a stable interface. Reserved for genuinely algorithmic rules that don't express well as data (e.g. terrain-dependent panel placement, compliance edge cases). **End users cannot self-author code modules** — Tier C is a platform-team-only path that requires a code PR and admin approval.

Every rule output, regardless of tier, carries the taxonomy: `auto_add | suggested | optional | warning`.

### Step 5: Workbook regression check

Upload the supplier's formulated workbook (Excel) or known job examples. Pick 3-5 representative configurations covering the typical range — small / standard / large / edge case / with-gate.

For each configuration:
1. Enter the inputs in the calculator
2. Run the BOM
3. Diff line-by-line against the workbook's expected output
4. Mismatches → fix the seed; iterate

Until ALL configurations match, readiness status stays at `calculator_ready`. Passing all → `spreadsheet_tested`. Admin sign-off → `approved`.

### Step 6: Visibility

Choose one:
- **Private** — visible only to authoring user / org
- **Org-shared** — visible to specific other organisations (B2B agreements)
- **Public (community)** — visible to all users; enters moderation queue unless author has verified-supplier status

### Step 7: Submit / publish

- **Admin path** (Liam): instance moves to `approved` immediately on his say-so.
- **User path** (tradie): instance is auto-approved within their own scope. Public-visibility requests enter a moderation queue; verified-supplier authorship earns auto-approval.

---

## 4. Trust & Moderation Tiers

Four trust tiers carried on `suppliers` and `system_instances`:

| Tier | Who | Authoring | Visibility default | Quality signal |
|---|---|---|---|---|
| `platform` | SkyBrookAI's own catalogues | Liam / SkyBrookAI staff | Public, prominent | "Built by SkyBrookAI" badge |
| `verified` | Suppliers who've passed verification (real business, validated catalogue, signed T&Cs) | Supplier's own admin user | Public, prominent | "Verified supplier" badge |
| `community` | User-authored, opted into public | Any logged-in user | Public, lower prominence | "Community-built" badge with author |
| `user` | User-authored, private | Any logged-in user | Private to user / org | None |

**Promotion paths:**
- `user` → `community`: opt-in, light moderation (calculator passes workbook regression for 3+ configs)
- `community` → `verified`: full supplier verification (business registration, catalogue audit, signed agreement)
- `platform` is reserved for direct SkyBrookAI work

**Demotion:** any tier can be demoted on quality reports (auto-demote `community` items with 3+ "wrong BOM" reports back to `user`).

---

## 5. Schema Additions

All in migrations 032+ to extend (not replace) the existing v3 schema.

### 5.1 New tables

```sql
-- Suppliers: lightweight, growable, can be platform-owned or user-created
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  brand_colour text,
  contact_email text,
  trust_tier text CHECK (trust_tier IN ('platform','verified','community','user')) DEFAULT 'user',
  authored_by uuid REFERENCES profiles(id),
  org_id uuid REFERENCES organisations(id),
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- System archetypes: abstract patterns shared across suppliers
CREATE TABLE system_archetypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  family text NOT NULL CHECK (family IN ('fence','gate','pool-fence','balustrade','screen','enclosure','shower','other')),
  geometry_module text NOT NULL,    -- name of the canvas geometry adapter
  variable_schema jsonb NOT NULL,   -- declarative form-field schema shared by all instances
  rule_template_ids text[],         -- which rule templates apply (template registry keys)
  description text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- System instances: supplier × archetype + supplier-specific config
CREATE TABLE system_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  archetype_id uuid REFERENCES system_archetypes(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  status text CHECK (status IN ('draft','active','hidden','discontinued')) DEFAULT 'draft',
  readiness_status text CHECK (readiness_status IN ('draft','imported','calculator_ready','price_checked','spreadsheet_tested','approved')) DEFAULT 'draft',
  trust_tier text CHECK (trust_tier IN ('platform','verified','community','user')) DEFAULT 'user',
  visibility text CHECK (visibility IN ('private','org_shared','public')) DEFAULT 'private',
  authored_by uuid REFERENCES profiles(id),
  org_id uuid REFERENCES organisations(id),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id, slug)
);

-- Organisation-level access to system instances (B2B sharing)
CREATE TABLE system_instance_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_instance_id uuid REFERENCES system_instances(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(system_instance_id, org_id)
);

-- Quality reports on community-tier content
CREATE TABLE system_instance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_instance_id uuid REFERENCES system_instances(id) ON DELETE CASCADE,
  reported_by uuid REFERENCES profiles(id),
  reason text NOT NULL,
  details text,
  status text CHECK (status IN ('open','reviewing','resolved','dismissed')) DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);
```

### 5.2 Backfill columns on existing tables

```sql
-- Carry supplier + system-instance provenance on every catalogue entity
ALTER TABLE products            ADD COLUMN supplier_id uuid REFERENCES suppliers(id);
ALTER TABLE products            ADD COLUMN system_instance_id uuid REFERENCES system_instances(id);
ALTER TABLE products            ADD COLUMN authored_by uuid REFERENCES profiles(id);

ALTER TABLE product_components  ADD COLUMN supplier_id uuid REFERENCES suppliers(id);
ALTER TABLE product_components  ADD COLUMN system_instance_id uuid REFERENCES system_instances(id);

ALTER TABLE product_variables   ADD COLUMN system_instance_id uuid REFERENCES system_instances(id);
ALTER TABLE product_rules       ADD COLUMN system_instance_id uuid REFERENCES system_instances(id);
ALTER TABLE product_component_selectors ADD COLUMN system_instance_id uuid REFERENCES system_instances(id);
ALTER TABLE product_companion_rules     ADD COLUMN system_instance_id uuid REFERENCES system_instances(id);
ALTER TABLE pricing_rules       ADD COLUMN supplier_id uuid REFERENCES suppliers(id);

-- All new columns nullable initially; backfilled by a data migration
```

### 5.3 Backfill data migration

```sql
-- Create the Glass Outlet supplier row
INSERT INTO suppliers (slug, name, trust_tier) VALUES ('glass-outlet', 'Glass Outlet', 'platform');

-- Create the seven archetype rows (slat-fence, panel-fence, etc.)
-- ... (see Appendix A for full archetype seed)

-- Create system instances for existing seed files
INSERT INTO system_instances (supplier_id, archetype_id, slug, name, readiness_status, trust_tier)
  SELECT s.id, a.id, 'qshs', 'QuickScreen Horizontal Slat', 'approved', 'platform'
  FROM suppliers s, system_archetypes a
  WHERE s.slug = 'glass-outlet' AND a.slug = 'slat-fence';

-- (repeat for vs, xpl, bayg, colorbond, qs-gate-swing, qs-gate-sliding, xpsg-gate)

-- Backfill supplier_id + system_instance_id on existing products
UPDATE products SET supplier_id = (SELECT id FROM suppliers WHERE slug='glass-outlet');
UPDATE products SET system_instance_id = (SELECT id FROM system_instances WHERE slug=<seed_system_type_to_instance_map>);
-- (and equivalently for product_components, product_variables, product_rules, etc.)
```

### 5.4 RLS for user-authored content

```sql
-- Suppliers: see platform-tier + own org + public verified
CREATE POLICY suppliers_visibility ON suppliers FOR SELECT
  USING (
    trust_tier IN ('platform', 'verified')
    OR org_id = auth.org_id()
    OR authored_by = auth.uid()
  );

-- System instances: visibility-aware
CREATE POLICY system_instances_visibility ON system_instances FOR SELECT
  USING (
    visibility = 'public'
    OR (visibility = 'org_shared' AND id IN (
        SELECT system_instance_id FROM system_instance_grants WHERE org_id = auth.org_id()
    ))
    OR org_id = auth.org_id()
    OR authored_by = auth.uid()
  );

-- Writes: only authoring user or admin
CREATE POLICY system_instances_write ON system_instances FOR INSERT
  WITH CHECK (authored_by = auth.uid());
CREATE POLICY system_instances_update ON system_instances FOR UPDATE
  USING (authored_by = auth.uid() OR auth.is_admin());
```

---

## 6. Adding a New Archetype (the deeper process)

Most new systems are new instances of existing archetypes. Occasionally a genuinely new pattern shows up that no archetype fits. Adding a new archetype is a bigger commitment because:

1. **Geometry adapter** — what does a "shower" look like as runs / segments / panels? May need a new canvas geometry module.
2. **Variable schema** — what form fields does this archetype need? May not fit the existing variable types.
3. **Rule template library** — at least 3-5 reusable rule templates need to be designed so future suppliers' instances can bind to them.

Process:
1. Confirm no existing archetype fits.
2. Designer + Liam sketch the new archetype: geometry, form fields, rule templates needed.
3. Build the geometry adapter (code module, behind `canvasEngine.ts` extension).
4. Build the variable schema (data, in `system_archetypes.variable_schema`).
5. Build the initial rule templates (code, in `src/lib/bom/templates/`).
6. Seed the archetype row.
7. Then proceed with Section 3 to add the first instance.

Adding a new archetype is a Codex brief-sized piece of work. Adding an instance under an existing archetype is form-driven authoring.

---

## 7. Adding a New System Today (admin runbook for Liam)

This is the runbook to use right now to add e.g. CTS Hamptons sliding gates, Glass Pool Fencing, etc.

**Step 0:** Identify scope. Is this a new supplier? A new instance under an existing supplier? A new archetype? Most are new instances.

**Step 1:** Gather source material:
- Supplier catalogue PDF (drop in `catalogues/`)
- Price list workbook / CSV
- Installation guide (if applicable)
- 3-5 worked examples of real jobs (Order Form workbooks or known quote PDFs)

**Step 2:** Identify the archetype. Cross-reference Section 2.2 above. If the archetype doesn't exist, see Section 6 first.

**Step 3:** (Today, manual; future, form-driven) Add or extend the seed JSON:
- For an entirely new product file: copy an existing one as a template, swap out the SKUs and rules
- For a new instance under an existing product file (e.g. Hamptons inside `qs_gate.json`): add a new `gate_build` enum value, add the supplier-specific rules guarded by that enum

**Step 4:** Add rules. Prefer template binding from the archetype library. Fall back to data-driven math. Avoid custom code modules unless absolutely needed.

**Step 5:** Workbook regression. Pick 3-5 configurations from the source workbook. Run them through the local calculator. Diff line-by-line. Iterate until matched.

**Step 6:** Set readiness status to `spreadsheet_tested`. Test in production preview.

**Step 7:** Set readiness status to `approved`. Set visibility to `public`.

**Today the form-driven authoring UI doesn't yet exist** — Steps 3 and 4 are manual JSON editing. Briefs 034-036 below build out the form path so this becomes click-driven.

---

## 8. Brief Sequence to Ship This

All briefs use migrations 032+ (030 and 031 already used in this repo).

| # | Title | Depends on | Scope |
|---|---|---|---|
| 032 | Supplier + Archetype + Instance schema | this doc landed | New tables, ALTER TABLE for nullable provenance columns, no UI, no calculator change. `localBomCalculator.test.ts` passes unchanged. |
| 033 | Backfill Glass Outlet supplier + existing instances | 032 merged | Data-only migration. Sets supplier_id + system_instance_id on all existing rows. |
| 034 | Admin UI — Suppliers + Instances CRUD | 033 merged | Form-driven admin pages. Liam can add new suppliers / instances without editing JSON. |
| 035 | Admin UI — Products CRUD + bulk CSV import | 034 merged | Form for individual products, staging-and-diff for CSV. |
| 036 | Admin UI — Rules (template binding + data-driven math entry) | 035 merged | Form for Tier A and Tier B rule entry. No Tier C self-serve. |
| 037 | Workbook regression upload + diff view | 036 merged | Admin uploads workbook + configurations; calculator runs them; diff surfaces. |
| 038 | User-scoped authoring (RLS + org-level visibility) | 034 merged | Logged-in users can author within their own scope. Visibility defaults to `private`. |
| 039 | Community publication path | 038 + 037 merged | User can request public; moderation queue; verified-supplier auto-approve. |
| 040 | Quality reports + demotion automation | 039 merged | Report button on community calculators; auto-demote on threshold. |

This is ~3 months of Codex work if shipped one brief per week. Brief 032-033 are foundational and unblock everything else; should ship first.

---

## 9. Open Strategic Questions for Liam

These are decisions that affect the build but haven't been made:

1. **Pricing visibility for community calculators.** A user shares their slat-fence calculator publicly. The calculator structure is shared, but the user's price book stays private. **Confirm:** community calculators show structure only, never prices? Each user runs the shared calculator against their own price book?

2. **Supplier verification process.** What does "verified supplier" mean concretely? Business registration check? SkyBrookAI staff catalogue audit? Signed T&Cs? Annual recheck? **Recommendation:** start with manual verification by SkyBrookAI; automate later.

3. **Moderation tooling for community content.** Light-touch (auto-publish, take-down on report) or active gatekeeping (verified-supplier-only public route, user calculators stay private)? **Recommendation:** start with active gatekeeping; loosen if community demand grows.

4. **Revenue model implications.** Self-service authoring changes the unit economics. Is the platform free for tradies and paid for verified suppliers? Subscription? Per-quote fee? **Out of scope for this document but the answer affects how aggressively we push the community tier.**

5. **Migration of existing Glass Outlet content.** Glass Outlet's content is currently `platform` tier by default in the schema above. Liam can choose to mark it `verified` instead and treat Glass Outlet as the first verified supplier. Affects future positioning.

---

## Appendix A — Initial Archetype Seed

The first migration includes seed rows for these archetypes (slug, family, geometry_module, rule_template_ids):

```sql
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
    'Aluminium pool fencing — Trojan style.'),
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
    'Frameless / semi-frameless shower screens.');
```

Geometry modules and rule template implementations are referenced by name; the actual code lives in `src/lib/bom/templates/` and `src/components/canvas/`. **Most do not exist yet** — they ship per archetype as that archetype's first instance is built. The seed list is the menu; the implementations are filled in over time.

---

## Appendix B — Example: ColorBond authoring on top of this model

Concretely, how does adding ColorBond Slatted Fence work in this model?

1. **Supplier:** `bluescope` already exists (created when adding ColorBond Steel earlier). Skip Step 1.
2. **Archetype:** `slat-fence` already exists. Skip Step 6 archetype-add process.
3. **Instance:** New row in `system_instances`: supplier=`bluescope`, archetype=`slat-fence`, slug=`colorbond-slatted`, name="ColorBond Slatted Fence", readiness=`draft`.
4. **Products:** Add ColorBond slat SKUs, post SKUs, rail SKUs to `products`, all tagged with `supplier_id = bluescope` and `system_instance_id = colorbond-slatted`.
5. **Rules:** Bind `slat_counting_v1` template with ColorBond's slat dimensions; bind `bay_post_v1` with ColorBond's post spacing; bind `rail_cut_v1` with ColorBond's rail stock lengths.
6. **Workbook regression:** Use `GO+Cat+Xpress+Alumawood+V4_lowres.pdf` examples (or the actual Bluescope ColorBond install guide); pick 3-5 configs; run; diff; iterate.
7. **Publish:** `readiness_status` → `approved`, `visibility` → `public`, `trust_tier` → `verified` (assuming Bluescope is verified).

**Total authoring time at platform maturity:** 2-4 hours for someone who knows the supplier's catalogue. Compared to building a new bespoke calculator codebase, this is 100x faster.

## Decision log

| Date | Decision | Details |
|---|---|---|
| 2026-06-08 | Glass Outlet Backfill & Platform Trust Tier | Backfilled Glass Outlet as the initial supplier with 12 archetypes and 8 system instances. Set the initial trust tier to `platform` for the Glass Outlet systems, which remains the default until demoted via the admin UI. |

---

*This document is the canonical reference for the system authoring process. Updates here propagate to briefs and tooling. Lives at `docs/system-authoring-process.md` in the repo.*