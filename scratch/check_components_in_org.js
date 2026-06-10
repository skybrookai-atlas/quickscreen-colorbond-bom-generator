import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: orgs } = await supabase.from('organisations').select('id, name, slug');
  console.log('Orgs:', orgs);
  
  for (const org of orgs || []) {
    const { count } = await supabase
      .from('product_components')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .like('sku', 'AF-%');
    console.log(`Org ${org.name} (${org.slug}) has ${count} components starting with 'AF-'`);
  }
}

run();
