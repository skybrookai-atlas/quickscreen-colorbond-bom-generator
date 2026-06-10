import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test(systemType) {
  console.log(`\nTesting variables query for ${systemType}...`);
  
  // First, simulate query for product id
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id')
    .eq('system_type', systemType);
    
  console.log(`  - Products count:`, products ? products.length : 0);
  if (prodErr) console.error(`  - Products error:`, prodErr);

  const { data: product, error: singleErr } = await supabase
    .from('products')
    .select('id')
    .eq('system_type', systemType)
    .maybeSingle();

  if (singleErr) {
    console.error(`  - maybeSingle error:`, singleErr);
  } else {
    console.log(`  - maybeSingle success. Product:`, product);
  }
}

async function run() {
  await test('AF_TIMBER_PALING');
  await test('AF_COLORBOND');
  await test('QSHS');
}

run().catch(console.error);
