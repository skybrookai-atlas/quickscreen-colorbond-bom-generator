import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  console.log("Logging in as admin@glass-outlet.com...");
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

  async function test(systemType) {
    console.log(`\nTesting variables query for ${systemType} as logged-in user...`);
    
    // First, select count of visible products
    const { data: products } = await userSupabase
      .from('products')
      .select('id')
      .eq('system_type', systemType);
      
    console.log(`  - Products count:`, products ? products.length : 0);

    const { data: product, error: singleErr } = await userSupabase
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

  await test('AF_TIMBER_PALING');
  await test('AF_COLORBOND');
  await test('QSHS');
}

run().catch(console.error);
