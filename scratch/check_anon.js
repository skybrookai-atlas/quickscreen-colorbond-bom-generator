import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log('Testing anonymous queries against:', process.env.VITE_SUPABASE_URL);

  const { data: instances, error: err1 } = await supabase
    .from('system_instances')
    .select('id, slug, status, visibility, readiness_status')
    .eq('slug', 'amazing-timber-paling');
  
  if (err1) {
    console.error('Error fetching system instances:', err1);
  } else {
    console.log('Anon System instances:', instances);
  }

  if (instances && instances.length > 0) {
    const instId = instances[0].id;
    
    const { data: products, error: errProd } = await supabase
      .from('products')
      .select('id, system_type, system_instance_id')
      .eq('system_instance_id', instId);
    
    if (errProd) {
      console.error('Error fetching products:', errProd);
    } else {
      console.log('Anon Products:', products);
    }

    const { data: variables, error: err2 } = await supabase
      .from('product_variables')
      .select('id, name, product_id, system_instance_id')
      .eq('system_instance_id', instId);
    
    if (err2) {
      console.error('Error fetching variables:', err2);
    } else {
      console.log('Anon Variables count:', variables.length);
    }

    const { data: components, error: err3 } = await supabase
      .from('product_components')
      .select('id, sku, canonical_code, system_instance_id')
      .eq('system_instance_id', instId);
    
    if (err3) {
      console.error('Error fetching components:', err3);
    } else {
      console.log('Anon Components count:', components.length);
      if (components.length > 0) {
        console.log('First 5 components:', components.slice(0, 5));
      }
    }
  }
}

check().catch(console.error);
