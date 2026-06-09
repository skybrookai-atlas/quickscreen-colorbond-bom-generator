import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { BOMLineItem } from "../../types/bom.types";
import { stripParentheticalDispatchCode } from "../../lib/displayText";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a2e" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  brandPrimary: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#3b82f6",
  },
  brandSecond: { fontSize: 10, color: "#6b7280" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: "4 6",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: "3 6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  groupRow: {
    flexDirection: "row",
    padding: "3 6",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  groupLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#6b7280" },
  colCode: { width: 90 },
  colDesc: { flex: 1 },
  colUnit: { width: 35, textAlign: "center" },
  colQty: { width: 30, textAlign: "right" },
  colPrice: { width: 55, textAlign: "right" },
  colTotal: { width: 60, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  totalLabel: {
    width: 100,
    textAlign: "right",
    color: "#6b7280",
    marginRight: 8,
  },
  totalValue: { width: 70, textAlign: "right" },
  grandTotal: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 8,
  },
});

const CATEGORY_ORDER = [
  "post", "slat", "rail", "bracket", "gate", "hardware", "accessory", "screw",
];

function sortItems(items: BOMLineItem[]): BOMLineItem[] {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function groupByCategory(items: BOMLineItem[]): [string, BOMLineItem[]][] {
  const map = new Map<string, BOMLineItem[]>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }
  return Array.from(map.entries());
}

interface BomV3PDFTemplateProps {
  items: BOMLineItem[];
  subtotal: number;
  gst: number;
  grandTotal: number;
  pricingTier: string;
  generatedAt: string;
  customerRef?: string;
  customerEmail?: string;
  siteAddress?: string;
  validUntil?: string;
}

export function BomV3PDFTemplate({
  items,
  subtotal,
  gst,
  grandTotal,
  pricingTier,
  generatedAt,
  customerRef,
  customerEmail,
  siteAddress,
  validUntil,
}: BomV3PDFTemplateProps) {
  const sorted = sortItems(items);
  const groups = groupByCategory(sorted);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandPrimary}>SkybrookAI</Text>
            <Text style={s.brandSecond}>The Glass Outlet — QuickScreen BOM</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {customerRef || "BOM Quote"}
            </Text>
            {customerEmail ? (
              <Text style={{ color: "#6b7280" }}>{customerEmail}</Text>
            ) : null}
            {siteAddress ? (
              <Text style={{ color: "#6b7280" }}>{siteAddress}</Text>
            ) : null}
            <Text style={{ color: "#6b7280" }}>
              {new Date(generatedAt).toLocaleDateString("en-AU")}
            </Text>
            {validUntil ? (
              <Text style={{ color: "#6b7280" }}>
                Valid until: {new Date(validUntil).toLocaleDateString("en-AU")}
              </Text>
            ) : null}
            <Text style={{ color: "#6b7280" }}>
              {pricingTier.replace("tier", "Tier ")}
            </Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={s.colCode}>Code</Text>
          <Text style={s.colDesc}>Name</Text>
          <Text style={s.colUnit}>Unit</Text>
          <Text style={s.colQty}>Qty</Text>
          <Text style={s.colPrice}>Unit $</Text>
          <Text style={s.colTotal}>Line $</Text>
        </View>

        {/* Rows grouped by category */}
        {groups.map(([category, catItems]) => (
          <View key={category}>
            <View style={s.groupRow}>
              <Text style={s.groupLabel}>
                {category.toUpperCase()}S
              </Text>
            </View>
            {catItems.map((item) => (
              <View key={`${item.sku}-${item.category}`} style={s.tableRow}>
                <Text style={s.colCode}>{item.sku}</Text>
                <Text style={s.colDesc}>{stripParentheticalDispatchCode(item.name || item.description)}</Text>
                <Text style={s.colUnit}>{item.unit}</Text>
                <Text style={s.colQty}>{item.quantity}</Text>
                <Text style={s.colPrice}>
                  {item.unitPrice !== null && item.unitPrice > 0 ? `$${item.unitPrice.toFixed(2)}` : item.unitPrice === null ? "TBC" : "—"}
                </Text>
                <Text style={s.colTotal}>
                  {item.lineTotal !== null && item.lineTotal > 0 ? `$${item.lineTotal.toFixed(2)}` : item.lineTotal === null ? "TBC" : "—"}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Totals */}
        <View style={[s.totalRow, { marginTop: 12 }]}>
          <Text style={s.totalLabel}>Subtotal (ex-GST)</Text>
          <Text style={s.totalValue}>${subtotal.toFixed(2)}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>GST (10%)</Text>
          <Text style={s.totalValue}>${gst.toFixed(2)}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, s.grandTotal]}>Total (inc. GST)</Text>
          <Text style={[s.totalValue, s.grandTotal]}>${grandTotal.toFixed(2)}</Text>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          Generated by SkybrookAI · The Glass Outlet · All prices ex-GST unless noted
        </Text>
      </Page>
    </Document>
  );
}
