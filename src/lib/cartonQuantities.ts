import type { BOMLineItem } from "../types/bom.types";
import { priceForSku } from "./localBomCalculator";

const CARTON_QTY_ENTRIES = [
  ["TC-H-AT-HD", 20, "pairs"],
  ["TC-H-AT", 20, "pairs"],
  ["KF-H-", 20, "pairs"],
  ["KF-AH-AT", 20, "pairs"],
  ["LL-DL", 20, "pcs"],
  ["LLAA", 20, "pcs"],
  ["LLB", 20, "pcs"],
  ["LL-GH", 20, "pcs"],
  ["QSG-JOINER65", 20, "packs"],
  ["QSG-JOINER90", 20, "packs"],
  ["QS-SCREWS-50PK", 50, "packs"],
  ["AR-SCR-BR-50PK", 50, "packs"],
  ["QS-SPACER-", 50, "packs"],
] as const;

export function cartonQuantityForSku(sku: string) {
  return CARTON_QTY_ENTRIES.find(([prefix]) => sku.startsWith(prefix));
}

export function cartonHintForLine(item: BOMLineItem) {
  const match = cartonQuantityForSku(item.sku);
  if (!match) return null;
  const [, cartonQty, label] = match;
  if (item.quantity <= 0 || item.quantity % cartonQty === 0) return null;

  const nextCartonQty = Math.ceil(item.quantity / cartonQty) * cartonQty;
  const more = nextCartonQty - item.quantity;
  if (more > cartonQty * 0.3) return null;

  const cartonUnitPrice = priceForSku(item.sku, nextCartonQty);
  const saving =
    cartonUnitPrice > 0 && item.unitPrice !== null && item.unitPrice > cartonUnitPrice
      ? Math.round((item.unitPrice - cartonUnitPrice) * nextCartonQty)
      : 0;

  return {
    more,
    cartonQty,
    label,
    saving,
  };
}

