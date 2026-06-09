# QuickScreen BOM Generator - Living App Overview

Last updated: 2026-05-12

This file is the regular handoff overview for the app. Update it whenever a feature changes the app flow, calculator engine, seed model, canvas mapper, Supabase schema, or key file responsibilities.

## What The App Does

QuickScreen BOM Generator is a React and Supabase quoting tool for The Glass Outlet slat screening and gate systems. The current sandbox focus is a working trade quote calculator that can:

- Select a fence system such as QSHS, VS, XPL, or BAYG.
- Configure runs, segments, gates, colours, slat sizes, gaps, post sizes, mounting type, and accessories.
- Draw or edit a fence layout on a canvas and translate that layout into run and segment data.
- Generate a priced bill of materials with GST and grand total.
- Add suggested accessories and manual extra BOM items.
- Save jobs to Supabase when Supabase is configured and the user is logged in.
- Fall back to bundled seed-backed local calculation when Supabase is unavailable or the user is not logged in.

## Current Routes

The current branch uses these active routes in `src/App.tsx`:

- `/` redirects to `/calculator`.
- `/calculator` renders the active v3 calculator surface, `CalculatorV3Page`.
- `/login` renders the auth page.
- `/quotes` and `/quote/:id` are protected saved quote views.
- `/new` still renders the older `MainApp` behind `AuthGuard`; do not extend it unless the project intentionally revives that surface.
- `/admin/suppliers` renders `SuppliersListPage` for managing system suppliers.
- `/admin/suppliers/new` and `/admin/suppliers/:slug/edit` render `SupplierEditPage` for creating/updating a supplier.
- `/admin/system-instances` renders `SystemInstancesListPage` for viewing/filtering system configurations.
- `/admin/system-instances/new` and `/admin/system-instances/:id/edit` render `SystemInstanceEditPage` for creating/updating system instances.
- `/admin/products` renders `ProductsListPage` for viewing/filtering system products with supplier/instance filter options.
- `/admin/products/new` and `/admin/products/:id/edit` render `ProductEditPage` for creating/updating system products.
- `/admin/imports/new` and `/admin/imports/:runId/review` render `ImportPage` for uploading wholesaler inventory lists, diffing staged products/pricing against the live catalogue, and publishing approved changes.

Older docs may mention `/fence-calculator`; in this branch the locally tested route is `/calculator`.

## Runtime Stack

- `React 19` and `Vite` provide the SPA.
- `Tailwind CSS` provides styling and theme tokens.
- `React Router` controls navigation.
- `TanStack Query` handles remote and async state.
- `Supabase` provides auth, database, edge functions, and quote storage.
- `@react-pdf/renderer` and `papaparse` support exports.
- `lucide-react` provides UI icons.
- The canvas mapper is vanilla TypeScript wrapped by React, not a React canvas rewrite.

## Main Data Flow

1. The landing screen captures a job name, then `CalculatorV3Page` creates an empty canonical payload and opens the calculator on the BOM tab.
2. The sidebar `DescribeFenceBox`, manual Add run flow, and canvas map all write to the same `CalculatorContext` payload.
3. `RunListV3`, `RunCard`, and `SegmentRow` edit runs, sections, and section-owned gate-opening segments.
4. `LayoutCanvasV3` and `FenceLayoutCanvas` allow drawing and editing map geometry.
5. `canonicalAdapter.ts` converts canvas layouts into the canonical payload shape and back again.
6. `useBomCalculator` sends the payload to the Supabase `bom-calculator` edge function when possible.
7. If Supabase or auth is unavailable, `useBomCalculator` uses `calculateLocalBom`.
8. `BOMResultTabs` renders per-run, gate, and all-item BOM views inside the BOM tab.
9. `CalculatorV3Page` handles job-level actions: generate BOM, clear BOM, print/export, save job, and Map/BOM tab state.

## Canonical Payload

The canonical payload is the shared contract between the UI, mapper, BOM engine, and quote persistence. The main types live in:

- `src/types/canonical.types.ts`
- `src/schemas/canonical.schema.ts`
- `supabase/functions/_shared/canonical.types.ts`

Key shape:

- `CanonicalPayload` has `productCode`, `schemaVersion`, job `variables`, and `runs`.
- `CanonicalRun` has `runId`, `productCode`, run `variables`, `segments`, `corners`, and optional geometry.
- `CanonicalSegment` can be a fence `panel`, `gate_opening`, or other supported segment kind.
- Gate-opening segments can include `leaves: [{ widthMm }]`. Single swing stores one finished leaf, double swing stores two finished leaves after hinge/latch clearances, and sliding gates use the opening width as the single moving leaf.
- Stable IDs matter. Do not regenerate `runId` or `segmentId` during canvas/form sync unless creating a genuinely new run or segment.

## Current Calculator UI Files

### Page Shell

- `src/pages/CalculatorV3Page.tsx`
  - Owns the active calculator page layout.
  - Manages job name, sidebar width, mobile layout, map drawer state, generated BOM state, edited line quantities, extra items, save job, print, and CSV export.
  - Calls `useBomCalculator`.
  - Saves jobs to `quotes` plus `quote_runs` and `quote_run_segments` when Supabase is configured and a user is logged in.

### Product And Run Setup

- `src/components/calculator-v3/ProductSelectV3.tsx`
  - Legacy searchable product selector retained for reuse, but no longer shown as a three-card entry path.
  - Loads active fence products from Supabase `products` and falls back to `localFenceProducts`.

- `src/components/calculator-v3/RunListV3.tsx`
  - Renders all runs.
  - Adds new runs and copies the prior/master defaults where required.
  - Newly added run first segments also start at `0m`.

- `src/components/calculator-v3/RunCard.tsx`
  - Renders each run heading, master settings summary, segment list, gate list, and run-level actions.
  - The directly editable Run Settings are the master/default source for following sections and gates.
  - Master setting summary pills render labels strongly and values in muted grey for readability.

- `src/components/calculator-v3/SegmentRow.tsx`
  - Renders the compact row for a panel or gate-opening segment.
  - Handles length/height editing, segment confirmation, reset-to-master, removal, and expand/collapse.
  - Section code buttons turn green when they match Run Settings and revert overridden sections back to Run Settings when clicked.
  - For gates, checks whether the gate matches the run master height and horizontal/vertical build type.
  - Closed fence segment rows show beginner-friendly titles such as `Run 1 Segment 1` and compact map labels such as `R1S1`.
  - Closed fence segment rows show the order summary: segment length, height, system, colour, slat, gap, post type, mounting, max post spacing, corner/end/total posts. Length and height edit controls live in the expanded options area. Remove uses a two-click red X confirmation.

### Segment And Gate Details

- `src/components/calculator-v3/FenceSegmentDetails.tsx`
  - Expanded fence segment controls.
  - Covers colour, post colour, slat size, gap, post size/system, mounting method, max post spacing, and related segment options.
  - Max post spacing defaults to 2600mm and can be edited from 100mm to 3000mm. Values are clamped consistently in the UI, mapper preview, local fallback BOM, suggested accessories, and seed constraints.

- `src/components/calculator-v3/GateSegmentDetails.tsx`
  - Expanded gate-opening controls.
  - Covers gate build, movement, hardware, gate post size, colour, slat size, gap, and termination-post behavior.
  - Gate movement supports single swing, double swing, and sliding. Sliding gates keep both travel direction and fence-side choice.
  - Double swing gates expose two editable finished leaf widths. Editing one leaf automatically adjusts the other inside the same clear opening and warns softly below 800mm.
  - Hardware controls rank fitted options first and keep failed-fit options under Other hinges / Other latches so installers can still override when needed.
  - Swing-gate hinge quantity is fixed at exactly two hinges per leaf. Single swing emits 2 hinges; double swing emits 4 hinges. Do not add heavy-gate or tall-gate hinge-count exceptions.
  - Optional parent-tied add-ons render inline under the chosen parent control. TruClose safety caps (`TC-CAPS3`) are optional and only enter the BOM when selected.
  - `GateComponentDiagram.tsx` renders horizontal/vertical QSG assembly diagrams with numbered component callouts. The callouts cross-highlight matching BOM rows via `src/lib/gateDiagramHover.ts`.

- `src/components/calculator-v3/GateListV3.tsx` and `GateFormV3.tsx`
  - Older/auxiliary v3 gate list/form components. Prefer checking actual usage before extending them because gate workflow has moved heavily into segment rows.

### BOM Panels

- `src/components/shared/BOMResultTabs.tsx`
  - Displays BOM tabs, scoped totals, editable line quantities, and removable line items.
  - Tabs include all items, each run, all gates, and individual labelled gate tabs when gate segment data is available.
  - Rows are expected to be aggregated by matching SKU/category/description/unit before display so repeated segment-level quantities read as one order line.
  - Source breakdowns preserve which run/gate contributed each quantity. Filtered tabs derive their scoped quantities from those sources and re-price the line at that scoped quantity.
  - BOM display grouping uses display category, subcategory, companion relationship, and sort priority instead of the raw engine selector category alone.
  - Gate BOM rows use `src/lib/gateDiagramMapping.ts` to show numbered diagram badges beside mapped SKUs. Hovering a badge or row highlights the matching gate diagram component.
  - BOM rows show applied unit price and line total only; per-line Tier 1 / Tier 2 / Tier 3 labels are intentionally hidden. Quantity-break prompts can mention lower unit prices, but not internal tier names.

- `src/components/calculator-v3/ExtraItemsPanel.tsx`
  - Lets the user add product search/manual extras to the generated BOM.

- `src/components/calculator-v3/SuggestedAccessoriesPanel.tsx`
  - Shows suggested accessories derived from the current payload and BOM.

- `src/components/calculator-v3/BOMWarningsPanel.tsx`
  - Displays warnings/errors/assumptions from the BOM engine.

- `src/components/calculator-v3/BOMTracePanel.tsx`
  - Admin/debug trace display for engine output when available.

- `src/components/calculator-v3/AchievedHeightBadge.tsx`
  - Shows calculated achieved height where engine output provides it.

## Multi-Supplier Module

- `src/types/multiSupplier.ts`
  - Canonical type definitions for the multi-supplier database models (suppliers, archetypes, instances, grants, reports).
- `src/lib/multiSupplier/schemas.ts`
  - Zod schemas validating multi-supplier domain objects.
- `src/lib/multiSupplier/queries.ts`
  - Read-only database query helpers for suppliers, archetypes, and system instances.
- `src/lib/multiSupplier/index.ts`
  - Public export surface for multi-supplier query helpers and schemas.

## Canvas And Layout Mapper

The mapper is intentionally split between a vanilla engine and a React wrapper.

- `src/components/canvas/canvasEngine.ts`
  - Owns drawing, tools, pan/zoom, grid, segment length edits, node dragging, gate placement, gate dragging, post previews, map drawing, labels, undo, and layout export/import.
  - Does not import React.
  - Recent behavior: gate markers can now anchor at `start`, `center`, or `end`, so a gate can sit flush at a segment end or corner while keeping the full opening width.
  - Loading a layout from typed sidebar dimensions now fits the canvas view to the imported run so it opens centered instead of at the top-left.
  - Mobile behavior: single-touch taps and drags feed the same draw/move/gate/text workflows as mouse input; double-tap finishes an active drawn run, boundary, or building.
  - Double swing gate previews draw two arcs sized from the canonical gate `leaves` array when available, so asymmetric edited leaves are visible on the map.

- `src/components/canvas/FenceLayoutCanvas.tsx`
  - React wrapper around the engine.
  - Wires toolbar buttons, map controls, gate edit callbacks, and layout sync.
  - The canvas opts out of browser touch scrolling so phone gestures place and move layout geometry instead of scrolling the page.

- `src/components/calculator-v3/LayoutCanvasV3.tsx`
  - Bridges the calculator payload and `FenceLayoutCanvas`.
  - Uses canonical adapters for canvas-to-payload and payload-to-canvas sync.

- `src/components/canvas/canonicalAdapter.ts`
  - Converts `CanvasLayout` into `CanonicalPayload` runs/segments.
  - Converts canonical payloads back to canvas layouts for reload/edit.
  - Splits a drawn segment into panel/gate/panel canonical pieces when a gate is placed.
  - Preserves geometry angle hints so angled layouts do not flatten during sidebar edits.
  - Skips zero-length initial panel segments when rebuilding the visual canvas so a new job starts with a clear map.

- `src/components/canvas/CanvasToolbar.tsx`, `MapControls.tsx`, `LayoutMinimap.tsx`
  - Supporting UI for drawing tools, Google Maps/satellite underlay settings, and map overview.
  - The toolbar scrolls horizontally on phone widths so drawing, gate, move/edit, site, and view tools remain accessible without crushing the map.

## Calculator And Pricing Logic

### Primary Backend Engine

- `supabase/functions/bom-calculator/index.ts`
  - Main v3 BOM edge function.
  - Validates canonical payloads.
  - Loads products, current rule versions, variables, rules, selectors, companions, validations, warnings, and pricing.
  - Evaluates rule expressions and returns lines, run results, gate items, totals, warnings, errors, assumptions, computed values, and optional trace.
  - Should stay product-agnostic. Product-specific rules belong in seed JSON.

### Pricing Edge Function

- `supabase/functions/calculate-pricing/index.ts`
  - Legacy/support pricing function.
  - Reads pricing rules and applies quantity break pricing.

### Product Search Edge Function

- `supabase/functions/search-products/index.ts`
  - Searches product components/SKUs for extras and lookup support.

### Local Fallback Engine

- `src/hooks/useBomCalculator.ts`
  - Calls Supabase `bom-calculator` when configured and authenticated.
  - Falls back to `calculateLocalBom` when Supabase is missing, no session exists, or the edge call fails.

- `src/lib/localBomCalculator.ts`
  - Frontend fallback BOM calculator.
  - Supports the current sandbox systems and enough logic to keep the calculator testable locally.
  - Uses local seed data and local price breaks.
  - Emits grouped BOM lines with source metadata so the All view can aggregate to one SKU line while run/gate tabs still show accurate scoped quantities and totals.
  - VS vertical slat fallback rule: slats and F sections are cut to fence height; each panel gets two height-cut side F sections, while the U-channel and QuickScreen frame inserts are cut to panel length.
  - QSG pedestrian swing gate fallback rule: horizontal and vertical pedestrian gates use `QSG-4200-GSF50-*` side frames, `QSG-4800-RAIL65/90-*` gate rails, gate/channel infill, screw cover, joiner blocks, spacers, `AR-SCR-BR-50PK`, `QS-SCREWS-50PK`, and `QSG-GFC-50X50-*`.
  - QSG sliding gate fallback rule: horizontal and vertical sliding gates use QSG sliding top/bottom rail SKUs (`QSG-S-6100-TR65/90-*`, `QSG-S-6100-BR-*`), QSG side frames, gate/channel infill, screw cover, joiner blocks, spacers, screws, top caps, wheel set/clamps, track, and horizontal-only centre support rails/plates.
  - Discontinued XP gate-frame guardrail: old slotted gate-frame and screw-fluted gate blade SKUs (`XP-4200-GSF*`, `XP-6100-GB65-*`, `XP-6100-HD6545-*`, `XP-LBOX-*`, `XP-HDL-*`, etc.) are blocked from fallback BOM output. XPRESS Plus fence posts and standard `XP-6100-S65-*` slats remain valid where the current QSG catalogue uses them.
  - This is not the long-term IP-protected source of truth; proven rules should move into backend seed data.

- `src/lib/localSeedData.ts`
  - Bundled local products, components, and pricing rules used by the fallback calculator and UI fallbacks.

- `src/lib/bomMetadata.ts`
  - Maps engine component categories into the display taxonomy: screening, frames and covers, posts and mounting, gate components, gate hardware, sliding gate running gear, caps and plugs, fasteners and screws, spacers, fixings, tools and consumables, and automation.
  - Resolves component subcategories, companion ordering, sort priority, and optional accessory relationships.

- `src/lib/localPriceBreaks.ts`
  - Quantity-break tier logic for local fallback pricing.

## Product Rules And UI Option Helpers

- `src/lib/productOptionRules.ts`
  - System-specific UI option rules and defaults.
  - Includes initial variables, available heights, slat/gap options, post defaults, max panel width defaults, and normalization.

- `src/lib/gateOptionRules.ts`
  - Gate-specific defaults and allowed options.
  - Includes gate movements, builds, hinges, latches, lever/knob handle sets, drop bolts, gate stops, and default gate variables.

- `src/lib/segmentTermination.ts`
  - Shared termination keys and helpers for system posts, wall/existing fence terminations, corners, and gate stubs.

- `src/lib/runStats.ts`
  - Summary calculations for runs, segments, panels, posts, and gate counts.

- `src/lib/suggestedAccessories.ts`
  - Suggests extras based on selected systems, mounting methods, colours, and BOM output.

## State And Context

- `src/context/CalculatorContext.tsx`
  - Active v3 state: canonical payload and latest BOM result.
  - Reducer actions include setting payload, setting/clearing BOM, clearing quote, upserting/removing runs and segments.

- `src/context/ThemeContext.tsx`
  - Light/dark theme state.

- `src/context/FenceConfigContext.tsx`, `GateContext.tsx`
  - Older context surfaces used by the legacy `/new` flow and some historical components. Check route/component usage before extending.

## Supabase Database And Seeds

### Migrations

- `supabase/migrations/001_create_organisations.sql` through `023_selector_qty_key.sql`
  - Create organisations, profiles, quotes, products, components, pricing rules, v3 rule engine tables, quote run/segment persistence, RLS, and selector quantity support.

### Seed Files

- `supabase/seeds/glass-outlet/products/qshs.json`
  - QuickScreen horizontal slat fence data, components, rules, selectors, companions, pricing.

- `supabase/seeds/glass-outlet/products/vs.json`
  - Vertical slat fence data.

- `supabase/seeds/glass-outlet/products/xpl.json`
  - XPress Plus fence data. XPress Plus gate frame systems are not meant to be revived, but XPL fence remains required.

- `supabase/seeds/glass-outlet/products/bayg.json`
  - Alumawood/BAYG data.

- `supabase/seeds/glass-outlet/products/qs_gate.json`
  - Shared QuickScreen gate product data.
  - Current QSG direction is based on `CTS+QSG+Pedestrian+Gates~V3-T1 (1).xlsx`: pedestrian gates should use QSG side frames and normal QSG 65/90 gate rails, not the discontinued XP gate frame system and not sliding-gate HD rail.

- `supabase/seeds/glass-outlet/products/gate_legacy.json`
  - Historical gate data. Do not extend unless intentionally migrating old rules.

- `supabase/seeds/glass-outlet/products/other.json`
  - Inactive/other product families.

### Seed Tooling

- `supabase/seeds/tools/seed-products.js`
  - Validates product JSON against schemas and upserts products, components, pricing, variables, rules, selectors, companions, validations, and warnings.

- `supabase/seeds/tools/dump-to-json.js`
  - Dumps database seed data back to JSON.

- `supabase/seeds/schemas/*.schema.json`
  - JSON schemas for seed authoring and validation.

## Saved Jobs And Quotes

- `CalculatorV3Page.tsx` builds a quote payload containing job name, canonical payload, BOM result, and quote metadata.
- When logged in with Supabase configured, it inserts into `quotes`.
- It then inserts run payloads into `quote_runs`.
- It then inserts segment payloads into `quote_run_segments`.
- If a BOM was generated, the saved quote includes the BOM with edited quantities and extra items.

## Export And Print

- CSV export is handled in `CalculatorV3Page.tsx` using `Papa.unparse`.
- Print uses the browser print flow from the calculator page.
- Older PDF quote components exist under `src/components/quote/`; verify current route usage before extending.

## Local Development Commands

- `npm run dev` starts Vite on the local dev port.
- `npm run build` runs TypeScript and production Vite build.
- `npm run cy:open` opens Cypress.
- `npm run cy:run` runs Cypress against the React app.
- `npm run seed:products` validates and upserts product JSON to Supabase.
- `npm run db:reset` resets local Supabase and reloads product/auth seeds.
- `npm run setup` starts Supabase and resets/seeds local data.

## Project Agent Skills

- `.claude/skills/`
  - Canonical repo location for Claude/Codex-compatible specialist skills.
  - This is the folder most external developers/agents should look at first.

- `.agents/skills/`
  - Mirrored repo-local copies of the same specialist skills for project-agent workflows.
  - Keep this folder in sync with `.claude/skills/`.

- Both skill folders contain the project-manager, UI, QA, catalogue-extraction, QuickScreen BOM, and seed-mapping guidance.
  - Start with `.agents/skills/README.md`, then load the relevant `SKILL.md` and only the reference files needed for the task.

## Testing And Verification

Minimum checks after code changes:

- `npm run build`
- `git diff --check`
- Open or request the local app at `http://127.0.0.1:5173/calculator`

Recommended checks after calculator logic changes:

- Generate BOM for QSHS horizontal, VS vertical, XPL fence, and BAYG/Alumawood where touched.
- Test quantity edits in the BOM and confirm line totals update.
- Test selected BOM tab totals: all items, run-only, gates-only.
- Test gate placement in the mapper: middle of segment, start of segment, end of segment, and corner.
- Compare outputs against formulated Excel sheets before locking rules into backend seeds.

## Documentation Map

- `discovery.md`
  - Chronological learning/build journal. Update after meaningful decisions, fixes, test results, and user workflow findings.

- `docs/tasks.md`
  - Phase and task tracker. Update after completed task groups.

- `docs/how_it_works.md`
  - Plain-English v3 engine overview.

- `docs/seed-data-mapping-spec.md`
  - Contract for authoring product JSON seed files.

- `docs/phase-v3-*.md`
  - Deeper phase documents for engine migrations, seeds, canonical payload, edge function, calculator UI, BOM output, and docs.

- `docs/app-overview.md`
  - This living map of app files, responsibilities, and current runtime behavior.

## Update Rules For This File

Update this overview whenever:

- A file becomes the main owner of a workflow.
- A route changes.
- A new product family, gate type, or calculator is added.
- A local fallback rule is moved into backend seed data.
- Supabase schema or seed structure changes.
- Canvas mapper behavior changes.
- Save/export behavior changes.
- A legacy component is removed or revived.

Keep this file practical. Prefer short explanations of what each file owns and where to edit next.
