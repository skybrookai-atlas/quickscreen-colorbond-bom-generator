import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

const localFenceProducts = [
  { system_type: "QSHS", name: "QuickScreen Horizontal Slat", description: "Horizontal slats, adjustable gap" },
  { system_type: "VS", name: "Vertical Slat", description: "Clean, modern vertical look" },
  { system_type: "XPL", name: "XPress Plus Premium", description: "Premium heavy duty slats" },
  { system_type: "BAYG", name: "Buy As You Go", description: "Custom panel configurations" },
  { system_type: "DF_CCA_PAL", name: "CCA Pine Paling", description: "Traditional timber boundary" },
];

async function main() {
  const { data: dbProducts, error } = await supabase
    .from("products")
    .select("id, name, system_type, description, system_instance_id, supplier_id, suppliers(slug)")
    .eq("product_type", "fence")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total dbProducts fetched:', dbProducts?.length);

  // Deduplicate by system_type, prioritizing rows with non-null system_instance_id
  const bySystem = new Map();
  for (const p of dbProducts) {
    const existing = bySystem.get(p.system_type);
    if (!existing || (p.system_instance_id !== null && existing.system_instance_id === null)) {
      bySystem.set(p.system_type, p);
    }
  }

  const productsToRender = Array.from(bySystem.values()).map(p => ({
    system_type: p.system_type,
    name: p.name,
    description: p.description,
    system_instance_id: p.system_instance_id,
    supplier_id: p.supplier_id,
    suppliers: p.suppliers
  }));

  console.log('productsToRender:');
  console.log(JSON.stringify(productsToRender, null, 2));
}

main().catch(console.error);
