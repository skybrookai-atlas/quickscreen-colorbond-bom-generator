import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, system_type, active, system_instance_id, supplier_id');

  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log('Fetched products (count =', data?.length, '):');
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
