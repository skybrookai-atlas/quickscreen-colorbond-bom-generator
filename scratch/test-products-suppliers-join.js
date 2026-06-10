import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing supabase URL or service role key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testJoin() {
  console.log("Testing products + suppliers join query...");
  const { data, error } = await supabase
    .from('products')
    .select('id, name, system_type, supplier_id, suppliers(slug)')
    .eq('product_type', 'fence')
    .eq('active', true)
    .limit(5);

  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Result:", JSON.stringify(data, null, 2));
  }
}

testJoin();
