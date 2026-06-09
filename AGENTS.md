
# QuickScreen BOM Generator — Architecture & Development Guide

> **Purpose**: Single source of truth for working on this codebase. Covers business rules, architecture decisions, security constraints, and active guardrails. For implementation history and task tracking, see `docs/tasks.md` and `docs/phase-*.md`.

---

## 1. Project Overview

### What This App Does

QuickScreen is a **Bill of Materials (BOM) generator** for aluminium slat screening/fencing systems. Built for **The Glass Outlet** (a fencing supplier), branded under **SkybrookAI**.

Staff and trade customers can:

1. **Draw a fence layout** on a canvas (with optional Google Maps satellite underlay)
2. **Configure fence specifications** — system type, length, height, slat size, gap, colour, posts, corners
3. **Configure gates** — swing/sliding, dimensions, hardware (hinges, latches), posts
4. **Generate a priced BOM** — every post, rail, slat, bracket, screw, and accessory with quantities and pricing
5. **Export quotes** — CSV, pdf, saved quotes per user

> **Deferred to v2**: AI job description parsing (natural language → form fill) and AI BOM review (Claude sanity check on generated BOM). Do NOT build these.

### Current State

**Phases 0–7 are complete (Phase 7 included V1 removal). A parallel v3 data-driven engine is being adapted from `qshs_mvp_build_pack/` + `qshs_gates_build_pack/` — see `docs/phase-v3-*.md` and `docs/how_it_works.md`.** The React app is the primary codebase.

- See `docs/tasks.md` for the full current task status.

### Two routes — V3 only (v1 removed)

v2 was retired (deleted in an earlier cleanup). v1 was removed — the `/new` route, `MainApp`, `calculate-bom` edge function, and all V1 UI components have been deleted. V3 is the sole calculator surface.

| Path | Gen | Page | Edge function | Purpose |
|---|---|---|---|---|
| `/` | v3 | — | — | Redirects to `/fence-calculator`. |
| `/fence-calculator` | **v3** | `CalculatorV3Page` | `bom-calculator` | Data-driven BOM engine. Rules, selectors, constraints, companions, validations, warnings live in seeded Postgres tables. Form is data-driven from `product_variables` (no hardcoded fields). Searchable fence-only product picker + gate list modal + typeahead extra-items panel. MVP scope: **QSHS fence + QS_GATE pedestrian gate** (shared across QuickScreen fences). Adding VS/XPL/BAYG/QSVS/QSGH/HSSG/patios = new seed rows. |

### Current Architecture

- **React + Vite** SPA with **Tailwind CSS** (dark theme)
- **Supabase** backend: Auth, Postgres DB, Edge Functions
- **TanStack Query** for server state management
- **React Context + useReducer** for client state (fence config, gate list, UI state)
- **All pricing and BOM calculation logic in Supabase Edge Functions** (IP protection)
- **v3 engine is fencing-agnostic** — no per-product branches in the BOM engine code. All QSHS + QSHS_GATE calculation behaviour lives in `supabase/seeds/glass-outlet/v3-qshs-engine.sql`. The form and canvas toolbar are shared hand-coded UI for all fencing systems.

---

## 2. Tech Stack

| Layer          | Technology                                 | Purpose                                                  |
| -------------- | ------------------------------------------ | -------------------------------------------------------- |
| Framework      | React 19 with Vite                         | SPA build tooling, HMR, fast dev                         |
| Styling        | Tailwind CSS 3                             | Utility-first CSS, light/dark theme (`docs/ui-theme.md`)   |
| Server State   | TanStack Query v5                          | Caching, mutations for all Supabase calls                |
| Client State   | React Context + useReducer                 | Fence config, gate list, UI accordion/modal state        |
| Auth           | Supabase Auth                              | Email/password, session management, RLS                  |
| Database       | Supabase Postgres                          | Quotes, pricing tiers, product catalog                   |
| Edge Functions | Supabase Edge Functions (Deno)             | BOM calculation, pricing — **all sensitive IP here**     |
| Forms          | React Hook Form + Zod                      | Complex fence/gate forms with conditional validation     |
| Canvas         | Vanilla JS (ported from existing app)      | Fence layout drawing tool — wrapped via useRef+useEffect |
| Maps           | Google Maps JS API (loaded via script tag) | Satellite underlay for fence layout                      |
| PDF Export     | @react-pdf/renderer                        | Quote PDF generation                                     |
| CSV Export     | Papaparse                                  | CSV export of BOM                                        |
| Routing        | React Router v7                            | Auth pages, main app, quote viewer                       |
| Icons          | Lucide React                               | Consistent icon set                                      |
| Toasts         | Sonner                                     | Notifications for save/copy/error events                 |

---

## 3. Project Structure

Source lives in `src/` with these top-level directories: `components/` (auth, bom, calculator, calculator-v3, canvas, contact, fence, gate, layout, quote, shared, wizard), `context/`, `hooks/`, `lib/`, `pages/`, `schemas/`, `types/`, `utils/`.

Edge functions are in `supabase/functions/` — `bom-calculator` (v3), `calculate-pricing`, `search-products`, `_shared`.

Database migrations are in `supabase/migrations/` (001–010 are shared catalog + pricing infrastructure; 011–014, 018–022 are the v3 engine — migration 022 flattens products and adds `product_type` + `compatible_with_system_types`).

**Seeds are JSON-authoritative.** The only SQL seed loaded by `supabase db reset` is `supabase/seeds/organizations.sql` (one row — the org). Everything else — fences, gates, pricing, v3 engine rules — lives as **per-product JSON files** under `supabase/seeds/glass-outlet/products/`. Current files: `qshs.json`, `vs.json`, `xpl.json`, `bayg.json`, `qs_gate.json` (shared gate across all fences), `other.json` (inactive non-fence families).

JSON Schemas at `supabase/seeds/schemas/*.schema.json`, wrapped by `product-file.schema.json`. The Node upserter at `supabase/seeds/tools/seed-products.js` (run via `npm run seed:products`, and automatically by `npm run db:reset`) validates each file, resolves business-key FKs, and upserts every section directly via supabase-js. No SQL is generated. See `docs/seed-data-mapping-spec.md` and the `seed-mapper` skill for the authoring contract.

`slat-fencing.sql.disabled` is the historical pre-flatten SQL seed, kept on disk for reference only (the `.disabled` extension means supabase skips it).

`seed-auth.js` and `seed-images.js` handle auth users and image uploads respectively.

v3-specific additions:
- `src/pages/CalculatorV3Page.tsx` — `/fence-calculator` route
- `src/components/calculator-v3/` — shared fence config form, multi-run UI, warnings/trace/achieved-height panels
- `src/hooks/useBomCalculator.ts`
- `src/types/canonical.types.ts`, `src/schemas/canonical.schema.ts`
- `src/components/canvas/canonicalAdapter.ts`

Run `ls src/` or `ls src/components/` for the current file list — the directory has evolved beyond the original plan.

---

## 4. Business Rules & Validation

### Fence Configuration fields

`src/schemas/fence.schema.ts` — key fields: `systemType` (QSHS/VS/XPL/BAYG), `totalRunLength` (m, positive), `targetHeight` (300–2400mm), `slatSize` (65/90mm), `slatGap` (5/9/20mm), `colour`, `maxPanelWidth` (2600/2000mm), `leftTermination`/`rightTermination` (post/wall), `postMounting` (concreted-in-ground/base-plated/core-drilled), `corners` (int ≥ 0).

### Gate Configuration fields

`src/schemas/gate.schema.ts` — key fields: `gateType` (single-swing/double-swing/sliding), `openingWidth`, `gateHeight` (match-fence or 600–2400mm), `colour`/`slatGap`/`slatSize` (match-fence or explicit), `gatePostSize` (50×50/65×65/75×75/100×100), `hingeType`, `latchType`.

### Validation rules enforced in reducer and form

- **XPL system forces 65mm slats** — enforced in `FenceConfigContext` reducer on every SET_FIELD action
- **Swing gates (single/double) always use 65mm blades** — 90mm slats are only available for sliding gates
- **Max recommended swing gate width**: 1200mm
- **Standard gate heights**: 900, 1050, 1200, 1500, 1800, 1950, 2100mm
- **Panel width options**: 2600mm (standard), 2000mm (high-wind areas)
- **Stock lengths**: slat 5800mm, rail 5800mm, post 3000mm (typical)

### Colours (Colorbond brand names — must be spelled exactly)

`black-satin`, `monument-matt`, `woodland-grey-matt`, `surfmist-matt`, `pearl-white-gloss`, `basalt-satin`, `dune-satin`, `mill`, `primrose` _(limited)_, `paperbark` _(limited)_, `palladium-silver-pearl`

### Gate hardware

- **Hinges**: dd-kwik-fit-fixed, dd-kwik-fit-adjustable, heavy-duty-weld-on
- **Latches**: dd-magna-latch-top-pull, dd-magna-latch-lock-box, drop-bolt, none
- **Post sizes**: 50×50, 65×65, 75×75 _(confirm stock)_, 100×100 _(confirm stock)_

---

## 5. Database Design

Every table includes `org_id`. RLS policies use `public.user_org_id()` (a `SECURITY DEFINER STABLE` function on profiles) to scope all access. Never trust client-sent `org_id` — always resolve from the authenticated user's JWT.

| Migration | Table / View                | Key design notes                                                                                                                                    |
| --------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001       | `organisations`             | Seeds Glass Outlet org (`slug = 'glass-outlet'`). No RLS.                                                                                           |
| 002       | `profiles`                  | `public.user_org_id()` helper; signup trigger defaults new users to Glass Outlet org.                                                                  |
| 003       | `quotes`                    | RLS: users see **all org quotes** (staff visibility), but can only insert/update/delete their own.                                                   |
| 004       | `product_pricing` _(legacy)_| Renamed to `pricing_rules` in migration 008. Do not reference directly.                                                                             |
| 005       | `products`                  | **No RLS**. Root products + variants via `parent_id` FK. `UNIQUE(org_id, system_type) WHERE parent_id IS NULL`. `UNIQUE(parent_id, system_type) WHERE parent_id IS NOT NULL`. |
| 006       | `product_components`        | **No RLS**. Single source of truth per SKU: name, description, category, unit, default_price, system_types[], active. SKU unique per org.            |
| 007       | _(seed)_                    | Seed now populates `products`, `product_components`, and `pricing_rules` in new format.                                                              |
| 008       | `pricing_rules`             | **No RLS**. Rule-based pricing: `component_id` FK, `tier_code` (tier1/2/3), `rule` (math.js expression, NULL = always), `price`, `priority`.        |
| 008       | `pricing_rules_with_sku`    | View joining `pricing_rules` + `product_components`. Used by edge functions for sku-based lookups. No RLS (service role only).                       |
| 009       | `products` + image_url      | Adds `image_url` to products. Populated via `seed-images.js`.                                                                                        |
| 010       | `products` RLS              | `authenticated` SELECT on products (metadata only, no pricing).                                                                                      |
| 011       | `rule_sets`, `rule_versions`| **v3 engine.** Versioned rule containers per product. Exactly one `is_current=true` per set.                                                        |
| 012       | `product_rules`, `_constraints`, `_validations`, `_variables` | Stage-ordered math.js rules, bounds, validations, field definitions.                    |
| 013       | `product_component_selectors`| match-JSON → SKU pattern (supports `{colour}`/`{finish}` placeholders).                                                                            |
| 014       | `product_companion_rules`, `product_warnings` | Auto-add rules, non-blocking warnings.                                                                             |
| 018       | `quote_runs`, `quote_run_segments` | Persistent canonical payload for v3 quotes. FK → `quotes.id`. RLS matches `quotes` pattern.                                                   |
| 019       | `user_role` enum            | Adds `admin` value for trace/debug panel access.                                                                                                     |

---

## 5a. v3 Engine Tables

The v3 BOM engine is driven by data in migrations 011–014 and 018. All engine tables are multi-tenant via `org_id`. Most are service-role-only; the two the client reads to render UI hints and field lists (`product_variables`, `product_component_selectors`) have `authenticated` SELECT policies.

| Table | Purpose |
|---|---|
| `rule_sets` / `rule_versions` | Versioned rule bundles per product. Engine reads `is_current=true` |
| `product_rules` | Stage-ordered math.js expressions: `derive` → `stock` → `accessory` → `component` |
| `product_constraints` | min/max/threshold/enum bounds with `applies_when_json` conditions |
| `product_variables` | Field definitions, defaults, options, scope (`job`/`run`/`segment`) |
| `product_validations` | Blocking (`severity=error`) / non-blocking (`severity=warning`) math.js expressions |
| `product_component_selectors` | `match_json` → `sku_pattern`. Placeholders like `{colour}` resolved from context |
| `product_companion_rules` | "X triggers Y" auto-adds (CFC per side frame, spacers by gap, hinges per gate) |
| `product_warnings` | Non-blocking reviewer warnings & blocking engine errors |
| `quote_runs` / `quote_run_segments` | Persistent storage of the canonical payload |

**Seed convention:** `supabase/seeds/glass-outlet/v3-qshs-engine.sql` populates all of the above for QSHS + QSHS_GATE. UUIDs are generated at runtime; the key mapping lives in a comment block at the top of the file.

**To change QSHS calculation behaviour:** edit seed rows and `npm run db:reset`. Do not edit `supabase/functions/bom-calculator/index.ts` unless you're changing engine-framework behaviour.

See `docs/engine-schema.md` for column shapes and `docs/how_it_works.md` for a plain-English overview.

---

## 6. Supabase Edge Functions

### Org-scoping pattern (required in every edge function)

```typescript
const {
  data: { user },
} = await supabaseAdmin.auth.getUser(jwt);
const { data: profile } = await supabaseAdmin
  .from("profiles")
  .select("org_id, pricing_tier")
  .eq("id", user.id)
  .single();
const orgId = profile.org_id;
// Then scope all queries: .eq('org_id', orgId)
```

### calculate-pricing

`POST /functions/v1/calculate-pricing` — accepts `{ bomItems, pricingTier }`, returns priced items. Reads `pricing_rules_with_sku` view via service role key scoped by `org_id`. Evaluates `rule` expressions (math.js, variable: `qty`) to resolve the applicable price per line item. All prices ex-GST; GST is 10% (Australian).

### bom-calculator (v3 — product-agnostic)

`POST /functions/v1/bom-calculator` — accepts `{ payload: CanonicalPayload, pricingTier? }`, returns `{ lines, runResults, gateItems, totals, warnings, errors, assumptions, computed, trace?, pricingTier, generatedAt }`.

**Pipeline (all data-driven; no per-product branches):**

1. CORS + JWT → `resolveUserProfile` → `{ orgId, role, pricingTier }`
2. Validate payload via `canonicalPayloadSchema` (Zod)
3. Per unique `productCode`, load product + current rule_version + rules/constraints/selectors/companions/warnings/variables — parallelised via `Promise.all`; cached per-request
4. Normalise variables — apply `product_variables` defaults and map long colour names to short codes (e.g. `black-satin` → `B`) via a constant lookup
5. Run `product_validations` — if any `severity=error` fails, short-circuit with `{ errors, warnings, lines: [], totals: 0 }`
6. Evaluate `product_rules` in stage order (`derive` → `stock` → `accessory` → `component`) with `mathjs.evaluate(expression, ctx)`. Failed rules are logged to trace and skipped; engine never aborts
7. Resolve SKUs via `product_component_selectors` — first match by priority wins. Substitute `{colour}`/`{finish}`/`{frame_cap_size}` placeholders
8. Apply `product_companion_rules` — auto-add CFCs, spacers, screws, hinges, etc.
9. Evaluate `product_warnings` conditions → populate `warnings[]` (severity=warning), `errors[]` (severity=error), `assumptions[]` (severity=info)
10. Aggregate lines by SKU; tag each with originating `runId`, `segmentId`, `productCode`; split into `runResults[]` for UI
11. **Pricing stage (last, non-fatal)** — missing `pricing_rules` row produces `unitPrice=0` + warning; engine still returns the BOM
12. Strip trace + most of computed for non-admin; return

**Trace gating:** `role === 'admin'` → full `trace[]` + `computed{}`. Non-admin → `trace: []` and only `actual_height_mm` retained in `computed` (needed by `AchievedHeightBadge`).

**Graceful math.js failures:** every `mathjs.evaluate` wrapped in try/catch. Failed rule ID + error logged to trace. Pipeline continues.

See `docs/bom-calculator-pipeline.md` for the full spec.

### bom-calculator (v3 — product-agnostic)

`POST /functions/v1/bom-calculator` — accepts `{ payload: CanonicalPayload, pricingTier? }`, returns `{ lines, runResults, gateItems, totals, warnings, errors, assumptions, computed, trace?, pricingTier, generatedAt }`.

**Pipeline (all data-driven; no per-product branches):**

1. CORS + JWT → `resolveUserProfile` → `{ orgId, role, pricingTier }`
2. Validate payload via `canonicalPayloadSchema` (Zod)
3. Per unique `productCode`, load product + current rule_version + rules/constraints/selectors/companions/warnings/variables — parallelised via `Promise.all`; cached per-request
4. Normalise variables — apply `product_variables` defaults and map long colour names to short codes (e.g. `black-satin` → `B`) via a constant lookup
5. Run `product_validations` — if any `severity=error` fails, short-circuit with `{ errors, warnings, lines: [], totals: 0 }`
6. Evaluate `product_rules` in stage order (`derive` → `stock` → `accessory` → `component`) with `mathjs.evaluate(expression, ctx)`. Failed rules are logged to trace and skipped; engine never aborts
7. Resolve SKUs via `product_component_selectors` — first match by priority wins. Substitute `{colour}`/`{finish}`/`{frame_cap_size}` placeholders
8. Apply `product_companion_rules` — auto-add CFCs, spacers, screws, hinges, etc.
9. Evaluate `product_warnings` conditions → populate `warnings[]` (severity=warning), `errors[]` (severity=error), `assumptions[]` (severity=info)
10. Aggregate lines by SKU; tag each with originating `runId`, `segmentId`, `productCode`; split into `runResults[]` for UI
11. **Pricing stage (last, non-fatal)** — missing `pricing_rules` row produces `unitPrice=0` + warning; engine still returns the BOM
12. Strip trace + most of computed for non-admin; return

**Trace gating:** `role === 'admin'` → full `trace[]` + `computed{}`. Non-admin → `trace: []` and only `actual_height_mm` retained in `computed` (needed by `AchievedHeightBadge`).

**Graceful math.js failures:** every `mathjs.evaluate` wrapped in try/catch. Failed rule ID + error logged to trace. Pipeline continues.

See `docs/phase-v3-4-bom-calculator.md` for the full spec.

---

## 7. Deferred Features (v2)

**Do NOT build these:**

1. **AI Job Description Parsing** — natural language → fence config via Claude API. Requires `parse-job-description` edge function with `ANTHROPIC_API_KEY`, `useAIParse` hook, `JobDescriptionParser` component.
2. **AI BOM Review** — BOM sanity check via Claude API. Requires `review-bom` edge function, `useAIReview` hook, `BOMReviewer` component.

When v2 is ready, `FenceConfigContext` needs a `SET_CONFIG` bulk-update action for the AI parse result.

---

## 8. Canvas Layout Tool

The canvas tool is **a vanilla JS port, not a rewrite**. All drawing logic lives in `src/components/canvas/canvasEngine.ts` — pure TypeScript with no React imports. The React component (`FenceLayoutCanvas.tsx`) is a thin wrapper: mounts the `<canvas>` element via `useRef`, calls `initCanvasEngine()` in `useEffect`, and bridges toolbar/map control clicks to the engine API.

**React controls**: mounting/unmounting, toolbar button clicks (`engineRef.current?.setTool(...)`), "Use This Layout →" button (`engineRef.current?.getLayout()`), map control inputs.

**Canvas engine controls**: all drawing, mouse/touch events, internal state. Never imports React, never causes re-renders.

**Data flow**: `LayoutCanvasV3.tsx` wraps `FenceLayoutCanvas.tsx` unchanged. The toolbar is hand-coded — identical across all fencing systems. On layout change, `canvasLayoutToCanonical(layout, productCode, variables)` produces a `CanonicalPayload`. The reverse adapter `canonicalToCanvasLayout(payload)` handles quote reload. `runId` and `segmentId` are stable across round-trips — canvas, form, engine, and `quote_run_segments` all key on them.

Google Maps JS API loaded via `<script>` tag; the engine handles geocoding, tile fetching, and canvas underlay rendering.

---

## 9. UI & Theme

**Light and dark** themes: `ThemeProvider` toggles `data-theme` on `<html>`; colours come from CSS variables in `src/index.css` and Tailwind `brand-*` tokens (see `tailwind.config.js`). Full conventions: **`docs/ui-theme.md`**. Prefer `text-brand-text`, `text-brand-muted`, and form patterns from `src/components/ui/Input.tsx`—avoid raw `text-neutral-200`–`400` for copy on `brand-card` without explicit light/dark handling.

Layout: SkybrookAI branding top-left, Glass Outlet logo top-right. Accordion sections for progressive disclosure (Layout → Config → Gates → Contact → BOM).

Responsive: desktop-first. Canvas section hidden on mobile (`md:block`). BOM table horizontally scrollable on small screens.

---

## 10. Security & IP Protection Checklist

- [ ] **Move repo to private** on GitHub
- [ ] **All BOM calculation logic** in Supabase Edge Functions (never in client bundle)
- [ ] **All pricing data** in Supabase Postgres, accessed only via service role key in edge functions
- [ ] **`product_pricing` and `product_components` tables** have no RLS — revoke all access from `anon` and `authenticated` roles
- [ ] **Google Maps API key** restricted to your domain(s) in Google Cloud Console
- [ ] **Supabase anon key** only grants access to auth + quotes table (via RLS)
- [ ] **No sensitive constants** in client-side code (no margin percentages, no wholesale prices)
- [ ] **Rate limiting** on edge functions to prevent abuse
- [ ] **CORS** configured to allow only your deployment domain(s)
- [ ] **Every RLS policy** scopes by `org_id = public.user_org_id()` — no cross-org data leakage
- [ ] **Edge functions** resolve `org_id` server-side from the JWT user's profile — never trust client-sent `org_id`
- [ ] **The `public.user_org_id()` function** is `SECURITY DEFINER` and `STABLE` — verified working
- [ ] **Quote inserts** include the correct `org_id` from the user's profile, not from client input

---

## 11. Development Phases

**v1 Phases 0–7 complete** (Phase 7 included V1 code removal). **v3 Engine phases V3-1 through V3-6 complete — V3-7 (docs cross-linking) in progress.** See `docs/tasks.md`.

---

## 12. Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# Supabase secrets (set via `supabase secrets set` — NOT in .env)
# GOOGLE_MAPS_API_KEY=AIza...
# ANTHROPIC_API_KEY=sk-ant-...  (v2 only)
```

---

## 13. Key Decisions & Tradeoffs

| Decision                                             | Rationale                                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Context+useReducer over Zustand                      | Simpler dependency footprint. Upgrade to Zustand later if canvas re-renders become a problem.                        |
| Vanilla JS canvas port over react-konva              | The existing canvas tool works. A useRef+useEffect wrapper avoids rewriting ~500 lines and removes a dependency.     |
| Zod schemas shared between client and edge functions | Single source of truth for validation. Schemas are copied into `supabase/functions/_shared/` for Deno compatibility. |
| @react-pdf/renderer over jsPDF                       | JSX-based PDF templates are more maintainable. Matches the React mental model.                                       |
| All pricing server-side                              | Non-negotiable for IP protection. The client never knows wholesale costs or margin formulas.                         |
| Multi-tenant schema now                              | Adding `org_id` columns and RLS policies later requires rewriting every migration and query. Cost now: ~30 min.      |
| `public.user_org_id()` helper function                 | Centralises the org lookup. Every RLS policy calls this function — if logic changes, update one place.               |

---

## 14. Testing

**v3 Testing:** Deno unit tests at `supabase/functions/bom-calculator/index_test.ts` — fixtures (TC-V3-1 through TC-V3-8) covering rule firings, selector resolution, companion expansion, validation errors, warnings, missing pricing, and malformed rules. See `docs/bom-calculator-pipeline.md`.

v3 Cypress E2E coverage is a follow-up phase. `SchemaDrivenForm` emits `data-testid={field_key}` matching existing conventions so future selectors can be written against the `/fence-calculator` route.

**v3 Testing:** Deno unit tests at `supabase/functions/bom-calculator/index_test.ts` — 8 fixtures (TC-V3-1 through TC-V3-8) covering rule firings, selector resolution, companion expansion, validation errors, warnings, missing pricing, and malformed rules. See `docs/phase-v3-4-bom-calculator.md`.

v3 Cypress coverage is a follow-up phase. `SchemaDrivenForm` emits `data-testid={field_key}` matching existing conventions so future selectors reuse the same pattern.

---

## 15. Notes for Claude Code

- **Never put pricing numbers, margin percentages, or wholesale costs in client-side code.** Use obviously fake values (e.g. $1.00) with a `// TODO: real pricing in edge function` comment if needed during development.
- **The canvas is a vanilla JS port, not a rewrite.** `canvasEngine.ts` is pure TypeScript — no React, no JSX, no hooks. Do not refactor it using react-konva or any React canvas library.
- **Australian context**: Currency is AUD, GST is 10%, measurements are metric (mm for heights/widths, m for run lengths). Postcodes are 4 digits.
- **Colour names are Colorbond brand names** — spelled exactly as listed in Section 4. v3 `bom-calculator` normalises long names to short codes (`black-satin` → `B`) before selector resolution.
- **Multi-tenancy: every table has `org_id`.** Edge functions always scope queries by `org_id` resolved from the user's JWT. RLS policies use `public.user_org_id()`. The client never sends `org_id`.
- **Always update `docs/tasks.md` after completing any task or group of tasks.** Tick off `[x]`, update the Phases Overview table, and update the "Current Phase" header. Do this before responding to the user.
- **Current status**: All phases complete. v3 Engine phases V3-1 through V3-6 complete — V3-7 (docs cross-linking) in progress. See `docs/tasks.md`.
- **Seed data (products, pricing, components, v3 engine rules) goes in `supabase/seeds/glass-outlet/products/*.json`, never in new migration files, never as new SQL seeds.** Edit the per-product JSON files and run `npm run seed:products` (or a full `npm run db:reset`).
- **v3 rules live in seed data (JSON), not code.** To change QSHS calculation behaviour, edit `supabase/seeds/glass-outlet/products/qshs.json`. To change the shared QS_GATE, edit `qs_gate.json`. Do **not** edit `supabase/functions/bom-calculator/index.ts` unless you're changing engine framework behaviour (pipeline order, math.js safety, placeholder resolution, etc.).
- **Adding a new product = one new JSON file.** New fence → create `<system>.json` with `product_type: "fence"`. New gate → create `<gate>.json` with `product_type: "gate"` and a `compatible_with_system_types: [...]` array listing which fence system_types it pairs with. Gates do **not** live inside fence files — a shared gate can pair with multiple fences. Authoring contract: `docs/seed-data-mapping-spec.md`. Use the `seed-mapper` skill when doing this in Claude Code.
- **Products table is flat** (post migration 022). No parent/variant hierarchy — every product has `parent_id = NULL`. The `product_type` column distinguishes fences from gates from other catalog items. Older code that filtered `WHERE parent_id IS NULL` has been updated; don't reintroduce that pattern.
- **Admin trace access in v3** requires `profiles.role = 'admin'`. The seeded `admin@glass-outlet.com` / `123456` user has it. New admins: `UPDATE profiles SET role = 'admin' WHERE email = ...`.
- **Legacy routes are gone.** `/new` (v1 `MainApp`) and its edge function `calculate-bom` have been deleted. The only calculator route is `/fence-calculator` (`CalculatorV3Page` + `bom-calculator`).
- **Canonical payload** is the single JSON shape shared by v3 canvas, form, engine, and `quote_runs`/`quote_run_segments`. `runId` and `segmentId` are stable across round-trips. Do not regenerate them in adapter code — that breaks load/save. See `docs/canonical-payload.md`.

---

## 16. Local Setup (new developers)

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) — `brew install supabase/tap/supabase` (Mac) or `npx supabase` (cross-platform)
- Git

### First-time setup

```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local — run `supabase start` then `supabase status` to get the keys
npm run setup       # starts local Supabase + resets DB + seeds data
npm run dev         # → http://localhost:5173
```

Login with a seeded test account:
- `test@glass-outlet.com` / `123456` — regular user
- `admin@glass-outlet.com` / `123456` — admin (needed to see the v3 trace panel at `/fence-calculator`)

### Day-to-day commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app (http://localhost:5173) |
| `npm run build` | TypeScript check + bundle — run before committing |
| `npm run db:reset` | Reset DB to a clean seeded state |
| `supabase start` | Start the local Supabase backend |
| `supabase stop` | Stop the local Supabase backend |
| `npm run cy:open` | Open Cypress interactive test runner |

### Git workflow

**Never push directly to `master`.** Always work on a branch and open a Pull Request:

```bash
git checkout -b my-feature-branch
# ... make changes ...
git add <files>
git commit -m "describe what you changed"
git push origin my-feature-branch
# → open a PR on GitHub; wait for CI to pass and get a review before merging
```

### Troubleshooting

- **`supabase start` fails / port 54321 in use** — run `supabase stop` first, then retry
- **Port 5173 in use** — kill the existing `npm run dev` process and restart
- **`npm run setup` errors on seed step** — ensure `supabase start` completed successfully first; check `supabase status`
- **Login not working** — run `npm run db:reset` to re-seed the test user

---

## 15. Graphify Knowledge Graph

This project utilizes **Graphify** to maintain interactive, navigable knowledge graphs of the architecture and code dependencies.

* **Frontend Graph (`src/` folder)**: Located at [graphify-out-src/](file:///c:/Users/Liam/Documents/GitHub/quickscreen-colorbond-bom-generator/graphify-out-src/)
* **Backend Graph (`supabase/` folder)**: Located at [graphify-out-supabase/](file:///c:/Users/Liam/Documents/GitHub/quickscreen-colorbond-bom-generator/graphify-out-supabase/)

### Guidelines for AI Agents:
- **Query the Graph**: When asked about codebase architecture, file relationships, or cross-module call flows, use the `/graphify query "<question>"` command on the appropriate graph to perform a BFS/DFS traversal first.
- **Maintain Auto-updates**: Git hooks are installed to automatically update these graphs after commits. If significant non-code documents (like Markdown files) are changed, run `/graphify --update` to refresh the index.

