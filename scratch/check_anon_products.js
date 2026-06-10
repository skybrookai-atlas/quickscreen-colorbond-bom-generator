import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Querying products as anonymous user...");
  const { data, error } = await supabase
    .from("products")
    .select("id, name, system_type, description, system_instance_id, supplier_id, suppliers(slug)")
    .eq("product_type", "fence")
    .eq("active", true);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data.length} products:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
