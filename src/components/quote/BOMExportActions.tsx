import { useState } from "react";
import { Download, Loader2, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { pdf, PDFViewer } from "@react-pdf/renderer";
import Papa from "papaparse";
import { BomV3PDFTemplate } from "./BomV3PDFTemplate";
import { SlideOutPane } from "../calculator-v4/shared/SlideOutPane";
import type { CalculatorBOMResult, BOMLineItem } from "../../types/bom.types";
import { stripParentheticalDispatchCode } from "../../lib/displayText";

interface BOMExportActionsProps {
  result: CalculatorBOMResult;
  removedSkus?: Set<string>;
  qtyOverrides?: Map<string, number>;
  customerRef?: string;
  customerEmail?: string;
  siteAddress?: string;
  validUntil?: string;
}

function applyOverrides(
  items: BOMLineItem[],
  removedSkus?: Set<string>,
  qtyOverrides?: Map<string, number>,
): BOMLineItem[] {
  return items
    .filter((i) => !removedSkus?.has(i.sku))
    .map((i) => {
      const qty = qtyOverrides?.get(i.sku) ?? i.quantity;
      return {
        ...i,
        quantity: qty,
        lineTotal: i.unitPrice !== null ? parseFloat((qty * i.unitPrice).toFixed(2)) : null,
      };
    });
}

export function BOMExportActions({
  result,
  removedSkus,
  qtyOverrides,
  customerRef,
  customerEmail,
  siteAddress,
  validUntil,
}: BOMExportActionsProps) {
  const [pdfing, setPdfing] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [csving, setCsving] = useState(false);
  const [copying, setCopying] = useState(false);

  const effectiveItems = applyOverrides(result.allItems, removedSkus, qtyOverrides);
  const subtotal = parseFloat(
    effectiveItems.reduce((s, i) => s + (i.lineTotal ?? 0), 0).toFixed(2),
  );
  const gst = parseFloat((subtotal * 0.1).toFixed(2));
  const grandTotal = parseFloat((subtotal + gst).toFixed(2));

  const date = new Date().toISOString().slice(0, 10);
  const fileSlug = customerRef?.replace(/\s+/g, "-").toLowerCase() || "bom";

  const handleCopy = async () => {
    setCopying(true);
    const lines = effectiveItems.map(
      (i) =>
        `${i.sku}\t${stripParentheticalDispatchCode(i.name || i.description)}\t×${i.quantity}\t${i.lineTotal !== null ? `$${i.lineTotal.toFixed(2)}` : "TBC"}`,
    );
    lines.push("");
    lines.push(`Subtotal (ex-GST)\t\t\t$${subtotal.toFixed(2)}`);
    lines.push(`GST (10%)\t\t\t$${gst.toFixed(2)}`);
    lines.push(`TOTAL (inc. GST)\t\t\t$${grandTotal.toFixed(2)}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("BOM copied to clipboard");
    setCopying(false);
  };

  const handleCSV = () => {
    setCsving(true);
    type CSVRow = {
      SKU: string;
      Name: string;
      Description: string;
      Category: string;
      Unit: string;
      Qty: number | string;
      "Unit Price": string;
      "Line Total": string;
    };
    const rows: CSVRow[] = effectiveItems.map((i) => ({
      SKU: i.sku,
      Name: stripParentheticalDispatchCode(i.name || i.description),
      Description: stripParentheticalDispatchCode(i.description),
      Category: i.category,
      Unit: i.unit,
      Qty: i.quantity,
      "Unit Price": i.unitPrice !== null ? i.unitPrice.toFixed(2) : "TBC",
      "Line Total": i.lineTotal !== null ? i.lineTotal.toFixed(2) : "TBC",
    }));
    rows.push({
      SKU: "", Name: "Subtotal (ex-GST)", Description: "", Category: "",
      Unit: "", Qty: "", "Unit Price": "", "Line Total": subtotal.toFixed(2),
    });
    rows.push({
      SKU: "", Name: "GST (10%)", Description: "", Category: "",
      Unit: "", Qty: "", "Unit Price": "", "Line Total": gst.toFixed(2),
    });
    rows.push({
      SKU: "", Name: "TOTAL (inc. GST)", Description: "", Category: "",
      Unit: "", Qty: "", "Unit Price": "", "Line Total": grandTotal.toFixed(2),
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quote-${fileSlug}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
    setCsving(false);
  };

  const pdfTemplate = (
    <BomV3PDFTemplate
      items={effectiveItems}
      subtotal={subtotal}
      gst={gst}
      grandTotal={grandTotal}
      pricingTier={result.pricingTier}
      generatedAt={result.generatedAt}
      customerRef={customerRef}
      customerEmail={customerEmail}
      siteAddress={siteAddress}
      validUntil={validUntil}
    />
  );

  const handlePDFDownload = async () => {
    setPdfing(true);
    try {
      const blob = await pdf(pdfTemplate).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote-${fileSlug}-${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfing(false);
    }
  };

  const btnCls =
    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--brand-radius-sm)] border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-accent/60 hover:bg-brand-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
    <SlideOutPane
      open={pdfPreviewOpen}
      onClose={() => setPdfPreviewOpen(false)}
      title="PDF Preview"
      subtitle={customerRef || undefined}
      widthClass="md:w-[700px]"
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0">
          {pdfPreviewOpen && (
            <div className="w-full" style={{ height: "calc(100vh - 140px)" }}>
              <PDFViewer width="100%" height="100%">
                {pdfTemplate}
              </PDFViewer>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 border-t border-brand-border px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={handlePDFDownload}
            disabled={pdfing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-[var(--brand-radius-sm)] bg-brand-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download PDF
          </button>
        </div>
      </div>
    </SlideOutPane>
    <div className="flex flex-wrap gap-2 justify-end pt-3">
      <button
        type="button"
        onClick={handleCopy}
        disabled={copying || effectiveItems.length === 0}
        className={btnCls}
        title="Copy to clipboard"
      >
        {copying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
        Copy
      </button>
      <button
        type="button"
        onClick={handleCSV}
        disabled={csving || effectiveItems.length === 0}
        className={btnCls}
        title="Download CSV"
      >
        {csving ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Download size={13} />
        )}
        CSV
      </button>
      <button
        type="button"
        onClick={() => setPdfPreviewOpen(true)}
        disabled={effectiveItems.length === 0}
        className={btnCls}
        title="Preview & download PDF"
      >
        <Eye size={13} />
        PDF
      </button>
    </div>
    </>
  );
}
