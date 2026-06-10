import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const payload = {
  "productCode": "AF_TIMBER_PALING",
  "schemaVersion": "v1",
  "variables": {
    "timber_type": "treated_pine",
    "paling_style": "butted",
    "post_spacing_mm": 2400,
    "paling_gap_mm": 0,
    "rail_profile": "75x38"
  },
  "runs": [
    {
      "runId": "run-amazing-timber-1",
      "productCode": "AF_TIMBER_PALING",
      "variables": {
        "timber_type": "treated_pine",
        "paling_style": "butted",
        "post_spacing_mm": 2400,
        "paling_gap_mm": 0,
        "rail_profile": "75x38"
      },
      "leftBoundary": { "type": "product_post" },
      "rightBoundary": { "type": "product_post" },
      "segments": [
        {
          "segmentId": "seg-amazing-timber-1",
          "sortOrder": 1,
          "kind": "fence",
          "segmentKind": "panel",
          "productCode": "AF_TIMBER_PALING",
          "segmentWidthMm": 12000,
          "targetHeightMm": 1200,
          "leftTermination": { "kind": "system" },
          "rightTermination": { "kind": "system" },
          "variables": {
            "target_height_mm": 1200
          }
        }
      ],
      "corners": []
    }
  ]
};

async function test() {
  const supabase = createClient(supabaseUrl, anonKey);
  console.log("Logging in...");
  const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'admin@glass-outlet.com',
    password: '123456',
  });

  if (loginError) {
    console.error("Login failed:", loginError.message);
    process.exit(1);
  }

  const jwt = authData.session?.access_token;
  const url = `${supabaseUrl}/functions/v1/bom-calculator`;
  console.log(`Calling ${url} with supplierSlug: 'glass-outlet'...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({
      payload,
      pricingTier: 'tier2',
      supplierSlug: 'glass-outlet',
      debug: true
    })
  });

  const resText = await response.text();
  console.log(`Status: ${response.status}`);
  try {
    const data = JSON.parse(resText);
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.log(resText);
  }
}

test();
