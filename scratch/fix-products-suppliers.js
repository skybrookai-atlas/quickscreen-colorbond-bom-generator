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

async function fixProducts() {
  const amazingFencingSupplierId = '1aecc2bc-4b44-4676-a23a-903fe9286830';
  const glassOutletOrgId = 'f575224f-0ffa-4e1b-99ee-e7da83049efb';

  console.log("Updating AF_ products under glass-outlet org...");
  const { data, error } = await supabase
    .from('products')
    .update({ supplier_id: amazingFencingSupplierId })
    .eq('org_id', glassOutletOrgId)
    .like('system_type', 'AF_%');

  if (error) {
    console.error("Update failed:", error);
  } else {
    console.log("Update completed successfully!");
  }
}

fixProducts();
