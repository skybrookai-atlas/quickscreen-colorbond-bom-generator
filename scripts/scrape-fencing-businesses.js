import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env.local or .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const API_KEY = process.env.VITE_GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_KEY;

if (!API_KEY) {
  console.error("❌ ERROR: VITE_GOOGLE_MAPS_KEY is not defined in your environment.");
  console.log("Please define VITE_GOOGLE_MAPS_KEY in .env.local or run the script passing it:");
  console.log("GOOGLE_MAPS_KEY=your_key node scripts/scrape-fencing-businesses.js\n");
  process.exit(1);
}

// Towns/Regions along the coast between Coffs Harbour and Noosa
const TOWNS = [
  "Coffs Harbour, NSW",
  "Grafton, NSW",
  "Yamba, NSW",
  "Lismore, NSW",
  "Ballina, NSW",
  "Byron Bay, NSW",
  "Mullumbimby, NSW",
  "Ocean Shores, NSW",
  "Kingscliff, NSW",
  "Tweed Heads, NSW",
  "Gold Coast, QLD",
  "Brisbane, QLD",
  "Sunshine Coast, QLD",
  "Noosa, QLD"
];

// Search queries to execute in each region
const QUERY_TEMPLATES = [
  "fencing contractor",
  "fencing supplies"
];

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Google Favicon service fetches high-quality logos for domains
function getLogoFromUrl(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    const url = new URL(websiteUrl);
    return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url.origin)}&size=128`;
  } catch {
    return null;
  }
}

// Classify fencing types based on name, reviews, and editorial summary keywords
function classifyFencingTypes(business) {
  const contentToScan = [
    business.name,
    business.editorial_summary || "",
    ...(business.reviews || []).map(r => r.text || ""),
    ...(business.types || [])
  ].join(" ").toLowerCase();

  const capabilities = [];

  if (/colorbond|colourbond|steel|bluescope|metal panel/i.test(contentToScan)) {
    capabilities.push("colorbond");
  }
  if (/timber|paling|wood|pine|hardwood|colonial|paling|sleeper/i.test(contentToScan)) {
    capabilities.push("timber");
  }
  if (/glass|frameless|semi-frameless/i.test(contentToScan)) {
    capabilities.push("glass_pool");
  }
  if (/pool|tubular|compliance|as\s?1926/i.test(contentToScan)) {
    capabilities.push("aluminium_pool");
  }
  if (/slat|screen|horizontal slat|privacy screen|spacer/i.test(contentToScan)) {
    capabilities.push("slats");
  }
  if (/security|chain|wire|mesh|weldmesh|commercial/i.test(contentToScan)) {
    capabilities.push("security");
  }
  if (/retaining|sleeper|h4/i.test(contentToScan)) {
    capabilities.push("retaining_walls");
  }

  // Fallbacks if no keywords are matched
  if (capabilities.length === 0) {
    capabilities.push("colorbond", "timber"); // standard defaults
  }

  return capabilities;
}

// Classify business type: contractor, supplier, or hybrid
function classifyEntityType(business) {
  const name = business.name.toLowerCase();
  const types = (business.types || []).map(t => t.toLowerCase());

  const isSupplierWord = /suppl|outlet|wholesale|distrib|timber yard|hardware|manufacturer/i.test(name);
  const isSupplierType = types.some(t => /store|wholesaler|manufacturer/i.test(t));

  const isContractorWord = /install|contractor|construct|builder|fencing solutions/i.test(name);

  if (isSupplierWord || isSupplierType) {
    return isContractorWord ? "hybrid" : "supplier";
  }
  return "contractor";
}

async function searchPlaces(query, town) {
  const searchQuery = `${query} in ${town}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status === "OK") {
      return data.results || [];
    } else if (data.status === "ZERO_RESULTS") {
      return [];
    } else {
      console.warn(`⚠️ Google Places API returned status: ${data.status} for "${searchQuery}"`);
      return [];
    }
  } catch (err) {
    console.error(`❌ Fetch error searching places for "${searchQuery}":`, err);
    return [];
  }
}

async function fetchPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,geometry,rating,user_ratings_total,reviews,types,editorial_summary&key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK") {
      return data.result;
    }
    return null;
  } catch (err) {
    console.error(`❌ Fetch error getting details for place ID ${placeId}:`, err);
    return null;
  }
}

async function main() {
  console.log("🚀 Starting Google Maps Fencing Business Scraper...");
  console.log(`📍 Regions to search: ${TOWNS.length} towns from Coffs Harbour to Noosa`);
  console.log(`🔍 Query categories: ${QUERY_TEMPLATES.join(" & ")}\n`);

  const uniquePlacesMap = new Map();

  // 1. Gather all places across regions and query templates
  for (const town of TOWNS) {
    console.log(`🏙️ Searching in ${town}...`);
    for (const template of QUERY_TEMPLATES) {
      const results = await searchPlaces(template, town);
      for (const place of results) {
        if (!uniquePlacesMap.has(place.place_id)) {
          uniquePlacesMap.set(place.place_id, {
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry?.location,
            types: place.types,
            region_found: town
          });
        }
      }
      // Rate limiting respect
      await delay(150);
    }
  }

  const foundPlaces = Array.from(uniquePlacesMap.values());
  console.log(`\n🎉 Found ${foundPlaces.length} unique fencing businesses. Fetching details & classifying...`);

  const results = [];
  let index = 1;

  // 2. Fetch Place details for classification & contact details
  for (const place of foundPlaces) {
    console.log(`[${index++}/${foundPlaces.length}] Retrieving details for: ${place.name}...`);
    const details = await fetchPlaceDetails(place.place_id);
    
    if (details) {
      const website = details.website || null;
      const logoUrl = getLogoFromUrl(website);
      const capabilities = classifyFencingTypes(details);
      const entityType = classifyEntityType(details);

      results.push({
        place_id: place.place_id,
        name: details.name,
        address: details.formatted_address,
        phone: details.formatted_phone_number || null,
        website: website,
        logo_url: logoUrl,
        coordinates: {
          lat: details.geometry?.location?.lat || place.location?.lat,
          lng: details.geometry?.location?.lng || place.location?.lng
        },
        rating: details.rating || null,
        reviews_count: details.user_ratings_total || 0,
        business_type: entityType, // contractor, supplier, hybrid
        capabilities: capabilities, // colorbond, timber, glass_pool, slats, pool, etc.
        regions_served: [place.region_found]
      });
    }

    // Rate limiting respect
    await delay(200);
  }

  // 3. Save output to file
  const outDir = path.resolve("scratch");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, "scraped-fencing-businesses.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log("\n✅ SCRAPING COMPLETE!");
  console.log(`💾 Scraped business records written to: ${outputPath}`);
  console.log(`📊 Statistics:`);
  console.log(`   - Total Businesses: ${results.length}`);
  console.log(`   - Contractors: ${results.filter(r => r.business_type === "contractor").length}`);
  console.log(`   - Suppliers: ${results.filter(r => r.business_type === "supplier").length}`);
  console.log(`   - Hybrids: ${results.filter(r => r.business_type === "hybrid").length}`);
  console.log(`\nReady to import into Supabase.`);
}

main().catch(console.error);
