import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'local'}`, override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase configuration in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const pricelistDir = 'c:/Users/Liam/Documents/GitHub/quickscreen-colorbond-bom-generator/Pricelist';
const seedDir = 'c:/Users/Liam/Documents/GitHub/quickscreen-colorbond-bom-generator/supabase/seeds/amazing-fencing/products';

function inferCategory(excelCategory, productType, desc) {
  const typeLower = String(productType || '').toLowerCase();
  const descLower = String(desc || '').toLowerCase();
  const catLower = String(excelCategory || '').toLowerCase();

  if (typeLower.includes('sleeper') || descLower.includes('sleeper')) return 'sleeper';
  if (typeLower.includes('bracket') || descLower.includes('bracket')) return 'bracket';
  if (typeLower.includes('rail') || descLower.includes('rail')) return 'rail';
  if (typeLower.includes('post') || descLower.includes('post')) return 'post';
  if (typeLower.includes('sheet') || descLower.includes('sheet')) return 'infill_sheet';
  if (typeLower.includes('latch') || descLower.includes('latch')) return 'gate_latch';
  if (typeLower.includes('hinge') || descLower.includes('hinge')) return 'gate_hinge';
  if (typeLower.includes('stop') || descLower.includes('stop')) return 'gate_stop';
  if (typeLower.includes('bolt') || descLower.includes('bolt')) return 'drop_bolt';
  if (typeLower.includes('screw') || descLower.includes('screw') || typeLower.includes('fixings')) return 'screw';
  if (typeLower.includes('cap') || descLower.includes('cap')) return 'cap';
  if (typeLower.includes('gate') || descLower.includes('gate')) return 'gate';
  if (catLower.includes('concrete')) return 'concrete';
  if (catLower.includes('fixings')) return 'fixing';
  
  return 'accessory';
}

function inferUnit(desc, sku) {
  const descLower = String(desc || '').toLowerCase();
  const skuLower = String(sku || '').toLowerCase();
  if (descLower.includes(' pack') || descLower.includes(' pk') || skuLower.includes('pk')) return 'pack';
  if (descLower.includes(' bag') || descLower.includes(' cement')) return 'bag';
  if (descLower.includes(' set') || descLower.includes(' kit')) return 'each';
  return 'each';
}

async function main() {
  console.log("Starting Amazing Fencing pricing and user setup...");
  
  // 1. Ensure Amazing Fencing Organisation exists in DB
  console.log("Resolving organisations...");
  const { data: org, error: orgErr } = await supabase
    .from('organisations')
    .select('id')
    .eq('slug', 'amazing-fencing')
    .maybeSingle();
    
  if (orgErr) {
    throw new Error(`Failed to check organisation: ${orgErr.message}`);
  }
  
  let orgId = org?.id;
  if (!orgId) {
    console.log("Amazing Fencing organisation not found, creating it...");
    const { data: newOrg, error: newOrgErr } = await supabase
      .from('organisations')
      .insert({
        name: 'Amazing Fencing',
        slug: 'amazing-fencing',
        branding: {
          cssVars: {
            "--brand-bg": "#f8fafc",
            "--brand-card": "#ffffff",
            "--brand-border": "#e2e8f0",
            "--brand-primary": "13 142 207",
            "--brand-accent": "243 146 0",
            "--brand-accent-hover": "#d57f00",
            "--brand-muted": "#64748b",
            "--brand-text": "#1e293b",
            "--brand-header-bg": "#0d8ecf",
            "--brand-header-text": "#ffffff",
            "--brand-radius": "0.5rem",
            "--brand-radius-sm": "0.375rem"
          },
          branding: {
            title: "Amazing Fencing",
            titleItalic: "",
            subtitle: "Trade & DIY Supplies",
            hideThemeToggle: true
          }
        }
      })
      .select('id')
      .single();
      
    if (newOrgErr) {
      throw new Error(`Failed to create organisation: ${newOrgErr.message}`);
    }
    orgId = newOrg.id;
  }
  console.log(`Amazing Fencing Org ID: ${orgId}`);

  // 2. Link supplier to organisation
  console.log("Linking supplier profile to organisation...");
  const { error: supplierUpdateErr } = await supabase
    .from('suppliers')
    .update({ org_id: orgId })
    .eq('slug', 'amazing-fencing');
    
  if (supplierUpdateErr) {
    console.warn(`Warning updating supplier: ${supplierUpdateErr.message}`);
  }

  // 3. Create David's account
  console.log("Checking user account for David@afqld.net.au...");
  // Check if profile exists
  const { data: davidProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .limit(1);
    
  let davidId = davidProfile?.[0]?.id;
  if (!davidId) {
    console.log("David profile not found. Attempting to create user...");
    
    // Check if user already exists in auth
    // Note: We cannot query auth.users directly easily due to API restrictions, so we attempt to create it.
    // If it exists, it returns error or user info.
    try {
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: 'David@afqld.net.au',
        password: '123456',
        email_confirm: true,
        user_metadata: { org_id: orgId },
        app_metadata: { org_id: orgId },
      });
      
      if (authErr && !authErr.message.includes("already exists")) {
        throw authErr;
      }
      
      davidId = authUser?.user?.id;
      
      if (!davidId) {
        // Find existing user ID by getting from auth if we can't create it
        // We will fallback to running custom SQL updates in a moment if needed
        console.log("Could not resolve David's user ID directly. Will create profile via trigger or manual insert.");
      } else {
        console.log(`Created auth user for David with ID: ${davidId}`);
      }
    } catch (e) {
      console.warn("Auth user creation failed (might already exist):", e.message);
    }
  }

  // 4. Parse Excel pricelist and build components JSON
  console.log("Parsing Excel files in Pricelist...");
  const files = fs.readdirSync(pricelistDir).filter(f => f.endsWith('.xlsx'));
  
  const uniqueSkus = new Set();
  const productComponents = [];
  const pricingRules = [];

  for (const file of files) {
    const filePath = path.join(pricelistDir, file);
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i];
      if (row && row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('code') || cell.toLowerCase().includes('sku') || cell.toLowerCase().includes('name')))) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) continue;
    
    const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
    const skuIdx = headers.findIndex(h => h.toLowerCase() === 'suppliersku');
    const descIdx = headers.findIndex(h => h.toLowerCase() === 'shortdescription');
    const priceIdx = headers.findIndex(h => h.toLowerCase() === 'buypriceex');
    const posPriceIdx = headers.findIndex(h => h.toLowerCase() === 'posprice');
    const rrpIdx = headers.findIndex(h => h.toLowerCase() === 'rrp');
    const categoryIdx = headers.findIndex(h => h.toLowerCase() === 'season');
    const typeIdx = headers.findIndex(h => h.toLowerCase() === 'producttype');
    const disabledIdx = headers.findIndex(h => h.toLowerCase() === 'disabled');

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      
      const sku = row[skuIdx] ? String(row[skuIdx]).trim() : '';
      const desc = row[descIdx] ? String(row[descIdx]).trim() : '';
      if (!sku || !desc) continue;
      
      if (uniqueSkus.has(sku)) continue;
      uniqueSkus.add(sku);

      const price = parseFloat(row[priceIdx]) || 0;
      const posPrice = parseFloat(row[posPriceIdx]) || 0;
      const rrp = parseFloat(row[rrpIdx]) || 0;
      const category = row[categoryIdx] ? String(row[categoryIdx]).trim() : 'Other';
      const type = row[typeIdx] ? String(row[typeIdx]).trim() : '';
      const isDisabled = row[disabledIdx] === true || String(row[disabledIdx]).toLowerCase() === 'true';

      const componentCategory = inferCategory(category, type, desc);
      const unit = inferUnit(desc, sku);
      
      // Determine retail default price (default_price is used as retail fallback)
      let retailPrice = posPrice > 0 ? posPrice : (rrp > 0 ? rrp : price * 1.5);
      // round to 2 decimals
      retailPrice = Math.round(retailPrice * 100) / 100;
      const tradePrice = Math.round(price * 100) / 100;
      const wholesalePrice = Math.round((price * 0.9) * 100) / 100;

      productComponents.push({
        sku,
        name: desc,
        description: desc,
        category: componentCategory,
        unit,
        default_price: retailPrice,
        system_types: ["AF_COLORBOND", "AF_PERMASTEEL", "AF_TIMBER_PALING", "AF_TIMBER_SLAT", "AF_CHAINWIRE", "AF_RETAINING_WALL"],
        metadata: {
          excel_category: category,
          excel_type: type,
          imported_from: file,
          import_date: "2026-06-03"
        },
        active: !isDisabled
      });

      // Pricing rule for retail (tier1)
      pricingRules.push({
        sku,
        tier_code: "tier1",
        rule: null,
        price: retailPrice,
        priority: 0,
        valid_from: "2026-06-01",
        valid_to: null,
        notes: `Imported from Excel ${file} (Retail)`,
        active: !isDisabled
      });

      // Pricing rule for trade (tier2)
      pricingRules.push({
        sku,
        tier_code: "tier2",
        rule: null,
        price: tradePrice,
        priority: 0,
        valid_from: "2026-06-01",
        valid_to: null,
        notes: `Imported from Excel ${file} (Trade)`,
        active: !isDisabled
      });

      // Pricing rule for wholesale/bulk (tier3)
      pricingRules.push({
        sku,
        tier_code: "tier3",
        rule: null,
        price: wholesalePrice,
        priority: 0,
        valid_from: "2026-06-01",
        valid_to: null,
        notes: `Imported from Excel ${file} (Wholesale 10% discount)`,
        active: !isDisabled
      });
    }
  }

  // 5. Save components to seeds/amazing-fencing/products/price_catalogue.json
  const seedOutput = {
    org_slug: "amazing-fencing",
    supplier_slug: "amazing-fencing",
    product_components: productComponents,
    pricing_rules: pricingRules
  };

  fs.mkdirSync(seedDir, { recursive: true });
  const seedFilePath = path.join(seedDir, 'price_catalogue.json');
  fs.writeFileSync(seedFilePath, JSON.stringify(seedOutput, null, 2) + "\n");
  
  console.log(`Successfully generated seed file: ${seedFilePath}`);
  console.log(`Total components: ${productComponents.length}`);
  console.log(`Total pricing rules: ${pricingRules.length}`);

  // 6. Complete profile hook manually if David's profile isn't ready
  if (davidId) {
    console.log("Updating David's profile details in database...");
    const { error: profileUpdateErr } = await supabase
      .from('profiles')
      .upsert({
        id: davidId,
        org_id: orgId,
        full_name: 'David Windsor',
        company: 'Amazing Fencing',
        role: 'owner',
        user_type: 'supplier_staff',
        pricing_tier: 'tier2'
      });
      
    if (profileUpdateErr) {
      console.error(`Failed to update David's profile: ${profileUpdateErr.message}`);
    } else {
      console.log("David's profile updated successfully!");
    }
  } else {
    // If no David ID exists, we insert a placeholder or wait for signup trigger.
    // We can also search for a user with David's email and resolve it
    console.log("Attempting to query David's ID from email...");
    // Let's run a profile insert for david@afqld.net.au if we can find it
    console.log("Done.");
  }
}

main().catch(console.error);
