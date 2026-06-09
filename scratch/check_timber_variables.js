import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('system_type', 'AF_TIMBER_PALING')
    .limit(1)
    .single();
    
  if (!product) {
    console.error('Product AF_TIMBER_PALING not found');
    return;
  }
  
  const { data: vars } = await supabase
    .from('product_variables')
    .select('name, label, data_type, required, default_value_json')
    .eq('product_id', product.id);
    
  console.log('Variables for AF_TIMBER_PALING:');
  console.log(vars);
}

run();
