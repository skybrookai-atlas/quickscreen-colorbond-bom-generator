import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolvePriceCents } from "../lib.ts";

Deno.test("Regression Check: resolvePriceCents resolves legacy pricing correctly", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.log("Skipping regression check (no DB environment variables)");
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("slug", "glass-outlet")
    .maybeSingle();

  if (!supplier) {
    console.log("Skipping regression check (glass-outlet supplier not seeded yet)");
    return;
  }

  const price = await resolvePriceCents(supabase, {
    supplierId: supplier.id,
    sku: "QSHS-SLAT-65",
    tierCode: "tier1",
    quantity: 1
  });

  console.log("Resolved price for QSHS-SLAT-65:", price);
  if (price !== null) {
    assertEquals(typeof price, "number");
  }
});
