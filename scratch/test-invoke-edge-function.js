import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  const payload = {
    productCode: "AF_TIMBER_PALING",
    schemaVersion: "v1",
    variables: {
      supplier_id: "1aecc2bc-4b44-4676-a23a-903fe9286830",
      supplier_slug: "amazing-fencing",
      system_instance_id: "5e0f093f-3ae1-4c5c-bedb-a49c782681a1",
      timber_type: "treated_pine",
      paling_style: "butted",
      post_fixing_material_sku: "AF-CON-RAPID-30"
    },
    runs: [
      {
        runId: "test-run-id",
        productCode: "AF_TIMBER_PALING",
        variables: {
          timber_type: "treated_pine",
          paling_style: "butted"
        },
        leftBoundary: { type: "product_post" },
        rightBoundary: { type: "product_post" },
        segments: [
          {
            segmentId: "test-segment-id",
            sortOrder: 1,
            segmentKind: "panel",
            kind: "fence",
            segmentWidthMm: 5000,
            targetHeightMm: 1800,
            productCode: "AF_TIMBER_PALING"
          }
        ],
        corners: []
      }
    ]
  };

  console.log('Invoking bom-calculator edge function on remote...');
  const { data, error } = await supabase.functions.invoke('bom-calculator', {
    body: { payload, pricingTier: 'tier1', supplierSlug: 'amazing-fencing' }
  });

  if (error) {
    console.error('Edge Function Error:', error);
    try {
      const errText = await error.context.text();
      console.error('Error Body:', errText);
    } catch (e) {
      console.error('Could not read error body:', e.message);
    }
  } else {
    console.log('Edge Function Success Response:', JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
