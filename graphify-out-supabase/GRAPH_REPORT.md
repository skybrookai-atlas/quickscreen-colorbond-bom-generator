# Graph Report - .  (2026-06-08)

## Corpus Check
- Large corpus: 142 files · ~1,906,648 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 181 nodes · 47 edges · 153 communities (118 shown, 35 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_BOM Calculator Edge Function Engine|BOM Calculator Edge Function Engine]]
- [[_COMMUNITY_Edge Functions Auth & Transport Framework|Edge Functions Auth & Transport Framework]]
- [[_COMMUNITY_Pricing Logic & Validation Tests|Pricing Logic & Validation Tests]]
- [[_COMMUNITY_Canonical Layout Segments & Definitions|Canonical Layout Segments & Definitions]]
- [[_COMMUNITY_BOM Engine Integration Tests|BOM Engine Integration Tests]]
- [[_COMMUNITY_Pricing DB Rules Helper|Pricing DB Rules Helper]]
- [[_COMMUNITY_Symbol assertFixture|Symbol: assertFixture]]
- [[_COMMUNITY_Symbol assertQty|Symbol: assertQty]]
- [[_COMMUNITY_Symbol Fixture|Symbol: Fixture]]
- [[_COMMUNITY_Symbol FixtureExpect|Symbol: FixtureExpect]]
- [[_COMMUNITY_Symbol LineItem|Symbol: LineItem]]
- [[_COMMUNITY_Symbol loadFixtures|Symbol: loadFixtures]]
- [[_COMMUNITY_Symbol QtyAssertion|Symbol: QtyAssertion]]
- [[_COMMUNITY_Symbol equalStrings|Symbol: equalStrings]]
- [[_COMMUNITY_Symbol PricingContext|Symbol: PricingContext]]
- [[_COMMUNITY_Symbol AgentResponseChunk|Symbol: AgentResponseChunk]]
- [[_COMMUNITY_Symbol SegmentKind|Symbol: SegmentKind]]
- [[_COMMUNITY_Symbol patchSegmentVariables|Symbol: patchSegmentVariables]]
- [[_COMMUNITY_Symbol BOMCategory|Symbol: BOMCategory]]
- [[_COMMUNITY_Symbol BOMResult|Symbol: BOMResult]]
- [[_COMMUNITY_Symbol CalculatorBOMResult|Symbol: CalculatorBOMResult]]
- [[_COMMUNITY_Symbol CalculatorRequest|Symbol: CalculatorRequest]]
- [[_COMMUNITY_Symbol Colour|Symbol: Colour]]
- [[_COMMUNITY_Symbol FenceConfig|Symbol: FenceConfig]]
- [[_COMMUNITY_Symbol GateConfig|Symbol: GateConfig]]
- [[_COMMUNITY_Symbol GatePostSize|Symbol: GatePostSize]]
- [[_COMMUNITY_Symbol GateType|Symbol: GateType]]
- [[_COMMUNITY_Symbol HingeType|Symbol: HingeType]]
- [[_COMMUNITY_Symbol LatchType|Symbol: LatchType]]
- [[_COMMUNITY_Symbol MaxPanelWidth|Symbol: MaxPanelWidth]]
- [[_COMMUNITY_Symbol PostMounting|Symbol: PostMounting]]
- [[_COMMUNITY_Symbol RunInput|Symbol: RunInput]]
- [[_COMMUNITY_Symbol SegmentDiagnostic|Symbol: SegmentDiagnostic]]
- [[_COMMUNITY_Symbol SlatGap|Symbol: SlatGap]]
- [[_COMMUNITY_Symbol SlatSize|Symbol: SlatSize]]
- [[_COMMUNITY_Symbol SystemType|Symbol: SystemType]]
- [[_COMMUNITY_Symbol Termination|Symbol: Termination]]

## God Nodes (most connected - your core abstractions)
1. `extractJwt` - 4 edges
2. `handleCors` - 4 edges
3. `PricingRule` - 4 edges
4. `resolveUserProfile` - 3 edges
5. `resolvePriceCents` - 3 edges
6. `CanonicalRun` - 2 edges
7. `CanonicalSegment` - 2 edges
8. `walkRunForPosts` - 2 edges
9. `PricingTier` - 2 edges
10. `runFixtures` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (153 total, 35 thin omitted)

### Community 0 - "BOM Calculator Edge Function Engine"
Cohesion: 0.22
Nodes (11): EngineData, generateCanonicalCode, matchesJSON, normaliseVariables, resolvePlaceholders, resolvePrice, stocks, CanonicalPayload (+3 more)

### Community 1 - "Edge Functions Auth & Transport Framework"
Cohesion: 0.24
Nodes (8): AgentContext, AgentTransport, MockAgentTransport, extractJwt, resolveUserProfile, handleCors, BOMLineItem, PricingTier

## Knowledge Gaps
- **39 isolated node(s):** `CanonicalPayload`, `SegmentTermination`, `SegmentKind`, `patchSegmentVariables`, `SystemType` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `extractJwt` connect `Edge Functions Auth & Transport Framework` to `BOM Calculator Edge Function Engine`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `handleCors` connect `Edge Functions Auth & Transport Framework` to `BOM Calculator Edge Function Engine`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `PricingRule` connect `Pricing DB Rules Helper` to `BOM Calculator Edge Function Engine`, `Edge Functions Auth & Transport Framework`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `CanonicalPayload`, `SegmentTermination`, `SegmentKind` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._