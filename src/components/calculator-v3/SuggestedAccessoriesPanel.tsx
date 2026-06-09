import { Check, PlusCircle, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ExtraItem } from "../../types/bom.types";
import type { SuggestedAccessory } from "../../lib/suggestedAccessories";
import { useProductSearch } from "../../hooks/useProductSearch";
import { getComponent } from "../../lib/localSeedData";

interface SuggestedAccessoriesPanelProps {
  suggestions: SuggestedAccessory[];
  addedItems: ExtraItem[];
  onAdd: (item: ExtraItem) => void;
  onRemove?: (id: string) => void;
}

const DISMISSED_KEY = "qsg-dismissed-accessory-skus";

function genPinnedId(sku: string) {
  return `suggested-pinned-${sku}-${Date.now()}`;
}

function loadDismissed() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const values = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return new Set<string>(Array.isArray(values) ? values.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function persistDismissed(values: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...values]));
}

export function SuggestedAccessoriesPanel({
  suggestions,
  addedItems,
  onAdd,
  onRemove,
}: SuggestedAccessoriesPanelProps) {
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<SuggestedAccessory[]>([]);
  const [open, setOpen] = useState(true);
  const { data: matches = [], isFetching } = useProductSearch(query);

  useEffect(() => persistDismissed(dismissed), [dismissed]);

  const addedBySku = useMemo(
    () => new Map(addedItems.map((item) => [item.sku ?? item.id, item])),
    [addedItems],
  );

  const dependentSuggestions = useMemo(() => {
    if (!addedBySku.has("SOUD-CA1400") || addedBySku.has("SOUD-GUN")) return [];
    const component = getComponent("SOUD-GUN");
    return [
      {
        id: "suggested-soud-gun-dependent",
        sku: "SOUD-GUN",
        description:
          component?.description ?? "Heavy duty cartridge gun for SOUD-CA1400",
        quantity: 1,
        unitPrice: component?.default_price ?? 0,
        category: "fixing",
        reason: "Heavy duty cartridge gun for SOUD-CA1400.",
        priced: Boolean(component?.default_price && component.default_price > 0),
      } satisfies SuggestedAccessory,
    ];
  }, [addedBySku]);

  const visible = useMemo(() => {
    const all = [...dependentSuggestions, ...pinned, ...suggestions];
    const byKey = new Map<string, SuggestedAccessory>();
    for (const item of all) {
      const key = item.sku ?? item.id;
      if (!dismissed.has(key)) byKey.set(key, item);
    }
    return [...byKey.values()];
  }, [dependentSuggestions, dismissed, pinned, suggestions]);

  if (suggestions.length === 0 && pinned.length === 0) return null;

  function dismiss(item: SuggestedAccessory) {
    const key = item.sku ?? item.id;
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    toast("Suggestion hidden", {
      action: {
        label: "Undo",
        onClick: () => {
          const restored = new Set(next);
          restored.delete(key);
          setDismissed(restored);
        },
      },
    });
  }

  function pinFromSearch(item: {
    sku: string;
    name: string;
    description?: string;
    unitPrice?: number;
  }) {
    setPinned((current) => [
      {
        id: genPinnedId(item.sku),
        sku: item.sku,
        description: item.description || item.name,
        quantity: 1,
        unitPrice: item.unitPrice ?? 0,
        category: "catalogue_gap",
        reason: "Pinned from product search for this BOM review.",
        priced: item.unitPrice != null,
      },
      ...current.filter((existing) => existing.sku !== item.sku),
    ]);
    setQuery("");
    toast.success("Pinned suggested item");
  }

  return (
    <div
      className="mt-4 border-t border-brand-border pt-4"
      data-testid="suggested-accessories-panel"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Suggested accessories
          </p>
          <p className="mt-1 text-xs text-brand-muted">
            Not included in the BOM until added. Hidden suggestions stay hidden
            on this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-h-11 rounded-lg border border-brand-border px-3 py-2 text-xs font-black text-brand-muted hover:border-brand-primary hover:text-brand-primary"
          aria-expanded={open}
        >
          {open ? "Hide suggestions" : `Show suggestions (${visible.length})`}
        </button>
        {dismissed.size > 0 && (
          <button
            type="button"
            onClick={() => setDismissed(new Set())}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted hover:border-brand-primary hover:text-brand-primary"
          >
            <RotateCcw size={16} />
            Restore hidden
          </button>
        )}
        </div>
      </div>

      {open && (
      <>
      <div className="relative mb-3">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pin another catalogue item by SKU or description"
          className="w-full rounded-lg border border-brand-border bg-brand-bg py-2 pl-9 pr-3 text-sm font-semibold text-brand-text outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
        {query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-brand-border bg-brand-card shadow-xl">
            {matches.length > 0 ? (
              matches.map((item) => (
                <button
                  key={item.sku}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pinFromSearch(item);
                  }}
                  className="block w-full border-b border-brand-border/40 px-3 py-2 text-left text-xs text-brand-text last:border-b-0 hover:bg-brand-primary/10"
                >
                  <span className="font-mono text-brand-primary">{item.sku}</span>
                  <span className="mx-1 text-brand-muted">-</span>
                  <span>{item.name}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs italic text-brand-muted">
                {isFetching ? "Searching..." : "No matches"}
              </p>
            )}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-border px-3 py-4 text-center text-sm font-semibold text-brand-muted">
          All suggestions hidden or already handled.
        </p>
      ) : (
        <div className="grid gap-2">
          {visible.map((item) => {
            const key = item.sku ?? item.id;
            const added = addedBySku.get(key);
            return (
              <div
                key={item.id}
                className="grid gap-3 rounded-lg border border-brand-border/70 bg-brand-bg/60 p-3 text-sm font-semibold shadow-sm md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-brand-primary">
                      {item.sku ?? "EXTRA"}
                    </span>
                    <span className="font-medium text-brand-text">
                      {item.description}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-brand-muted">{item.reason}</p>
                  {!item.priced && (
                    <p className="mt-1 text-xs font-medium text-brand-warning">
                      Price not seeded yet.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <div className="text-right tabular-nums">
                    <p className="text-xs text-brand-muted">Qty</p>
                    <p className="font-semibold text-brand-text">
                      {item.quantity}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-xs text-brand-muted">Unit</p>
                    <p className="font-semibold text-brand-text">
                      {item.unitPrice !== null && item.unitPrice !== undefined ? `$${item.unitPrice.toFixed(2)}` : "TBC"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (added) {
                        onRemove?.(added.id);
                        return;
                      }
                      onAdd(item);
                    }}
                    className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors hover:shadow-sm ${
                      added
                        ? "border border-brand-success/40 bg-brand-success/10 text-brand-success hover:bg-brand-success hover:text-white"
                        : "bg-brand-primary text-white hover:bg-brand-primary/90"
                    }`}
                  >
                    {added ? <Check size={16} /> : <PlusCircle size={16} />}
                    {added ? "Added" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(item)}
                    className="min-h-11 rounded-lg p-2 text-brand-muted transition-colors hover:bg-brand-danger/10 hover:text-brand-danger"
                    title="Hide this suggestion"
                    aria-label="Hide this suggestion"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}
