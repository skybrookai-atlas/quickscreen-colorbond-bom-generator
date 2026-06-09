import { localFenceProducts } from "./localSeedData";

const SYSTEM_DISPLAY_NAME_FALLBACKS: Record<string, string> = {
  QSHS: "QuickScreen Horizontal Slat",
  XPL: "XPress Plus Premium",
  VS: "Vertical Slat",
  BAYG: "Buy As You Go",
  DF_CCA_PAL: "CCA Pine Paling",
  AF_TIMBER_PALING: "Timber Paling",
  AF_COLORBOND: "Colorbond Steel",
  AF_RETAINING_WALL: "Timber Retaining Wall",
};

function tidySeedName(name: string) {
  return name
    .replace(/\s+Post Fence$/i, "")
    .replace(/\s+Fence$/i, "")
    .replace(/^VS\s+/i, "")
    .trim();
}

export function systemDisplayName(productCode: string | null | undefined) {
  if (!productCode) return "QuickScreen Horizontal Slat";
  const product = localFenceProducts.find((item) => item.system_type === productCode);
  const seededName =
    product && typeof product.name === "string" ? tidySeedName(product.name) : "";
  return SYSTEM_DISPLAY_NAME_FALLBACKS[productCode] ?? (seededName || productCode);
}
