import { useState, useMemo } from 'react';
import { Check, X, AlertTriangle, Search } from 'lucide-react';
import type { DiffItem } from '../../lib/imports/types';

interface DiffTableProps {
  diffs: DiffItem[];
  decisions: Record<string, 'pending' | 'approve' | 'reject' | 'needs_review'>;
  onApprove: (sku: string) => void;
  onReject: (sku: string) => void;
  onNeedsReview: (sku: string) => void;
  onBulkApprove: (statusFilter: 'new' | 'changed' | 'unchanged' | 'all') => void;
  onBulkReject: () => void;
}

const STATUS_BADGES: Record<string, string> = {
  new: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  changed: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  unchanged: 'text-brand-muted bg-brand-border/20 border-brand-border/40',
  unmapped: 'text-red-400 bg-red-500/10 border-red-500/30',
};

export function DiffTable({
  diffs,
  decisions,
  onApprove,
  onReject,
  onNeedsReview,
  onBulkApprove,
  onBulkReject,
}: DiffTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'changed' | 'unchanged'>('all');

  const filteredDiffs = useMemo(() => {
    return diffs.filter((item) => {
      const skuMatch = item.sku.toLowerCase().includes(search.toLowerCase()) || 
                       item.stagedProduct.name.toLowerCase().includes(search.toLowerCase());
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      return skuMatch && statusMatch;
    });
  }, [diffs, search, statusFilter]);

  const stats = useMemo(() => {
    const counts = { new: 0, changed: 0, unchanged: 0, total: diffs.length };
    for (const d of diffs) {
      if (d.status === 'new') counts.new++;
      if (d.status === 'changed') counts.changed++;
      if (d.status === 'unchanged') counts.unchanged++;
    }
    return counts;
  }, [diffs]);

  const renderPrice = (priceCents: number) => `$${(priceCents / 100).toFixed(2)}`;

  const getPriceForTier = (prices: Array<{ tier_code: string; min_quantity: number; price_cents: number }>, tier: string) => {
    return prices.find((p) => p.tier_code === tier && p.min_quantity === 1)?.price_cents ?? 0;
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-bg/50 p-4 border border-brand-border rounded-lg">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: `All (${stats.total})` },
            { id: 'new', label: `New (${stats.new})` },
            { id: 'changed', label: `Changed (${stats.changed})` },
            { id: 'unchanged', label: `Unchanged (${stats.unchanged})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                statusFilter === tab.id
                  ? 'bg-brand-accent text-white border-brand-accent'
                  : 'bg-brand-card text-brand-muted border-brand-border hover:text-brand-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search diff by SKU or Name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-brand-card border border-brand-border rounded-lg text-brand-text placeholder:text-brand-muted/60 focus:outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onBulkApprove('new')}
          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors"
        >
          Approve All New
        </button>
        <button
          onClick={() => onBulkApprove('changed')}
          className="px-3 py-1.5 text-xs font-semibold bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
        >
          Approve All Changed
        </button>
        <button
          onClick={onBulkReject}
          className="px-3 py-1.5 text-xs font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
        >
          Reject All Unapproved
        </button>
      </div>

      {/* Grid table */}
      <div className="rounded-lg border border-brand-border overflow-hidden bg-brand-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-brand-border bg-brand-bg/50">
                <th className="px-4 py-3 font-medium text-brand-muted w-32">SKU / Status</th>
                <th className="px-4 py-3 font-medium text-brand-muted w-1/3">Current Catalogue</th>
                <th className="px-4 py-3 font-medium text-brand-muted w-1/3">Staged / Import</th>
                <th className="px-4 py-3 font-medium text-brand-muted text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/40">
              {filteredDiffs.map((item) => {
                const decision = decisions[item.sku] || 'pending';
                const hasNameDiff = 'name' in item.diffs;
                const hasCategoryDiff = 'category' in item.diffs;
                const hasSystemDiff = 'system_types' in item.diffs;
                const hasT1PriceDiff = 'price_tier1_qty1' in item.diffs;
                const hasT2PriceDiff = 'price_tier2_qty1' in item.diffs;
                const hasT3PriceDiff = 'price_tier3_qty1' in item.diffs;

                return (
                  <tr key={item.sku} className="hover:bg-brand-border/10 transition-colors">
                    <td className="px-4 py-3 space-y-2">
                      <div className="font-mono font-semibold text-brand-text truncate w-32" title={item.sku}>
                        {item.sku}
                      </div>
                      <div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${STATUS_BADGES[item.status]}`}>
                          {item.status}
                        </span>
                      </div>
                    </td>

                    {/* Current Column */}
                    <td className="px-4 py-3 text-brand-muted space-y-1">
                      {item.currentProduct ? (
                        <>
                          <div className="font-medium text-brand-muted line-clamp-1">{item.currentProduct.name}</div>
                          <div className="flex gap-2 text-[10px]">
                            <span>Cat: {item.currentProduct.category}</span>
                            <span>Systems: {item.currentProduct.system_types?.join(', ') || 'none'}</span>
                          </div>
                          {item.currentPrices && item.currentPrices.length > 0 && (
                            <div className="text-[10px] space-x-2 font-mono">
                              <span>T1: {renderPrice(getPriceForTier(item.currentPrices as any, 'tier1'))}</span>
                              <span>T2: {renderPrice(getPriceForTier(item.currentPrices as any, 'tier2'))}</span>
                              <span>T3: {renderPrice(getPriceForTier(item.currentPrices as any, 'tier3'))}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="italic text-brand-muted/40">Not in current catalogue</div>
                      )}
                    </td>

                    {/* Staged Column */}
                    <td className="px-4 py-3 space-y-1">
                      <div className={`font-medium ${hasNameDiff ? 'text-emerald-400 font-semibold' : 'text-brand-text'}`}>
                        {item.stagedProduct.name}
                        {hasNameDiff && (
                          <span className="block text-[10px] text-brand-muted/50 font-normal line-through">
                            {item.currentProduct?.name}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex gap-2 text-[10px] text-brand-muted">
                        <span className={hasCategoryDiff ? 'text-emerald-400 font-semibold' : ''}>
                          Cat: {item.stagedProduct.category}
                        </span>
                        <span className={hasSystemDiff ? 'text-emerald-400 font-semibold' : ''}>
                          Systems: {item.stagedProduct.system_types.join(', ')}
                        </span>
                      </div>

                      <div className="text-[10px] space-x-2 font-mono text-brand-muted">
                        <span className={hasT1PriceDiff ? 'text-emerald-400 font-semibold' : ''}>
                          T1: {renderPrice(getPriceForTier(item.stagedPrices, 'tier1'))}
                          {hasT1PriceDiff && (
                            <span className="ml-1 text-[9px] text-brand-muted/50 line-through">
                              {renderPrice(getPriceForTier(item.currentPrices || [], 'tier1'))}
                            </span>
                          )}
                        </span>
                        <span className={hasT2PriceDiff ? 'text-emerald-400 font-semibold' : ''}>
                          T2: {renderPrice(getPriceForTier(item.stagedPrices, 'tier2'))}
                          {hasT2PriceDiff && (
                            <span className="ml-1 text-[9px] text-brand-muted/50 line-through">
                              {renderPrice(getPriceForTier(item.currentPrices || [], 'tier2'))}
                            </span>
                          )}
                        </span>
                        <span className={hasT3PriceDiff ? 'text-emerald-400 font-semibold' : ''}>
                          T3: {renderPrice(getPriceForTier(item.stagedPrices, 'tier3'))}
                          {hasT3PriceDiff && (
                            <span className="ml-1 text-[9px] text-brand-muted/50 line-through">
                              {renderPrice(getPriceForTier(item.currentPrices || [], 'tier3'))}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Decision Button Column */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex rounded-lg border border-brand-border overflow-hidden p-0.5 bg-brand-bg/30">
                        <button
                          type="button"
                          onClick={() => onApprove(item.sku)}
                          className={`p-1.5 text-xs rounded-md transition-all ${
                            decision === 'approve'
                              ? 'bg-emerald-500 text-white font-semibold'
                              : 'text-brand-muted hover:text-emerald-400'
                          }`}
                          title="Approve item for publishing"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNeedsReview(item.sku)}
                          className={`p-1.5 text-xs rounded-md transition-all ${
                            decision === 'needs_review'
                              ? 'bg-amber-500 text-white font-semibold'
                              : 'text-brand-muted hover:text-amber-400'
                          }`}
                          title="Flag for detailed review"
                        >
                          <AlertTriangle size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(item.sku)}
                          className={`p-1.5 text-xs rounded-md transition-all ${
                            decision === 'reject'
                              ? 'bg-red-500 text-white font-semibold'
                              : 'text-brand-muted hover:text-red-400'
                          }`}
                          title="Reject / skip this item"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredDiffs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-brand-muted">
                    No items match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
