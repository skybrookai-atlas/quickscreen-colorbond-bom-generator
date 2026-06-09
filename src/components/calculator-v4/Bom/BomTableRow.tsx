import { X } from "lucide-react";
import { Input } from "../../ui/Input";
import { bomLineQtyKey, type BomViewLine } from "./useBomViewModel";

interface Props {
  line: BomViewLine;
  onRemove: () => void;
  onQtyChange: (lineKey: string, qty: number) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);

export function BomTableRow({ line, onRemove, onQtyChange }: Props) {
  const qtyKey = bomLineQtyKey(line);
  const canEditQty = qtyKey.length > 0;

  return (
    <tr className="hover:bg-brand-border/15 transition-colors">
      <td className="text-brand-accent px-3 py-2 text-xs font-mono">
        {line.sku || "—"}
      </td>
      <td className="px-3 py-2 text-xs text-brand-text">
        <div className="font-medium">{line.name}</div>
        {line.description && line.description !== line.name && (
          <div className="text-[11px] text-brand-muted truncate max-w-md">
            {line.description}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-brand-muted">{line.unit}</td>
      <td className="px-3 py-2 text-xs font-mono tabular-nums text-right align-top">
        {canEditQty ? (
          <Input
            type="number"
            min={0}
            step={1}
            value={line.quantity}
            onChange={(e) =>
              onQtyChange(qtyKey, Math.max(0, Number(e.target.value)))
            }
            className="w-16 py-1 px-2 text-right tabular-nums"
            data-testid={`bom-qty-${qtyKey}`}
          />
        ) : (
          line.quantity
        )}
      </td>
      {line.unitPrice === null || line.unitPrice === 0 ? (
        <td
          colSpan={2}
          className="px-3 py-2 text-right"
          title="No confirmed price for this SKU — please check with The Glass Outlet."
        >
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            Price TBC
          </span>
        </td>
      ) : (
        <>
          <td className="px-3 py-2 text-xs font-mono tabular-nums text-right">
            {fmt(line.unitPrice)}
          </td>
          <td className="px-3 py-2 text-xs font-mono tabular-nums text-right font-semibold text-brand-text">
            {line.lineTotal !== null ? fmt(line.lineTotal) : "TBC"}
          </td>
        </>
      )}
      <td className="px-2 py-2 w-8">
        <button
          onClick={onRemove}
          aria-label="Remove line"
          className="p-1 text-red-500 hover:text-red-500 hover:bg-red-500/10 rounded"
        >
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}
