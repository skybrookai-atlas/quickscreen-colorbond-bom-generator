import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('system_type', ['AF_TIMBER_PALING', 'AF_COLORBOND']);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Products:', JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
