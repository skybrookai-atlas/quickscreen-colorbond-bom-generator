import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSystem(systemType) {
  console.log(`\n================== Checking ${systemType} ==================`);
  
  // Find products
  const { data: products } = await supabase
    .from('products')
    .select('id, org_id, supplier_id, name')
    .eq('system_type', systemType);
    
  console.log('Products found:', products);
  
  for (const p of products || []) {
    console.log(`\nChecking data for Product ID ${p.id} (Org: ${p.org_id})`);
    
    // Check rule sets
    const { data: ruleSets } = await supabase
      .from('rule_sets')
      .select('id, name')
      .eq('product_id', p.id);
    console.log('  Rule Sets:', ruleSets);
    
    for (const rs of ruleSets || []) {
      // Check rule versions
      const { data: ruleVersions } = await supabase
        .from('rule_versions')
        .select('id, version_label, is_current')
        .eq('rule_set_id', rs.id);
      console.log(`    Rule Versions for Set ${rs.name}:`, ruleVersions);
      
      for (const rv of ruleVersions || []) {
        // Check rules count
        const { count: rulesCount } = await supabase
          .from('product_rules')
          .select('*', { count: 'exact', head: true })
          .eq('version_id', rv.id);
        console.log(`      Rules Count for Version ${rv.version_label}:`, rulesCount);
      }
    }
    
    // Check component selectors count
    const { count: selectorsCount } = await supabase
      .from('product_component_selectors')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', p.id);
    console.log('  Selectors Count:', selectorsCount);
    
    // Check product variables count
    const { count: variablesCount } = await supabase
      .from('product_variables')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', p.id);
    console.log('  Variables Count:', variablesCount);
  }
}

async function run() {
  await checkSystem('AF_TIMBER_PALING');
  await checkSystem('AF_COLORBOND');
}

run();
