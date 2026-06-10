import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  console.log("--- Querying as Anon User ---");
  const { data: anonData, error: anonErr } = await supabase
    .from("products")
    .select("id, name, system_type, org_id, system_instance_id, supplier_id, suppliers(slug)")
    .eq("product_type", "fence")
    .eq("active", true);

  if (anonErr) {
    console.error("Anon query failed:", anonErr);
  } else {
    console.log(`Anon user sees ${anonData.length} products:`);
    anonData.forEach(p => console.log(`  - [${p.system_type}] ${p.name} (Org: ${p.org_id.substring(0,8)}..., Inst: ${p.system_instance_id ? p.system_instance_id.substring(0,8) + '...' : 'null'}, Supplier: ${p.suppliers?.slug || 'null'})`));
  }

  console.log("\n--- Querying as Glass Outlet User (Auth Simulation) ---");
  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Let's log in as GO user to get their session
  const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'admin@glass-outlet.com',
    password: '123456',
  });

  if (loginError) {
    console.error("Login failed:", loginError.message);
    return;
  }

  const jwt = authData.session?.access_token;
  const userSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  await userSupabase.auth.setSession({
    access_token: jwt,
    refresh_token: authData.session?.refresh_token || ''
  });

  const { data: authProducts, error: authErr } = await userSupabase
    .from("products")
    .select("id, name, system_type, org_id, system_instance_id, supplier_id, suppliers(slug)")
    .eq("product_type", "fence")
    .eq("active", true);

  if (authErr) {
    console.error("Auth query failed:", authErr);
  } else {
    console.log(`Glass Outlet user sees ${authProducts.length} products:`);
    authProducts.forEach(p => console.log(`  - [${p.system_type}] ${p.name} (Org: ${p.org_id.substring(0,8)}..., Inst: ${p.system_instance_id ? p.system_instance_id.substring(0,8) + '...' : 'null'}, Supplier: ${p.suppliers?.slug || 'null'})`));
  }
}

run().catch(console.error);
