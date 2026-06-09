import { useState, useRef, useEffect } from "react";
import { ChevronDown, Printer, Share2, Loader2, FileSpreadsheet } from "lucide-react";

interface ExportDropdownProps {
  onPrintBom: () => void;
  onExportCsv: () => void;
  onSharePdf: () => void;
  includeMap: boolean;
  onIncludeMapChange: (val: boolean) => void;
  disabled?: boolean;
  sharingPdf?: boolean;
}

export function ExportDropdown({
  onPrintBom,
  onExportCsv,
  onSharePdf,
  includeMap,
  onIncludeMapChange,
  disabled = false,
  sharingPdf = false,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg/70 px-3 py-2 text-xs font-bold text-brand-muted transition-colors hover:border-brand-primary hover:text-brand-primary hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Share2 size={14} />
        <span>Export</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-56 origin-top-right rounded-xl border border-brand-border bg-brand-card py-2 shadow-xl z-50 text-xs text-brand-text">
          {/* Include Map Option */}
          <div className="px-3 py-2 border-b border-brand-border/60" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-2 font-semibold text-brand-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeMap}
                onChange={(event) => onIncludeMapChange(event.target.checked)}
                className="accent-brand-primary rounded"
              />
              <span>Include map in print/PDF</span>
            </label>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                onPrintBom();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-border/20 transition-colors"
            >
              <Printer size={16} className="text-brand-muted" />
              <span>Print BOM</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onExportCsv();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-border/20 transition-colors"
            >
              <FileSpreadsheet size={16} className="text-brand-muted" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              disabled={sharingPdf}
              onClick={() => {
                void onSharePdf();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-border/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sharingPdf ? (
                <Loader2 size={16} className="animate-spin text-brand-primary" />
              ) : (
                <Share2 size={16} className="text-brand-muted" />
              )}
              <span>Share PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
