// amazingFencingMapper.ts
// Maps canonical product names to Amazing Fencing SKUs and prices (ex-GST)

export interface MappedItem {
  sku: string;
  priceExGst: number;
}

// Cin7 tier-2 trade pricing snapshot (May 2026) for Amazing Fencing
const AMAZING_FENCING_CATALOG: Record<string, MappedItem> = {
  // Posts
  "100x75 Treated Pine Post H4 2400mm": { sku: "CCAH4PST-100-75-2400", priceExGst: 39.00 },
  "100x75 Treated Pine Post 2400mm": { sku: "CCAH4PST-100-75-2400", priceExGst: 39.00 },
  "100x75 Treated Pine Post H4 1800mm": { sku: "CCAH4PST-100-75-1800", priceExGst: 29.25 },
  "100x75 Treated Pine Post 1800mm": { sku: "CCAH4PST-100-75-1800", priceExGst: 29.25 },
  "100x75 Treated Pine Post H4 3000mm": { sku: "CCAH4PST-100-75-3000", priceExGst: 48.75 },
  "100x75 Treated Pine Post 3000mm": { sku: "CCAH4PST-100-75-3000", priceExGst: 48.75 },

  "100x100 Treated Pine Post H4 2400mm": { sku: "CCAH4PST-100-100-2400", priceExGst: 52.00 },
  "100x100 Treated Pine Post 2400mm": { sku: "CCAH4PST-100-100-2400", priceExGst: 52.00 },
  "100x100 Treated Pine Post H4 3000mm": { sku: "CCAH4PST-100-100-3000", priceExGst: 65.00 },
  "100x100 Treated Pine Post 3000mm": { sku: "CCAH4PST-100-100-3000", priceExGst: 65.00 },

  "100x75 Hardwood Post 1800mm": { sku: "CCAH4PST-HWD-100-75-1800", priceExGst: 46.00 },
  "100x75 Hardwood Post 2100mm": { sku: "CCAH4PST-HWD-100-75-2100", priceExGst: 53.60 },
  "100x75 Hardwood Post 2400mm": { sku: "CCAH4PST-HWD-100-75-2400", priceExGst: 61.30 },
  "100x75 Hardwood Post 2700mm": { sku: "CCAH4PST-HWD-100-75-2700", priceExGst: 69.00 },
  "100x75 Hardwood Post 3000mm": { sku: "CCAH4PST-HWD-100-75-3000", priceExGst: 76.70 },

  "100x100 Hardwood Post 1800mm": { sku: "CCAH4PST-HWD-100-100-1800", priceExGst: 61.00 },
  "100x100 Hardwood Post 2400mm": { sku: "CCAH4PST-HWD-100-100-2400", priceExGst: 81.30 },
  "100x100 Hardwood Post 2700mm": { sku: "CCAH4PST-HWD-100-100-2700", priceExGst: 91.50 },

  // Rails & Capping
  "75x38 Treated Pine Rail 4800mm": { sku: "RL-75-38-4800", priceExGst: 22.00 },
  "100x38 Treated Pine Rail 4800mm": { sku: "RL-100-38-4800", priceExGst: 29.50 },
  "75x38 Hardwood Rail 4800mm": { sku: "RL-HWD-75-38-4800", priceExGst: 42.00 },
  "100x38 Hardwood Rail 4800mm": { sku: "RL-HWD-100-38-4800", priceExGst: 56.00 },
  "75x50 Treated Pine Capping Rail 4800mm": { sku: "CAP-75-50-4800", priceExGst: 36.00 },

  // Palings (150mm, 125mm, 100mm widths)
  "150x16 Treated Pine Paling 1200mm": { sku: "PAL-150-1200", priceExGst: 1.34 },
  "150x16 Treated Pine Paling 1500mm": { sku: "PAL-150-1500", priceExGst: 1.67 },
  "150x16 Treated Pine Paling 1800mm": { sku: "PAL-150-1800", priceExGst: 2.01 },
  "150x16 Treated Pine Paling 2100mm": { sku: "PAL-150-2100", priceExGst: 2.34 },
  "150x16 Treated Pine Paling 2400mm": { sku: "PAL-150-2400", priceExGst: 2.68 },

  "125x16 Treated Pine Paling 1200mm": { sku: "PAL-125-1200", priceExGst: 1.12 },
  "125x16 Treated Pine Paling 1500mm": { sku: "PAL-125-1500", priceExGst: 1.40 },
  "125x16 Treated Pine Paling 1800mm": { sku: "PAL-125-1800", priceExGst: 1.68 },
  "125x16 Treated Pine Paling 2100mm": { sku: "PAL-125-2100", priceExGst: 1.96 },
  "125x16 Treated Pine Paling 2400mm": { sku: "PAL-125-2400", priceExGst: 2.24 },

  "100x16 Treated Pine Paling 1200mm": { sku: "PAL-100-1200", priceExGst: 0.88 },
  "100x16 Treated Pine Paling 1500mm": { sku: "PAL-100-1500", priceExGst: 1.10 },
  "100x16 Treated Pine Paling 1800mm": { sku: "PAL-100-1800", priceExGst: 1.32 },
  "100x16 Treated Pine Paling 2100mm": { sku: "PAL-100-2100", priceExGst: 1.54 },
  "100x16 Treated Pine Paling 2400mm": { sku: "PAL-100-2400", priceExGst: 1.76 },

  "100x16 Rough Sawn Treated Pine Paling 1200mm": { sku: "PAL-100-1200", priceExGst: 0.88 },
  "100x16 Rough Sawn Treated Pine Paling 1500mm": { sku: "PAL-100-1500", priceExGst: 1.10 },
  "100x16 Rough Sawn Treated Pine Paling 1800mm": { sku: "PAL-100-1800", priceExGst: 1.32 },
  "100x16 Rough Sawn Treated Pine Paling 2400mm": { sku: "PAL-100-2400", priceExGst: 1.76 },

  "100x16 Paddle Pop Treated Pine Paling 1200mm": { sku: "PAL-PP-100-1200", priceExGst: 1.30 },
  "100x16 Paddle Pop Treated Pine Paling 1500mm": { sku: "PAL-PP-100-1500", priceExGst: 1.70 },

  // Plinth
  "150x25 Treated Pine Plinth 2400mm": { sku: "PLN-150-25-2400", priceExGst: 11.00 },

  // Fasteners & Concrete
  "57mm Ring Shank Gal Nail": { sku: "NL-RS-57-GAL", priceExGst: 47.00 },
  "57mm Smooth Shank Gal Nail": { sku: "NL-RS-57-GAL", priceExGst: 47.00 },
  "45mm Ring Shank Gal Nail": { sku: "NL-RS-45-GAL", priceExGst: 38.00 },
  "45mm Smooth Shank Gal Nail": { sku: "NL-RS-45-GAL", priceExGst: 38.00 },
  "100mm Galvanised Batten Screw": { sku: "NL-BTS-100-GAL", priceExGst: 12.13 },
  "Rapid Set Concrete 20kg": { sku: "RPS-CON-20", priceExGst: 10.50 },
  "Rapid Set Concrete 30kg": { sku: "DMR3056LD", priceExGst: 11.04 },
  "Post Mix Concrete 30kg": { sku: "DMPM3056LD", priceExGst: 9.80 },
  "General Purpose Cement 20kg": { sku: "CG2CD", priceExGst: 6.68 },

  // Gates
  "Gate kit · 900mm pedestrian": { sku: "GTKIT-900-TP", priceExGst: 235.00 },
  "Gate kit · 1500mm double": { sku: "GTKIT-1500-TP", priceExGst: 415.00 },
};

// Fallback matching patterns for names/skus that might be slightly formatted or look like SKUs already
export function resolveAmazingFencingItem(canonicalName: string): MappedItem & { canonical: string; found: boolean } {
  const cleanKey = canonicalName.trim();
  
  // Try exact lookup first
  if (AMAZING_FENCING_CATALOG[cleanKey]) {
    return { ...AMAZING_FENCING_CATALOG[cleanKey], canonical: cleanKey, found: true };
  }

  // Attempt fuzzy mapping for heights or small variations
  // E.g. "100x16 Treated Pine Paling 1800mm" -> "PAL-100-1800"
  const palingMatch = cleanKey.match(/^(\d+)x(\d+) (?:Rough Sawn )?Treated Pine Paling (\d+)mm$/i);
  if (palingMatch) {
    const width = palingMatch[1];
    const height = palingMatch[3];
    const sku = `PAL-${width}-${height}`;
    // Estimate price based on width and height
    const basePrices: Record<string, number> = { "100": 1.32, "125": 1.68, "150": 2.01 };
    const baseHeight = 1800;
    const basePrice = basePrices[width] || 1.32;
    const calculatedPrice = Math.round((basePrice * (Number(height) / baseHeight)) * 100) / 100;
    return { sku, priceExGst: calculatedPrice, canonical: cleanKey, found: true };
  }

  const postMatch = cleanKey.match(/^(\d+)x(\d+) (Treated Pine|Hardwood) Post (?:H4 )?(\d+)mm$/i);
  if (postMatch) {
    const w = postMatch[1];
    const d = postMatch[2];
    const type = postMatch[3].toLowerCase() === "hardwood" ? "HWD" : "PINE";
    const h = postMatch[5];
    const sku = `CCAH4PST-${type}-${w}-${d}-${h}`;
    // Fallback price estimation
    const basePrice = type === "HWD" ? 61.30 : 39.00;
    return { sku, priceExGst: basePrice, canonical: cleanKey, found: true };
  }

  // Already looks like resolved SKU
  if (/^[A-Z0-9-]{6,}$/.test(cleanKey) || cleanKey.includes("amf ·") || cleanKey.startsWith("AF-")) {
    return { sku: cleanKey.replace("amf ·", "").trim(), priceExGst: 0, canonical: cleanKey, found: true };
  }

  // Fallback for missing mapping
  return {
    sku: "Price TBC",
    priceExGst: 0,
    canonical: canonicalName,
    found: false,
  };
}

// Bundled labor calculator variables
export const INSTALL_LABOUR_RATES = {
  fencePerMetre: 35.67, // ex-GST
  pedestrianGate: 143.00,
  doubleSwingGate: 280.00,
  slidingGate: 380.00,
  travelFlat: 120.00,
  removalPerMetre: 8.57, // flat fee of $240 for typical ~28m
  removalFlat: 240.00,
};
