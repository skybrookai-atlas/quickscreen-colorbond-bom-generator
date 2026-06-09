# Seed Data Mapping Spec

> **Self-contained spec for LLMs.** An LLM reading only this document and the referenced JSON Schemas should be able to map source material (CSVs, natural-language briefs, supplier PDFs, XLSX price sheets) into the seed-data JSON shape used by this application's BOM engine.

---

## 1. Purpose & output contract

**What you will produce:** one JSON file per product (e.g. `qshs.json` for QSHS, `qs_gate.json` for the shared QuickScreen gate, `vs.json` for VS, etc.) that, when placed in `supabase/seeds/glass-outlet/products/`, allows the BOM calculation engine to generate correct, priced Bills of Materials for that product.

**Product shape**: every product is top-level (no parent/variant hierarchy). Each `products` row has a `product_type` (`'fence' | 'gate' | 'other'`). Gate products list which fence system_types they pair with via `compatible_with_system_types`. Gates live in their own file and are NOT bundled with fence files — the gate can be compatible with many fences, so it gets its own authoring scope.

**Output format:** a single top-level JSON object keyed by table name. Each section is an array of row objects using **business keys** (e.g. `"product_system_type": "QSHS"`), never raw UUIDs. `org_slug` lives at the file level; do NOT repeat it on individual rows.

**Where the files live:**

```
supabase/seeds/glass-outlet/products/
  qshs.json        # QSHS fence + engine data + QSHS-scoped SKUs/pricing
  vs.json          # VS fence + any VS-scoped SKUs/pricing (no engine yet)
  xpl.json         # XPL fence + SKUs/pricing
  bayg.json        # BAYG fence + SKUs/pricing
  qs_gate.json     # QS_GATE shared gate — engine data + QSG/DD SKUs +
                   # compatible_with_system_types: ['QSHS','VS','XPL','BAYG']
  other.json       # Inactive non-fence families (balustrade, colorbond, …)

supabase/seeds/schemas/
  product-file.schema.json    # wrapper schema (the LLM output contract)
  <table>.schema.json         # per-table item schemas referenced by the wrapper
```

**Shape** (governed by `product-file.schema.json`):

```json
{
  "org_slug": "glass-outlet",
  "products": [ /* products.schema.json array */ ],
  "product_components": [ /* product_components.schema.json array */ ],
  "rule_sets": [ … ],
  "rule_versions": [ … ],
  "product_constraints": [ … ],
  "product_variables": [ … ],
  "product_validations": [ … ],
  "product_rules": [ … ],
  "product_component_selectors": [ … ],
  "product_companion_rules": [ … ],
  "product_warnings": [ … ],
  "pricing_rules": [ … ]
}
```

Only these top-level keys are allowed (`additionalProperties: false` on the file). Do not add `id`, `org_id`, extra sections, or stray metadata keys at the root.

Every section is **optional** — include only the tables your product actually needs rows in. (A catalog-only addition with new SKUs and pricing may have only `product_components` and `pricing_rules`.)

**Strict row objects:** each array item is validated with `additionalProperties: false`. Extra keys on a row (e.g. copying `id`, `product_id`, `rule_set_id` from a CSV) **fail validation**.

### 1a. Common validation failures (read this before generating)

| Mistake | Why it fails |
|--------|----------------|
| Missing `product_type` on a `products` row | Required: `"fence"` \| `"gate"` \| `"other"`. |
| Using `QS_GATE` (or any product code) inside `product_components.system_types` | Each array element must be exactly one of **`QSHS`**, **`VS`**, **`XPL`**, **`BAYG`**, **`GATE`** — this matches Postgres `chk_system_types_values`. Gate SKUs for the `QS_GATE` **product** still use **`"GATE"`** here, not `QS_GATE`. Fence SKUs list the fence code(s) they apply to. |
| Wrong `pricing_rules.tier_code` | Must be literally `tier1`, `tier2`, or `tier3` (not `Tier1` / `retail`). |
| Missing `pricing_rules.active` | Required boolean on each pricing row. |
| Empty string `""` for date fields | `effective_from`, `valid_from`, `valid_to` allow **`null`** or a **`date`** string (`YYYY-MM-DD`). `""` fails `format: date`. Omit the property or use `null`. |
| Invented `product_variables.data_type` | Must be one of: `enum`, `number`, `integer`, `string`, `boolean`. |
| Omitting `selector_type` on selectors | Required: `"exact"` or `"fallback"`. |
| Omitting `trigger_match_json` / `match_json` | Optional — omitting passes Ajv (the fields are not `required`). The upserter applies `match_json ?? {}` and `trigger_match_json ?? {}`. Do **not** emit **`null`** (schema type is `object`, not `null`). JSON Schema `default` in the file is **not** applied by this repo’s Ajv config — rely on omission or `{}`. |
| **`active`** on **`rule_versions`** rows | **`rule_versions` has no `active` column** in Postgres; the item schema does not define `active` — `additionalProperties: false` **rejects** it. Omit entirely. |
| `options_json: null` on `product_variables` | Must be an **array** (use **`[]`** for number/boolean fields with no enum). `null` is not valid. |
| `price: null` on `pricing_rules` | Must be a **number**; use **`0`** for inactive / N.A. rows if you must keep the line. |
| `add_sku_pattern: null` on `product_companion_rules` | Must be a **string**; use **`""`** if you have no pattern (prefer deactivating the row or fixing the SKU). |

A Node script (`supabase/seeds/tools/seed-products.js`) validates every file against `product-file.schema.json`, resolves business-key FKs by looking up Postgres, then upserts each section in dependency order via `@supabase/supabase-js`. Run with `npm run seed:products`. Your job is only to produce a correct JSON file; validation + upsert is automated.

**Gate rule**: gates get their own file (e.g. `qs_gate.json`). A single gate product can pair with multiple fence systems, so tying it to a specific fence file doesn't fit. The gate product declares its compatibility via the `compatible_with_system_types` array on its `products[0]` row.

---

## 2. The domain in one page

This app generates Bills of Materials for **aluminium slat fencing systems** — horizontal slat, vertical slat, clip-in variants, and their matching gates. The BOM engine is fully **data-driven**: a single engine file reads rules from Postgres and produces a priced shopping list for any drawing a user creates on a canvas.

When staff adds a new fencing system (say, "VS vertical slat"), no engine code changes. They just add rows across the twelve tables below. The engine picks up the new product automatically.

**Glossary** — you will see these terms throughout:

- **Run** — a straight span of fence with boundaries on both ends. A job can have many runs.
- **Segment** — a piece inside a run: a panel, a bay group, or a gate opening.
- **Panel** — one straight bay of fence between two posts.
- **Side frame** — vertical member on each side of a panel, running from top rail to bottom rail (or ground).
- **CFC** — a cover strip that hides fasteners on the side frame; exactly one per side frame.
- **CSR** — centre support rail; required in panels ≥ 2000mm wide.
- **F-section** — alternative vertical termination used when a panel meets a wall instead of a post.
- **Spacer** — small block that keeps slats at the correct gap during assembly.
- **Canonical payload** — the JSON document the engine receives describing the whole job (runs, segments, variables). Not the same as seed data — but the engine uses the variable names you declare in `product_variables` as the payload's keys, so stay consistent.
- **Tier** — customer pricing category: `tier1` (highest price, usually retail), `tier2`, `tier3` (lowest, usually trade). Every SKU gets three rows in `pricing_rules`.

---

## 3. Dependency order

When producing or applying seed data, respect this order — each table depends on earlier ones:

1. `products`                       (catalog; flat rows — `product_type` + `system_type`; no variants)
2. `product_components`             (SKU catalog referenced by pricing & selectors)
3. `rule_sets`                      (container per product)
4. `rule_versions`                  (frozen rule snapshot; `is_current=true`)
5. `product_constraints`            (product-scoped; hard bounds)
6. `product_variables`              (product-scoped; field definitions)
7. `product_validations`            (product-scoped; multi-var checks)
8. `product_rules`                  (product + rule_set + version scoped)
9. `product_component_selectors`    (product-scoped)
10. `product_companion_rules`       (product-scoped)
11. `product_warnings`              (product-scoped)
12. `pricing_rules`                 (keyed by `sku`; must match a row in `product_components`)

Within `product_rules`, further respect the `stage` order: `derive` → `stock` → `accessory` → `component`. Variables written in an earlier stage are visible to later stages; not the reverse.

---

## 4. Business keys, not UUIDs

Every foreign key in the JSON is expressed by a **business key**, not a UUID. The upserter resolves these at apply time.

| FK in DB | JSON business key | Resolves via |
|---|---|---|
| `org_id` | file-level `org_slug` | `organisations WHERE slug = ...` |
| `product_id` | `product_system_type` (same as the product’s `system_type`) | `products WHERE system_type = ...` (flat table — one row per product) |
| `rule_set_id` | `rule_set_name` (scoped by the row's `product_system_type`) | `rule_sets WHERE name = ... AND product_id = ...` |
| `version_id` | `version_label` (scoped by the rule set) | `rule_versions WHERE version_label = ... AND rule_set_id = ...` |
| `component_id` (in `pricing_rules`) | `sku` | `product_components WHERE sku = ... AND org_id = ...` |

`parent_system_type` on `products` is **deprecated** — do not set it on new rows (use `null` or omit). There is no parent/variant hierarchy anymore.

Never produce a `{ "product_id": "<uuid>" }`, `{ "org_id": "..." }`, or per-row `org_slug` field. Use the business key; `org_slug` stays at the file root.

**Duplicate handling across files**: the same SKU (e.g. a shared accessory) can be declared in multiple product files. The upserter uses Postgres `ON CONFLICT` upsert semantics — whichever file processes second simply UPDATEs the row. No errors. File processing order is alphabetical.

---

## 5. Cross-cutting patterns

### 5.1 Colour codes

Short codes in seed data:

| Code | Long name |
|---|---|
| B  | black-satin |
| MN | monument-matt |
| G  | woodland-grey-matt (sometimes "woodland-grey") |
| SM | surfmist-matt |
| W  | pearl-white-gloss |
| BS | basalt-satin |
| D  | dune-satin |
| M  | mill |
| P  | primrose |
| PB | paperbark |
| S  | palladium-silver-pearl |

`options_json` in `product_variables` uses these short codes. SKUs that bear a colour embed the short code (e.g. `QS-5800-SF-B` for black). The engine normalises long names to short codes at runtime.

### 5.2 SKU pattern placeholders

`sku_pattern` fields in `product_component_selectors` and `add_sku_pattern` in `product_companion_rules` may include placeholders that the engine resolves at BOM-run time:

| Placeholder | Resolves from |
|---|---|
| `{colour}` | `colour_code` variable (short code) |
| `{finish}` | `finish` variable |
| `{frame_cap_size}` | `frame_cap_size` variable |
| `{selected_hinge_sku}` | Looked up by `hinge_type` value via a built-in hinge map (rare — only in the gate companion rules) |
| `{selected_latch_sku}` | Same pattern for `latch_type` |

Placeholders not resolved against a known variable remain literal — so don't invent new ones; extend the engine first if you need a new dimension.

### 5.3 math.js expression language

The engine evaluates strings in `expression` (product_rules / product_validations) and `qty_formula` (product_companion_rules) using **math.js**. Available:

- Arithmetic: `+ - * / ^`, parentheses
- Functions: `floor(x)`, `ceil(x)`, `round(x)`, `abs(x)`, `max(a,b)`, `min(a,b)`
- Array helpers: `[1,2,3].includes(x)`
- Logic: `&&`, `||`, `!`, `==`, `!=`, `<`, `>`, `<=`, `>=`
- Ternary: `cond ? a : b`
- Custom helper: **`stocks(cutsNeeded, stockLen, cutLen)`** — returns the number of
  stock lengths needed. Handles zero and NaN gracefully. Replaces the
  `X_cuts_per_stock + X_stocks` rule pair pattern. Example:
  `stocks(num_slats, 6100, slat_cut_length_mm)` → integer stock count.

Variables available to an expression come from (in merging order):

1. Job-level variables (from the canonical payload's `variables`).
2. Run-level variables (payload's `runs[i].variables`).
3. Segment-level variables (payload's `runs[i].segments[j].variables`).
4. Derived variables set by previous `stage`s: `derive` → `stock` → `accessory` → `component`.
5. Layout helpers injected by the engine: geometry primitives computed from
   segment terminations — `num_panels`, `panel_width_mm`, `num_posts`,
   `system_termination_count`, `non_system_termination_count`,
   `non_system_wall_count`, `corner_count`; universal boolean flags
   `left_is_system`, `right_is_system`, `left_is_wall`, `right_is_wall`,
   `left_is_non_system`, `right_is_non_system`, `left_is_join`, `right_is_join`,
   `left_is_corner`, `right_is_corner`; angle values `left_angle_deg`,
   `right_angle_deg`; stock lengths `slat_stock_length_mm`,
   `side_frame_stock_length_mm`; and segment dimensions `segment_width_mm`,
   `target_height_mm`. **Do not write product_rules for any of these.**
   Also available: `stocks(cutsNeeded, stockLen, cutLen)` math.js helper (see §6.8).

When in doubt, read existing `product_rules` rows in `supabase/seeds/glass-outlet/products/qshs.json` (or your target product file) to see what variables rules reference.

### 5.4 JSONB field shapes

Six places you'll emit JSON objects or arrays as JSONB cells:

| Field | Shape | Example |
|---|---|---|
| `products.metadata` | free-form | `{ "product_family": "gate", "allowedAngles": [90,135,180] }` |
| `product_constraints.applies_when_json` | predicate object, empty = always | `{ "system_type": "XPL" }` |
| `product_variables.default_value_json` | bare JSON value | `65`, `"B"`, `["a","b"]`, `null` |
| `product_variables.options_json` | array of allowed values | `[65, 90]`, `["B","MN","G"]` |
| `product_component_selectors.match_json` | predicate object | `{ "slat_size_mm": 65, "finish_family": "standard" }` |
| `product_companion_rules.trigger_match_json` | predicate object | `{ "slat_gap_mm": 5 }` |
| `product_warnings.condition_json` | predicate with comparison ops | `{ "panel_width_mm": { "gt": 2600 } }` |

**Predicate shorthand for `condition_json`**: keys can hold either a bare value (meaning equality) or an object of comparison operators (`gt`, `gte`, `lt`, `lte`, `eq`, `neq`). The engine supports this shorthand today.

### 5.5 Variable scope

`product_variables.scope` must be one of:

- `job` — set once at the top level, applies to every run and segment (e.g. `colour_code`, `slat_size_mm`)
- `run` — set per run (e.g. `mounting_type`, `hinge_type`, `latch_type`)
- `segment` — set per segment (e.g. `panel_width_mm`, `target_height_mm`, `gate_width_mm`)

Incorrect scope doesn't prevent the engine from running, but it breaks the expected canonical-payload shape that the UI sends.

### 5.6 Severity values

Three places use severity: `product_constraints`, `product_validations`, `product_warnings`. Allowed values are `"error"` (blocks BOM generation), `"warning"` (surfaces to user, BOM still generated), `"info"` (advisory).

---

## 6. Table catalogue

For each table, see `supabase/seeds/schemas/<table>.schema.json` for the authoritative column list and types. Below is the "source signals" list — what to look for in input material to recognise a row of this table.

### 6.1 `products`

One row per product. The catalog is **flat** — no parent/variant hierarchy. `product_type` (`'fence' | 'gate' | 'other'`) distinguishes what the row is. Gate products additionally list `compatible_with_system_types` — the fence system_types the gate pairs with.

**Source signals:**
- A name for the product ("QSHS Horizontal Slat Screen", "QuickScreen Pedestrian Gate")
- A short uppercase code ("QSHS", "QS_GATE", "VS")
- Whether it's a fence, gate, or something else → `product_type`
- For gates: the list of fence system_types it works with → `compatible_with_system_types`
- Available options (colour list, slat size list, slat gap list) → `metadata.options`

**Typical row for a new fencing system:**
```json
{ "system_type": "VS",
  "product_type": "fence",
  "name": "VS Vertical Slat Screen",
  "description": "Vertical slat orientation; slats insert into top/bottom rails.",
  "active": true, "sort_order": 2,
  "metadata": { "allowedAngles": [90,135,180],
                "options": { "slatSize": ["65","90"], "slatGap": ["5","9","20"],
                             "colour": ["black-satin","monument-matt",…] } } }
```

**Typical row for a gate that pairs with several fences:**
```json
{ "system_type": "QS_GATE",
  "product_type": "gate",
  "compatible_with_system_types": ["QSHS", "VS", "XPL", "BAYG"],
  "name": "QuickScreen Pedestrian Gate",
  "description": "Single-leaf swing gate compatible with any QuickScreen slat fence system.",
  "active": true, "sort_order": 20,
  "metadata": { "product_family": "gate", "default_layout_type": "single_gate" } }
```

### 6.2 `product_components`

One row per purchasable SKU. SKU convention: uppercase, dash-separated, ends with colour short code for colour-bearing items.

**Source signals:** any list of SKUs with a name, category, unit, and a default price. Supplier price sheets, internal catalog, build-pack CSVs.

**Category values used in this codebase:** `slat`, `rail` (top/bottom rails — common for vertical systems), `side_frame`, `cfc_cover`, `centre_support_rail`, `f_section`, `accessory`, `mounting`, `gate_side_frame`, `joiner_block`, `hardware`. The JSON Schema allows any string; match existing seeds so selectors and companions resolve.

**`system_types` on each component:** must be a non-empty array whose elements are **only** `QSHS`, `VS`, `XPL`, `BAYG`, or `GATE`. Gate-catalog SKUs (even when the gate **product** is `QS_GATE`) use **`["GATE"]`** here — **not** `QS_GATE`.

**Typical row:**
```json
{ "sku": "VS-5800-RAIL-B",
  "name": "VS Top/Bottom Rail 5800mm — Black Satin",
  "description": "Vertical-slat horizontal rail (stock length).",
  "category": "rail", "unit": "length", "default_price": 22.50,
  "system_types": ["VS"], "metadata": {}, "active": true }
```

### 6.3 `rule_sets`

One per product (flat catalog). Typically one rule set per product, named e.g. "VS Fence Rules" or "QS Gate Rules".

```json
{ "product_system_type": "VS",
  "name": "VS Fence Rules", "description": "Data-driven VS fence BOM rules v3",
  "active": true }
```

### 6.4 `rule_versions`

Exactly one per rule_set with `is_current: true`. To revise logic without breaking old quotes, clone this row with a new `version_label` and flip `is_current` — don't overwrite.

```json
{ "product_system_type": "VS",
  "rule_set_name": "VS Fence Rules", "version_label": "v1.0.0",
  "is_current": true, "effective_from": "2026-04-19",
  "notes": "Initial VS rules" }
```

### 6.5 `product_constraints`

Hard input bounds.

**Source signals:** any "height must be X to Y mm", "only Z gaps allowed", "maximum width is N mm" statement in source material.

Common `constraint_type` values: `"min"`, `"max"` (with numeric `value_text`), `"enum"` (with a JSON-array-as-string in `value_text`), `"threshold"` (triggers behaviour change, not a hard bound).

```json
{ "product_system_type": "VS",
  "name": "max_panel_width_mm", "constraint_type": "max",
  "value_text": "2600", "unit": "mm", "severity": "warning",
  "applies_when_json": {}, "message": "Panel width above 2600mm is not supported",
  "active": true }
```

### 6.6 `product_variables`

Declare every input field the engine reads. This is the contract between the form and the engine.

**Source signals:** any "user picks X from these options", "system needs to know the colour / gap / mounting type" statement.

Required fields: `name`, `label`, `data_type`, `scope`. For enum variables, provide `options_json`.

```json
{ "product_system_type": "VS",
  "name": "slat_gap_mm", "label": "Slat Gap",
  "data_type": "enum", "unit": "mm", "required": true,
  "default_value_json": 5, "options_json": [5, 9, 20],
  "scope": "job", "sort_order": 30, "active": true }
```

### 6.7 `product_validations`

Cross-variable checks.

**Source signals:** any "combination X must be compatible with Y" rule, e.g. "swing gates must not exceed 1200mm wide", "XPL systems must use 65mm slats".

```json
{ "product_system_type": "VS",
  "name": "height_in_range",
  "expression": "target_height_mm >= 300 && target_height_mm <= 2400",
  "severity": "error",
  "message": "Height is outside VS range (300–2400mm)", "active": true }
```

### 6.8 `product_rules`

The heart of the calculation. Stage-ordered math.js expressions.

**Source signals:** formulas in source material like "slats per panel = floor((target_height + gap − 3) / (slat + gap))". Look for stock-length calculations, post-count formulas, bracket counts.

Follow the four stages:
- `derive` — secondary values (num_slats, actual_height_mm, cut lengths)
- `stock` — number of stock lengths needed for each cut; use `stocks()` helper
- `accessory` — screw/spacer/cap counts derived from above
- `component` — final emitted components (num_side_frames, etc.)
  Note: `num_posts` is **engine-provided** — do not write a component rule for it.

```json
{ "product_system_type": "VS",
  "rule_set_name": "VS Fence Rules", "version_label": "v1.0.0",
  "stage": "derive", "name": "num_slats",
  "expression": "floor((target_height_mm + slat_gap_mm - 10) / (slat_size_mm + slat_gap_mm))",
  "output_key": "num_slats", "priority": 10, "active": true,
  "notes": "VS: top/bottom rails consume 10mm in the height budget" }

{ "product_system_type": "VS",
  "rule_set_name": "VS Fence Rules", "version_label": "v1.0.0",
  "stage": "stock", "name": "slat_stocks",
  "expression": "stocks(num_slats * num_panels, slat_stock_length_mm, slat_cut_length_mm)",
  "output_key": "slat_stocks", "priority": 60, "active": true }
```

### 6.9 `product_component_selectors`

Maps a component category + match conditions to a resolved SKU.

**Source signals:** "for 65mm slats in black, the SKU is XP-6100-S65-B". SKU tables that embed colour/size options.

Use placeholders (`{colour}`, `{finish}`) to avoid writing one row per colour.

```json
{ "product_system_type": "VS",
  "selector_key": "vs_fence_slat_65_std",
  "component_category": "slat", "selector_type": "exact",
  "match_json": { "slat_size_mm": 65, "finish_family": "standard" },
  "sku_pattern": "XP-6100-S65-{colour}", "priority": 100,
  "notes": "VS 65mm slat — colour resolved at runtime", "active": true }
```

### 6.10 `product_companion_rules`

"When we add X, also add Y." Captures auto-adds.

**Source signals:** "each side frame needs a CFC cover", "each gate needs 2 hinges", "every 50 slats uses 1 pack of spacers".

Quantities are math.js expressions evaluated against the current context. You can reference any computed variable (e.g. `side_frame_qty`, `gate_qty`, `slat_qty`) or use helpers like `same_as(...)`.

```json
{ "product_system_type": "VS",
  "rule_key": "vs_sf_add_cfc", "trigger_category": "side_frame",
  "trigger_match_json": {}, "add_category": "cfc_cover",
  "add_sku_pattern": "VS-5800-CFC-{colour}",
  "qty_formula": "same_as(side_frame_qty)", "is_pack": false,
  "priority": 10, "notes": "1 CFC per side frame", "active": true }
```

### 6.11 `product_warnings`

Non-blocking review messages. severity `"error"` is blocking; `"warning"` and `"info"` are advisory.

**Source signals:** "warn if panel > 2600mm — split into additional panels", "alert for gates > 1200mm — consider sliding", "90mm slats only available in WRC finish".

```json
{ "product_system_type": "VS",
  "warning_key": "vs_panel_width_warn", "severity": "warning",
  "condition_json": { "panel_width_mm": { "gt": 2600 } },
  "message": "Panel exceeds recommended max width; split into additional panels.",
  "active": true }
```

### 6.12 `pricing_rules`

Per-SKU, per-tier pricing. Emit three rows per SKU (one per tier). For quantity breaks, add higher-priority rows whose `rule` is a math.js quantity predicate.

**Source signals:** any price sheet or wholesaler doc.

```json
{ "sku": "VS-5800-RAIL-B",
  "tier_code": "tier1", "rule": null, "price": 26.00,
  "priority": 0, "valid_from": null, "valid_to": null,
  "notes": null, "active": true }
```

---

## 7. Source-to-schema playbooks

### 7.1 Structured CSV

You have a CSV with a header row and field values per row. Approach:

1. **Identify the target table.** If the CSV is `product_rules.csv`, it's a near-1:1 map. If it's a price sheet, the target is `product_components` + `pricing_rules` × 3 tiers.
2. **Drop UUID columns.** CSVs in `qshs_mvp_build_pack/` and `qshs_gates_build_pack/` include hard-coded UUIDs for `id`, `org_id`, `product_id`, `rule_set_id`, `version_id`. **Do not carry them forward.** Use business keys.
3. **Normalise types.** CSV `"True"` → boolean `true`; `"null"` → JSON `null`; quoted numerics → numbers.
4. **Reshape columns where needed.** Older CSV shapes sometimes differ from the current DB. For example the old `product_companion_rules.csv` combined `trigger_json` and `action_json`; the current schema splits these into `trigger_category` + `trigger_match_json` + `add_category` + `add_sku_pattern` + `qty_formula`. Map accordingly by inspecting the old JSON cells.
5. **Validate.** Each resulting object must conform to the table's JSON Schema. In this repo run `npm run seed:products` (or `node supabase/seeds/tools/seed-products.js`) — it validates against `product-file.schema.json` then upserts; Ajv prints JSON pointer paths on failure.

### 7.2 Natural-language brief

You are given a prose description like:
> "We're adding a VS vertical slat system. Same colours as QSHS. Uses 65mm or 90mm slats, 5/9/20mm gaps. Min height 300mm, max 2400mm. Panels up to 2600mm wide. Each panel has 2 side frames and 2 rails (top + bottom). 1 CFC cover per side frame. Spacers are needed 1 per slat plus 1 extra — so 2*num_slats − 1 per panel. Tier 1 prices attached; trade tiers are 85%/72% of tier 1."

Interview checklist to extract:

1. **System code + parent family** → `products` row.
2. **Available options** (colours, slat sizes, gaps, mounting types, boundary types) → `product_variables` rows (one per option field), `products.metadata.options` for UI hints.
3. **Bounds** (min height, max height, max panel width, allowed gap values) → `product_constraints` rows.
4. **Cross-variable rules** (e.g. "XPL forces 65mm slats") → `product_validations` rows.
5. **Calculation formulas** (slat count, actual height, cut lengths, post count) → `product_rules` rows, stage-assigned as per §5.3.
6. **SKUs used per component category** with any colour/size pattern → `product_component_selectors` rows.
7. **Auto-adds** ("each X triggers Y") → `product_companion_rules` rows.
8. **Review warnings** ("warn if panel > 2600mm") → `product_warnings` rows.
9. **SKUs themselves** (with names, categories, units, default prices) → `product_components` rows.
10. **Pricing** (three tiers, optional quantity breaks) → `pricing_rules` rows.

When the source doesn't say:
- **Stock lengths** default to 5800mm for slats/rails/side-frames, 3000mm for posts (QSHS convention). Check existing `derive`/`stock`-stage rules in `supabase/seeds/glass-outlet/products/qshs.json` before assuming.
- **Default colour_code** is `"B"` (black-satin) unless stated otherwise.
- **Sort order** of variables: colour → slat size → slat gap → mounting → boundaries → per-segment (width/height) in steps of 10.
- **Tier margins**: if not provided, ask. Don't invent numbers.

### 7.3 Supplier PDF / XLSX price sheet

Targeting `product_components` + `pricing_rules`. Extraction pattern:

1. **Spot the SKU column** — usually a code like `QS-6100-S65-B`. If the sheet uses internal part numbers without colour, ask the user or leave the colour-variant SKUs as a separate follow-up pass.
2. **Spot the tier columns** — supplier sheets often have tier1/tier2/tier3 or retail/distributor/trade columns. If unclear, output tier1 only and leave a warning.
3. **Identify units and pack sizes** — "50 pack", "each", "length". Units affect how the engine's companion rules compute quantities.
4. **For each SKU row**, emit:
   - one `product_components` row with `sku`, `name`, `description`, `category` (best-effort), `unit`, `default_price = tier1 price`, `system_types` array, `active: true`.
   - three `pricing_rules` rows (one per tier) with `priority: 0` and `rule: null`.

Quantity-break rows become additional `pricing_rules` entries with higher `priority` and a `rule` expression like `"qty <= 50"`.

### 7.4 Cin7 Mass-Download XLSX / Bulk CSV Import

The Admin portal supports importing catalog items directly from wholesaler exports, specifically matching the Cin7 Product Master format or a generic CSV format.

#### 7.4.1 Cin7 XLSX Product Master Schema
When parsing a Cin7 Mass-Download XLSX file:
1. **Header Identification**: The parser locates the first row containing `ProductId` as the header.
2. **Column Mappings to Component/Prices**:
   - `sku` is resolved from `ManufacturerSKU` || `SupplierSKU` || `cin7-${row.ProductId}`.
   - `name` maps from `ShortDescription`.
   - `category` is inferred by scanning `ShortDescription`, `Custom1`, `Custom2`, and `Custom3` for keywords:
     - `'slat'` -> `slat`
     - `'post'` -> `post`
     - `'rail'` -> `rail`
     - `'bracket'` -> `bracket`
     - `'screw' | 'fastener' | 'fixings'` -> `screw`
     - `'hinge' | 'latch' | 'lock' | 'dropbolt' | 'gate stop' | 'drop bolt'` -> `hardware`
     - `'gate' | 'leaf' | 'frame'` -> `gate`
     - `'cap' | 'spacer' | 'plugs' | 'cover'` -> `accessory`
   - `system_types` array is inferred by scanning `ShortDescription`, `Custom1`, `Custom2`, and `Custom3` for keywords:
     - `'QSHS' | 'HORIZONTAL'` -> `QSHS`
     - `'VS' | 'VERTICAL'` -> `VS`
     - `'XPL' | 'XPRESS'` -> `XPL`
     - `'BAYG' | 'BAY-G'` -> `BAYG`
     - `'GATE'` -> `GATE`
     - Falls back to `['QSHS']` if no keyword matches.
   - `colours` array contains `[Colour.trim().toLowerCase()]` if `Colour` is present.
   - `sizes` is parsed from the `Size` column:
     - `Width x Height` (e.g. `50x50`) -> `{ width, height }`
     - Single dimension (e.g. `1800mm`) -> `{ length }`
3. **Pricing Tier Calculation**:
   - `Cost` matches `BuyPriceEx` and `Price` matches `RRP`.
   - `Tier 1` (Retail): if `RRP` is present, it uses `RRP * 100` (cents). If missing, defaults to `BuyPriceEx * 1.5 * 100` (cents).
   - `Tier 2` (Trade/Distributor): `BuyPriceEx * 1.3 * 100` (cents).
   - `Tier 3` (Best Wholesaler): `BuyPriceEx * 1.15 * 100` (cents).

#### 7.4.2 Generic CSV Schema
When parsing generic CSV files, the parser maps common field aliases:
- **SKU**: `sku`, `SKU`, `Sku`, `ManufacturerSKU`, `SupplierSKU`, `code`, `Code`.
- **Name**: `name`, `Name`, `description`, `Description`, `ShortDescription`, `title`, `Title`.
- **Category**: `category`, `Category`, `type`, `Type`. Defaults to `accessory`.
- **System Types**: `system_types`, `system_type`, `SystemTypes`, `SystemType`. Common values: comma-separated list of `QSHS`, `VS`, `XPL`, `BAYG`, `GATE`.
- **Colours**: `colours`, `colour`, `Colour`, `Color`, `color`.
- **Sizes**: `size`, `Size`, `dimensions`, `Dimensions`.
- **Pricing**: `price`, `Price`, `price_cents`, `priceCents`, `priceExGst`, `BuyPriceEx`, `BuyPrice`.
  - Staged prices are replicated across three tiers:
    - Tier 1: `basePriceCents`
    - Tier 2: `basePriceCents * 0.85`
    - Tier 3: `basePriceCents * 0.72`

---

## 8. Output worked example — adding a "VS" vertical slat system

Given the natural-language brief in §7.2, the output is **one file**: `supabase/seeds/glass-outlet/products/vs.json`. Sketch of the shape (abridged — a real file has many more rows in each section):

```json
{
  "org_slug": "glass-outlet",
  "products": [
    { "system_type": "VS",
      "product_type": "fence",
      "name": "VS Vertical Slat Screen",
      "description": "Vertical slat orientation; slats insert into top/bottom rails.",
      "active": true, "sort_order": 2,
      "metadata": { "allowedAngles": [90,135,180],
                    "options": { "slatSize": ["65","90"], "slatGap": ["5","9","20"],
                                 "colour": ["black-satin","monument-matt"] } } }
  ],
  "product_components": [
    { "sku": "VS-5800-RAIL-B", "name": "VS Rail 5800mm — Black Satin",
      "description": "Top/bottom rail for vertical slats",
      "category": "rail", "unit": "length", "default_price": 26.00,
      "system_types": ["VS"], "metadata": {}, "active": true }
  ],
  "rule_sets": [
    { "product_system_type": "VS", "name": "VS Fence Rules",
      "description": "Data-driven VS fence BOM rules v3", "active": true }
  ],
  "rule_versions": [
    { "product_system_type": "VS", "rule_set_name": "VS Fence Rules",
      "version_label": "v1.0.0", "is_current": true,
      "effective_from": "2026-04-19", "notes": "Initial VS rules" }
  ],
  "product_constraints": [
    { "product_system_type": "VS", "name": "min_height_mm",
      "constraint_type": "min", "value_text": "300", "unit": "mm",
      "severity": "error", "applies_when_json": {},
      "message": "Height must be at least 300mm", "active": true },
    { "product_system_type": "VS", "name": "max_height_mm",
      "constraint_type": "max", "value_text": "2400", "unit": "mm",
      "severity": "error", "applies_when_json": {},
      "message": "Height must be 2400mm or less", "active": true },
    { "product_system_type": "VS", "name": "max_panel_width_mm",
      "constraint_type": "max", "value_text": "2600", "unit": "mm",
      "severity": "warning", "applies_when_json": {},
      "message": "Panel above 2600mm not supported", "active": true }
  ],
  "product_variables": [ /* colour_code, slat_size_mm, slat_gap_mm, panel_width_mm, target_height_mm, … */ ],
  "product_validations": [ /* height_in_range, gap_allowed, slat_size_allowed, … */ ],
  "product_rules": [ /* num_slats, slat_cut_length_mm, rail_cut_length_mm, num_side_frames, num_rails, num_cfc_covers, num_csr — note: num_posts is engine-provided, do not include */ ],
  "product_component_selectors": [ /* slat_65, slat_90, side_frame, rail, cfc, post, spacers, screws */ ],
  "product_companion_rules": [ /* sf_add_cfc, slat_spacers, f_section_screws */ ],
  "product_warnings": [ /* panel_width_warn, csr_required */ ],
  "pricing_rules": [
    { "sku": "VS-5800-RAIL-B", "tier_code": "tier1", "rule": null,
      "price": 26.00, "priority": 0, "valid_from": null, "valid_to": null,
      "notes": null, "active": true },
    { "sku": "VS-5800-RAIL-B", "tier_code": "tier2", "rule": null,
      "price": 22.10, "priority": 0, "valid_from": null, "valid_to": null,
      "notes": null, "active": true },
    { "sku": "VS-5800-RAIL-B", "tier_code": "tier3", "rule": null,
      "price": 18.72, "priority": 0, "valid_from": null, "valid_to": null,
      "notes": null, "active": true }
  ]
}
```

Pattern-match against the committed `supabase/seeds/glass-outlet/products/qshs.json` for the shape of rule / selector / companion / pricing rows — it's the ground truth and the largest live example.

---

## 9. Self-verification checklist

Before emitting, self-check:

- [ ] File has a top-level `org_slug` (usually `"glass-outlet"`); individual rows do NOT.
- [ ] Every `products[]` row has **`product_type`** (`fence` / `gate` / `other`) and **`system_type`**.
- [ ] Every `product_components[]` row: **`system_types`** uses only `QSHS`, `VS`, `XPL`, `BAYG`, `GATE` (gate SKUs → `GATE`).
- [ ] `product_system_type` values are consistent across sections — the same product is named the same way everywhere.
- [ ] When the file ships an engine bundle: typically one `rule_sets` row for that product and exactly one `rule_versions` row with `is_current: true` per rule set (catalog-only snippets may omit those sections).
- [ ] Every `product_rules` row references a `rule_set_name` + `version_label` that exist in `rule_versions`.
- [ ] Stages of `product_rules`: `derive` rules don't reference `stock`/`accessory`/`component` output keys. `stock` may reference `derive`. Etc.
- [ ] Every SKU in `product_component_selectors.sku_pattern` either literally exists in `product_components` or, when the pattern has placeholders like `{colour}`, **every** substituted colour-variant exists in `product_components` (possibly in a different file — the upserter handles cross-file SKU references).
- [ ] Every `pricing_rules.sku` matches a row in `product_components` (again, possibly in another file).
- [ ] For each new SKU, three `pricing_rules` rows exist (tier1/tier2/tier3).
- [ ] `product_variables.options_json` values match what your `product_rules` and `product_component_selectors` reference (e.g. if `slat_size_mm` allows `[65, 90]`, no rule should assume 50 is valid).
- [ ] `product_variables.scope` is correct — `job` for colour/slat_size/slat_gap; `run` for boundary/mounting/hinge/latch; `segment` for panel_width_mm / target_height_mm / gate_width_mm / etc.
- [ ] `product_constraints.applies_when_json` keys are variable names that exist in `product_variables`.
- [ ] math.js expressions parse (balanced parentheses, no typos). When in doubt, check against existing rules in `supabase/seeds/glass-outlet/products/qshs.json`.
- [ ] All `active: true` unless you explicitly want a row disabled.

To validate in this repo: `npm run seed:products` (validates every file against `product-file.schema.json`, then upserts). If validation fails, ajv prints the exact JSON pointer and error.

---

## 10. What you do NOT produce

Out of scope for this spec:

- Database migrations — engine tables already exist; you only add rows.
- Edge function code — the engine is product-agnostic and reads your rows at runtime.
- UI components — the form is hand-coded in React and is shared across all fencing systems. It reads `product_variables` options but its structure is fixed.
- Canvas toolbar — hand-coded, shared.
- `quote_runs` / `quote_run_segments` rows — those are runtime data, not seeds.
- `input_aliases` — this table was removed in a prior cleanup; don't emit rows for it.

If a brief mentions UI layout changes, form fields to add, or canvas actions — note them in the output as a separate "UI follow-up" list, but don't try to seed them.
