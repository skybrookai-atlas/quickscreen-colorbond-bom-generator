import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { extractJwt, resolveUserProfile } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const SYSTEM_PROMPT = `You are a structured parser for an Australian fencing layout and BOM calculator tool.
Your task is to take a natural-language description of a fence installation and convert it into a structured JSON response matching the target schema.

Fencing Systems:
- "QSHS" (Quick Screen Horizontal Slats): Horizontal slats. Use this as the default if the system is described as slat, pool, boundary, aluminium screen, or similar but horizontal slats are implied.
- "VS" (Vertical Slats): Vertical slats or screen.
- "XPL" (Xpress Plus): Premium heavy-duty slat screening. Mentioned as "xpress" or "xpl".
- "BAYG" (Build As You Go): Slat screen where gaps or panel configurations are highly custom.
- "AF_TIMBER_PALING" (Timber Paling): Timber boundary fence. Mentioned as "timber", "wood", "pine", "hardwood", "paling", "lapped & capped".
- "AF_COLORBOND" (Colorbond): Sheet steel boundary fence. Mentioned as "colorbond", "colourbond", "sheet steel", "steel fence".
- "AF_RETAINING_WALL" (Retaining Wall): Retaining wall structure. Mentioned as "retaining wall", "sleeper wall", "sleepers".

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
    "systemType": { "value": "QSHS" | "VS" | "XPL" | "BAYG" | "AF_TIMBER_PALING" | "AF_COLORBOND" | "AF_RETAINING_WALL", "confidence": "stated" | "inferred" | "default", "note": "string" },
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

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Verify authentication
    const jwt = extractJwt(req);
    await resolveUserProfile(jwt);

    const body = await req.json();
    const { description } = body;

    if (!description || typeof description !== "string") {
      throw new Error("Missing description string in request body");
    }

    if (!GEMINI_API_KEY) {
      throw new Error("Server configuration error: GEMINI_API_KEY is not set.");
    }

    // Call Gemini API via native Deno fetch
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${SYSTEM_PROMPT}\n\nParse this fence description and return JSON matching the schema:\n"${description}"`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      throw new Error("No response generated by Gemini model.");
    }

    // Parse the JSON output from the model
    const parsedData = JSON.parse(textOutput.trim());

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
