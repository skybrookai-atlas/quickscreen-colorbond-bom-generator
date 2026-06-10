import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);


const SYSTEM_PROMPT = `You are a structured parser for an Australian fencing layout and BOM calculator tool.
Your task is to take a natural-language description of a fence installation and convert it into a structured JSON response matching the target schema.

Fencing Systems:
- "QSHS" (Quick Screen Horizontal Slats): Horizontal slats. Use this as the default if the system is described as slat, pool, boundary, aluminium screen, or similar but horizontal slats are implied.
- "VS" (Vertical Slats): Vertical slats or screen.
- "XPL" (Xpress Plus): Premium heavy-duty slat screening. Mentioned as "xpress" or "xpl".
- "BAYG" (Build As You Go): Slat screen where gaps or panel configurations are highly custom.

Color Codes:
- "B" (Black Satin / Black)
- "MN" (Monument Matt / Monument / Dark Grey / Charcoal)
- "G" (Woodland Grey Matt / Woodland Grey / WG)
- "SM" (Surfmist Matt / Surfmist)
- "W" (Pearl White Gloss / White)
- "BS" (Basalt Satin / Basalt)
- "D" (Dune Satin / Dune / Cream / Beige)
- "M" (Mill / Raw Aluminium / Unfinished)
- "P" (Primrose)
- "PB" (Paperbark)
- "S" (Palladium Silver Pearl / Silver)

Measurements:
- Convert lengths (e.g. "15m", "15 meters", "15 metres") to millimeters (15000).
- Convert heights (e.g. "1800", "1.8m", "1.8 meters") to millimeters (1800).

Confidence:
- For each parsed attribute, assign a confidence level:
  - "stated": Explicitly stated in the input text.
  - "inferred": Inferred based on words (e.g., "charcoal" -> colourCode "BS" or "MN", "l-shaped" -> cornerCount = 1).
  - "default": Missing in text, populated with a standard fallback (e.g. gap = 9, height = 1800, color = B).

Mounting Methods:
- "concreted" (in ground, posts concreted)
- "base_plated" (bolted to slab, base plates)
- "core_drilled" (core drilled)

Terminations:
- "post_post" (default, posts at both ends)
- "post_wall" (post one end, wall on other)
- "wall_wall" (walls on both ends)

Corners:
- "cornerCount": Number of corners (e.g., L-shaped has 1, U-shaped has 2, "three sides" means 2 corners).

Gates:
- Return a list of parsed gates.
- "kind": "pedestrian" (single pedestrian gate), "sliding" (sliding driveway gate), "double_swing" (double gate).
- "widthMm": width in millimeters. If not specified, default to 1000 for pedestrian, 1800 for double swing, 3000 for sliding.

Output Schema (must be valid JSON):
{
  "attributes": {
    "systemType": { "value": "QSHS" | "VS" | "XPL" | "BAYG", "confidence": "stated" | "inferred" | "default", "note": "string" },
    "runLengthMm": { "value": number, "confidence": "stated" | "inferred" | "default" },
    "heightMm": { "value": number, "confidence": "stated" | "inferred" | "default" },
    "slatSizeMm": { "value": 65 | 90, "confidence": "stated" | "inferred" | "default" },
    "gapMm": { "value": 5 | 9 | 20, "confidence": "stated" | "inferred" | "default" },
    "colourCode": { "value": "B" | "MN" | "G" | "SM" | "W" | "BS" | "D" | "M" | "P" | "PB" | "S", "confidence": "stated" | "inferred" | "default" },
    "mountingMethod": { "value": "concreted" | "base_plated" | "core_drilled", "confidence": "stated" | "inferred" | "default" },
    "termination": { "value": "post_post" | "post_wall" | "wall_wall", "confidence": "stated" | "inferred" | "default" },
    "cornerCount": { "value": number, "confidence": "stated" | "inferred" | "default" },
    "gates": {
      "value": [
        { "kind": "pedestrian" | "sliding" | "double_swing", "widthMm": number }
      ],
      "confidence": "stated" | "inferred" | "default"
    }
  },
  "unparsed": ["any terms/words that were not understood"]
}
`;

async function testParse(description) {
  console.log(`\n--- Calling Edge Function for: "${description}" ---`);
  try {
    const { data, error } = await supabase.functions.invoke('parse-job-description', {
      body: { description }
    });
    if (error) {
      console.error('Edge Function Error:', error);
      const text = await error.context.text();
      console.error('Response Text:', text);
    } else {
      console.log('Edge Function Success Response:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error(`Error:`, e.message);
  }
}

async function main() {
  await testParse("12m Monument vertical slats at 1.8m high with one gate");
  await testParse("30m QSHS fence 1.5m high, Monument Matt, 9mm gap, with one pedestrian gate");
}

main().catch(console.error);
