# How QuickScreen Works

*A one-page tour of the v3 calculator for anyone new to the project.*

## What the system does

QuickScreen turns a **fence/gate drawing** plus a few **configuration choices** into a **priced shopping list** (Bill of Materials, or BOM) that tells staff exactly what to pull from the warehouse and how much to charge. You draw the run, pick a colour and slat size, click Generate, and the system produces every post, slat, rail, bracket, spacer, and screw — with quantities and prices per tier.

## The moving parts

### 1. The canvas (where you draw)
At `/calculator`, the top panel shows an interactive canvas. You draw fence **runs** (straight lines between two points), add **corners** where they turn 90°, and drop **segments** inside each run — panels, bay groups, or gate openings. Google Maps can underlay the canvas so you draw over a satellite view of the actual site. Every shape you draw updates a single JSON document called the canonical payload.

### 2. The form (where you pick options)
The configuration form below the canvas is **hand-coded** — a single React component shared by every fencing system. Fence-system differences (QSHS, VS, XPL, BAYG, gates, sliding gates) are expressed in the BOM engine's seed data, not in the form. If a new system genuinely needs a field the form doesn't already render (rare), the form is extended once and then works for every future system that needs it. The form reads from and writes to the same canonical payload the canvas uses, so the two stay in sync automatically.

### 3. The canonical payload
One JSON shape describing the whole job:
```json
{
  "productCode": "QSHS",
  "variables": { "colourCode": "B", "slatSizeMm": 65, "slatGapMm": 5 },
  "runs": [
    {
      "runId": "abc…",
      "productCode": "QSHS",
      "leftBoundary": { "type": "product_post" },
      "rightBoundary": { "type": "wall" },
      "segments": [
        { "segmentId": "def…", "segmentKind": "panel", "panelWidthMm": 2500, "targetHeightMm": 1800 }
      ],
      "corners": []
    }
  ]
}
```
Canvas → payload → form → payload → BOM engine. Every layer speaks the same dialect.

### 4. The engine (`bom-calculator`)
A Supabase Edge Function runs the payload through a pipeline:

1. **Normalise** — apply `product_variables` defaults; map long colour names to short codes
2. **Validate** — block on out-of-range heights, impossible combinations
3. **Run rules** — math.js expressions from the database compute slat counts, cut lengths, panel counts, etc.
4. **Pick SKUs** — selector rows say "65mm slat + black colour → `QS-6100-S65-B`"
5. **Add companions** — "every side frame adds one CFC cover", "every slat adds spacers by gap"
6. **Gather warnings** — "Panel over 2600mm — split into additional panels"
7. **Price** — lookup prices via math.js expressions in `pricing_rules`
8. **Return** — lines, totals, warnings, per-run breakdown, and (for admins) a trace of every rule that fired

The engine **has no per-product branches** — the code doesn't know what QSHS is. It executes whatever rules live in the database for whichever product the payload names.

### 5. The database (where the rules live)
To change what a QSHS panel needs, you edit a seed row — **not code**. Migrations 011–014 and 018 create the engine tables; `supabase/seeds/glass-outlet/v3-qshs-engine.sql` fills them. Run `npm run db:reset` and the engine picks up the changes instantly.

## A worked example: 5m QSHS run, 65mm black slats

1. User draws a single 5000mm run on the canvas
2. Canvas emits a canonical payload: one run, one panel of 2500mm (engine will split it into two 2500mm panels to fit under the 2600mm max), target height 1800mm
3. Engine validates (height in range ✓, gap allowed ✓)
4. Rules fire:
   - `num_slats = floor((1800 + 5 - 3) / (65 + 5))` = **25 slats per panel**
   - `actual_height_mm = round((25 × 70) − 5 + 3)` = **1748mm achieved**
   - `side_frame_cut = 1800 − 3` = **1797mm cut**
   - `num_posts_from_boundaries = 2 + 0 corners` = **2 posts**
5. Selectors:
   - `slat_65_black` matches → `QS-6100-S65-B`
   - `side_frame_black` matches → `QS-5800-SF-B`
6. Companions add: 1 CFC per side frame, 1 cap pack per 2 side frames, spacer packs, screen screws, F-section screws, fixing kit for base plates
7. Pricing joins against `pricing_rules_with_sku` for tier1 — every line gets a unit price
8. Response arrives at the UI. BOM tabs (`All Items`, `Run 1`, `Gates`) render with pricing summary. An admin user also sees the trace of every rule that fired.

## Adding a new fencing system

To add (for example) a **vertical slat screen**, you seed — and almost never code:

- [ ] Add a `products` row (`system_type = 'VS'`, `parent_id` = QuickScreen root)
- [ ] Add a `rule_sets` row and a `rule_versions` row (`is_current = true`)
- [ ] Add `product_variables` (heights, colours, anchor types, …)
- [ ] Add `product_constraints` (min/max dimensions)
- [ ] Add `product_validations` (blocking checks)
- [ ] Add `product_rules` (formulas for post count, rail count, etc.)
- [ ] Add SKU rows to `product_components` (if the SKUs are new)
- [ ] Add `product_component_selectors` matching categories to SKU patterns
- [ ] Add `product_companion_rules` for auto-adds (fixings per post, etc.)
- [ ] Add `product_warnings` for non-blocking review messages
- [ ] Add `pricing_rules` for the new SKUs × 3 tiers

The form and canvas toolbar are shared across every fencing system, so no UI changes are needed unless the new system truly requires a field the current form doesn't render (rare). When it does, extend the form once.

## Where things live

| Concept | File(s) |
|---|---|
| Engine tables | `supabase/migrations/011_*.sql` … `014_*.sql`, `018_*.sql` |
| QSHS + gate seeds | `supabase/seeds/glass-outlet/v3-qshs-engine.sql` |
| Edge function | `supabase/functions/bom-calculator/index.ts` |
| Canonical payload types | `src/types/canonical.types.ts`, `supabase/functions/_shared/canonical.types.ts` |
| Canvas | `src/components/canvas/canvasEngine.ts` (unchanged from v1) |
| Canvas adapter | `src/components/canvas/canonicalAdapter.ts` |
| v3 page | `src/pages/CalculatorV3Page.tsx` at `/calculator` |
| v3 components | `src/components/calculator-v3/*` |
| v3 engine mutation | `src/hooks/useBomCalculator.ts` |
| Shared BOM tabs (v2 + v3) | `src/components/shared/BOMResultTabs.tsx` |

## Routes at a glance

| Path | Generation | Purpose |
|---|---|---|
| `/` | — | Redirects to `/fence-calculator`. |
| `/fence-calculator` | **v3** | Schema-driven engine (`bom-calculator`). MVP scope: QSHS + QSHS_GATE. |

## Glossary

- **Rule set** — a container of rules for one product (e.g. "QSHS fence rule set").
- **Rule version** — a frozen snapshot of a rule set. Only one version per set is active (`is_current = true`).
- **Selector** — a row that says "when category X matches these variables, use SKU pattern Y". Placeholders like `{colour}` get substituted at runtime.
- **Companion rule** — "when we add an X, also add a Y". Used for CFCs, spacers, hinges, caps.
- **Canonical payload** — the single JSON shape used by the canvas, form, engine, and persistent storage.
- **Trace** — per-rule log of what the engine did. Admin-only; used to debug unexpected BOMs.
- **Pricing rules** — math.js expressions per SKU + tier (e.g. "qty <= 50 → $1.20, qty > 50 → $1.05"). Evaluated at the end of the pipeline.

For deep details see [CLAUDE.md](../CLAUDE.md) (which redirects to [AGENTS.md](../AGENTS.md)) and the per-phase specs in the [docs/](.) directory.
