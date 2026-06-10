import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolvePriceCents } from "../lib.ts";

Deno.test("resolvePriceCents: successfully calls resolve_price_cents rpc", async () => {
  const mockSupabase = {
    rpc: (fnName: string, params: any) => {
      assertEquals(fnName, "resolve_price_cents");
      assertEquals(params.p_sku, "TEST-SKU");
      assertEquals(params.p_supplier_id, "supplier-uuid-1");
      return Promise.resolve({ data: 1550, error: null });
    }
  } as any;

  const price = await resolvePriceCents(mockSupabase, {
    supplierId: "supplier-uuid-1",
    sku: "TEST-SKU",
    tierCode: "tier1",
    quantity: 5,
    atTime: "2026-06-08T00:00:00Z"
  });

  assertEquals(price, 1550);
});

Deno.test("resolvePriceCents: returns null on missing price", async () => {
  const mockSupabase = {
    rpc: () => Promise.resolve({ data: null, error: null })
  } as any;

  const price = await resolvePriceCents(mockSupabase, {
    supplierId: "supplier-uuid-1",
    sku: "MISSING-SKU",
    tierCode: "tier1",
    quantity: 1
  });

  assertEquals(price, null);
});
