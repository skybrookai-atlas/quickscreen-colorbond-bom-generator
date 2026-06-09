import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, ArrowLeft, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { DiffTable } from '../../components/admin/DiffTable';
import { listAllSuppliers } from '../../lib/multiSupplier/queries';
import { getParser } from '../../lib/imports/parsers';
import { diffCatalog } from '../../lib/imports/diff';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../context/ProfileContext';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import type { DiffItem } from '../../lib/imports/types';

export function ImportPage() {
  const { runId } = useParams<{ runId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId } = useProfile();

  const [supplierId, setSupplierId] = useState('');
  const [format, setFormat] = useState('cin7_mass_download');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'reviewing' | 'publishing' | 'done'>('idle');
  const [activeRunId, setActiveRunId] = useState<string | null>(runId || null);

  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [decisions, setDecisions] = useState<Record<string, 'pending' | 'approve' | 'reject' | 'needs_review'>>({});

  const { data: suppliers = [] } = useQuery({
    queryKey: ['admin', 'suppliers', 'all'],
    queryFn: listAllSuppliers,
  });

  const isReviewMode = !!activeRunId;

  // Retrieve staging run if review mode is active
  useEffect(() => {
    if (activeRunId) {
      loadStagingData(activeRunId);
    }
  }, [activeRunId]);

  const loadStagingData = async (runIdToLoad: string) => {
    setStatus('reviewing');
    try {
      // Fetch import run
      const { data: run, error: runErr } = await supabase
        .from('import_runs')
        .select('*')
        .eq('id', runIdToLoad)
        .single();
      if (runErr) throw runErr;

      setSupplierId(run.supplier_id);
      setFormat(run.source_format);

      // Fetch staging products
      const { data: stagedProducts, error: prodErr } = await supabase
        .from('staging_products')
        .select('*')
        .eq('import_run_id', runIdToLoad);
      if (prodErr) throw prodErr;

      // Fetch staging prices
      const { data: stagedPrices, error: priceErr } = await supabase
        .from('staging_price_book_items')
        .select('*')
        .eq('import_run_id', runIdToLoad);
      if (priceErr) throw priceErr;

      // Fetch current database components
      const { data: currentComponents, error: compErr } = await supabase
        .from('product_components')
        .select('*')
        .eq('supplier_id', run.supplier_id);
      if (compErr) throw compErr;

      // Fetch current price book items (published price books for this supplier)
      const { data: priceBooks, error: bookErr } = await supabase
        .from('price_books')
        .select('id')
        .eq('supplier_id', run.supplier_id)
        .eq('status', 'published');
      if (bookErr) throw bookErr;

      let currentPrices: any[] = [];
      if (priceBooks && priceBooks.length > 0) {
        const bookIds = priceBooks.map((b) => b.id);
        const { data: priceItems, error: itemsErr } = await supabase
          .from('price_book_items')
          .select('*')
          .in('price_book_id', bookIds);
        if (itemsErr) throw itemsErr;
        currentPrices = priceItems || [];
      }

      // Format staged data back to ParsedRow structures
      const stagedRows = stagedProducts.map((sp) => {
        const productPrices = stagedPrices
          .filter((p) => p.sku === sp.sku)
          .map((p) => ({
            sku: p.sku,
            tier_code: p.tier_code,
            min_quantity: p.min_quantity,
            price_cents: p.price_cents || 0,
          }));

        return {
          product: sp.mapped_payload as any,
          prices: productPrices,
        };
      });

      // Calculate diffs
      const calculatedDiffs = diffCatalog(stagedRows, currentComponents || [], currentPrices);
      setDiffs(calculatedDiffs);

      // Map decisions
      const initialDecisions: Record<string, any> = {};
      stagedProducts.forEach((sp) => {
        initialDecisions[sp.sku!] = sp.decision;
      });
      setDecisions(initialDecisions);
    } catch (err: any) {
      toast.error(`Failed to load staging data: ${err.message}`);
      setStatus('idle');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndParse = async () => {
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    const parser = getParser(format);
    if (!parser) {
      toast.error(`Parser not found for format: ${format}`);
      return;
    }

    setStatus('parsing');
    try {
      const buffer = await file.arrayBuffer();
      const parsedRows = await parser.parse(buffer);

      if (parsedRows.length === 0) {
        throw new Error('No valid rows parsed from the uploaded file.');
      }

      // 1. Create import run row
      const { data: run, error: runErr } = await supabase
        .from('import_runs')
        .insert({
          supplier_id: supplierId,
          source_format: format,
          source_filename: file.name,
          status: 'parsing',
          row_count: parsedRows.length,
          org_id: orgId,
        })
        .select('*')
        .single();

      if (runErr) throw runErr;

      // 2. Insert staging products and prices in batches
      const stagingProductsPayload = parsedRows.map((row) => ({
        import_run_id: run.id,
        supplier_id: supplierId,
        sku: row.product.sku,
        name: row.product.name,
        raw_payload: row.product.metadata || {},
        mapped_payload: row.product,
        decision: 'pending',
        org_id: orgId,
      }));

      const { error: spErr } = await supabase
        .from('staging_products')
        .insert(stagingProductsPayload);
      if (spErr) throw spErr;

      const stagingPricesPayload = parsedRows.flatMap((row) =>
        row.prices.map((price) => ({
          import_run_id: run.id,
          sku: price.sku,
          tier_code: price.tier_code,
          min_quantity: price.min_quantity,
          price_cents: price.price_cents,
          raw_payload: {},
          org_id: orgId,
        }))
      );

      const { error: priceErr } = await supabase
        .from('staging_price_book_items')
        .insert(stagingPricesPayload);
      if (priceErr) throw priceErr;

      // 3. Update status of run to ready_for_review
      const { error: updateErr } = await supabase
        .from('import_runs')
        .update({ status: 'ready_for_review' })
        .eq('id', run.id);
      if (updateErr) throw updateErr;

      toast.success(`Parsed and staged ${parsedRows.length} items successfully`);
      setActiveRunId(run.id);
      navigate(`/admin/imports/${run.id}/review`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      setStatus('idle');
    }
  };

  const handleUpdateDecision = async (sku: string, decision: 'approve' | 'reject' | 'needs_review') => {
    try {
      const { error } = await supabase
        .from('staging_products')
        .update({ decision })
        .eq('import_run_id', activeRunId!)
        .eq('sku', sku);

      if (error) throw error;

      setDecisions((prev) => ({ ...prev, [sku]: decision }));
    } catch (err: any) {
      toast.error(`Failed to save decision: ${err.message}`);
    }
  };

  const handleBulkApprove = async (filter: 'new' | 'changed' | 'unchanged' | 'all') => {
    try {
      const skusToApprove = diffs
        .filter((d) => filter === 'all' || d.status === filter)
        .map((d) => d.sku);

      if (skusToApprove.length === 0) {
        toast.info('No items match this filter');
        return;
      }

      const { error } = await supabase
        .from('staging_products')
        .update({ decision: 'approve' })
        .eq('import_run_id', activeRunId!)
        .in('sku', skusToApprove);

      if (error) throw error;

      setDecisions((prev) => {
        const next = { ...prev };
        skusToApprove.forEach((sku) => {
          next[sku] = 'approve';
        });
        return next;
      });

      toast.success(`Approved ${skusToApprove.length} items`);
    } catch (err: any) {
      toast.error(`Bulk approval failed: ${err.message}`);
    }
  };

  const handleBulkReject = async () => {
    try {
      const skusToReject = diffs
        .filter((d) => decisions[d.sku] !== 'approve')
        .map((d) => d.sku);

      if (skusToReject.length === 0) {
        toast.info('No unapproved items remaining');
        return;
      }

      const { error } = await supabase
        .from('staging_products')
        .update({ decision: 'reject' })
        .eq('import_run_id', activeRunId!)
        .in('sku', skusToReject);

      if (error) throw error;

      setDecisions((prev) => {
        const next = { ...prev };
        skusToReject.forEach((sku) => {
          next[sku] = 'reject';
        });
        return next;
      });

      toast.success(`Rejected ${skusToReject.length} items`);
    } catch (err: any) {
      toast.error(`Bulk rejection failed: ${err.message}`);
    }
  };

  const handlePublish = async () => {
    const approvedSkus = Object.entries(decisions)
      .filter(([_, dec]) => dec === 'approve')
      .map(([sku]) => sku);

    if (approvedSkus.length === 0) {
      toast.error('No items have been approved. Please approve at least one item.');
      return;
    }

    setStatus('publishing');
    try {
      // 1. Fetch approved products staging records
      const { data: stagingProds, error: prodErr } = await supabase
        .from('staging_products')
        .select('*')
        .eq('import_run_id', activeRunId!)
        .in('sku', approvedSkus);
      if (prodErr) throw prodErr;

      // 2. Fetch approved price items staging records
      const { data: stagingPrices, error: priceErr } = await supabase
        .from('staging_price_book_items')
        .select('*')
        .eq('import_run_id', activeRunId!)
        .in('sku', approvedSkus);
      if (priceErr) throw priceErr;

      // 3. Upsert into product_components
      const componentsToUpsert = stagingProds.map((sp) => {
        const payload = sp.mapped_payload as any;
        return {
          org_id: orgId,
          sku: sp.sku,
          name: sp.name,
          category: payload.category || 'accessory',
          system_types: payload.system_types || ['QSHS'],
          colours: payload.colours || null,
          sizes: payload.sizes || null,
          metadata: payload.metadata || {},
          active: true,
          supplier_id: supplierId,
        };
      });

      const { error: compErr } = await supabase
        .from('product_components')
        .upsert(componentsToUpsert, { onConflict: 'org_id,sku' });
      if (compErr) throw compErr;

      // 4. Create new price book for supplier
      const supplierRecord = suppliers.find((s) => s.id === supplierId);
      const supplierName = supplierRecord?.name || 'Supplier';

      const { data: newPriceBook, error: pbErr } = await supabase
        .from('price_books')
        .insert({
          supplier_id: supplierId,
          name: `${supplierName} Catalog Publish - ${new Date().toLocaleDateString()}`,
          status: 'published',
          effective_from: new Date().toISOString().split('T')[0],
          org_id: orgId,
        })
        .select('*')
        .single();
      if (pbErr) throw pbErr;

      // 5. Invalidate previous published price books for supplier
      const { error: archiveErr } = await supabase
        .from('price_books')
        .update({ status: 'archived' })
        .eq('supplier_id', supplierId)
        .eq('status', 'published')
        .neq('id', newPriceBook.id);
      if (archiveErr) throw archiveErr;

      // 6. Insert new price book items
      const priceBookItemsToInsert = stagingPrices.map((sp) => ({
        price_book_id: newPriceBook.id,
        sku: sp.sku,
        tier_code: sp.tier_code,
        min_quantity: sp.min_quantity,
        price_cents: sp.price_cents,
        currency: 'AUD',
        metadata: {},
      }));

      const { error: pbiErr } = await supabase
        .from('price_book_items')
        .insert(priceBookItemsToInsert);
      if (pbiErr) throw pbiErr;

      // 7. Update import run status to imported
      const { error: runErr } = await supabase
        .from('import_runs')
        .update({ status: 'imported' })
        .eq('id', activeRunId!);
      if (runErr) throw runErr;

      toast.success('Catalogue published successfully');
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['admin-all-components'] });
    } catch (err: any) {
      toast.error(`Publishing failed: ${err.message}`);
      setStatus('reviewing');
    }
  };

  return (
    <AdminLayout
      title={isReviewMode ? 'Review Imported Catalogue' : 'Import Wholesaler File'}
      subtitle={isReviewMode ? 'Diff staged rows against current catalogue and select publication choices.' : 'Upload inventory XLSX or generic CSV files into a staging environment.'}
    >
      <div className="mb-4">
        <Button
          onClick={() => navigate('/admin/products')}
          variant="secondary"
          icon={ArrowLeft}
        >
          Back to Catalogue
        </Button>
      </div>

      {status === 'parsing' && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
          <div className="text-sm text-brand-text font-medium">Parsing and staging catalog file…</div>
          <div className="text-xs text-brand-muted">This may take a moment depending on the file size.</div>
        </div>
      )}

      {status === 'publishing' && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
          <div className="text-sm text-brand-text font-medium">Publishing new catalogue and archiving old price books…</div>
          <div className="text-xs text-brand-muted">Writing records directly to components and pricing systems.</div>
        </div>
      )}

      {status === 'done' && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-400" />
          <div className="text-lg text-brand-text font-semibold">Publish Complete!</div>
          <div className="text-xs text-brand-muted max-w-sm">
            The approved products and pricing rules have been applied. Future quote calculations will immediately use this published price book.
          </div>
          <Button onClick={() => navigate('/admin/products')} variant="primary">
            Return to Catalogue
          </Button>
        </div>
      )}

      {status === 'idle' && !isReviewMode && (
        <div className="max-w-xl bg-brand-card border border-brand-border rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Select Wholesaler / Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text focus:outline-none focus:border-brand-accent text-sm"
              >
                <option value="">Select a Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Import Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text focus:outline-none focus:border-brand-accent text-sm"
              >
                <option value="cin7_mass_download">Cin7 Inventory XLSX Export</option>
                <option value="generic_csv">Generic CSV price list</option>
              </select>
            </div>
          </div>

          <div className="border border-dashed border-brand-border rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 bg-brand-bg/10 hover:bg-brand-bg/20 transition-colors cursor-pointer relative">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-brand-muted" />
            <div className="text-xs text-brand-text font-medium">
              {file ? `Selected file: ${file.name}` : 'Click to select or drag your catalog file here'}
            </div>
            <div className="text-[10px] text-brand-muted">Supports CSV, XLSX, and XLS formats</div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUploadAndParse}
              variant="primary"
              disabled={!file || !supplierId}
              data-testid="start-import-btn"
            >
              Upload & Parse
            </Button>
          </div>
        </div>
      )}

      {status === 'reviewing' && isReviewMode && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-brand-card border border-brand-border p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-brand-accent/10 border border-brand-accent/20">
                <Sparkles className="w-5 h-5 text-brand-accent" />
              </div>
              <div>
                <div className="text-sm font-semibold text-brand-text">Catalogue Review Staging</div>
                <div className="text-xs text-brand-muted mt-0.5">
                  Approve or reject diff results below, then click publish to apply changes.
                </div>
              </div>
            </div>

            <Button
              onClick={handlePublish}
              variant="primary"
              data-testid="publish-import-btn"
            >
              Publish Approved Catalogue
            </Button>
          </div>

          <DiffTable
            diffs={diffs}
            decisions={decisions}
            onApprove={(sku) => handleUpdateDecision(sku, 'approve')}
            onReject={(sku) => handleUpdateDecision(sku, 'reject')}
            onNeedsReview={(sku) => handleUpdateDecision(sku, 'needs_review')}
            onBulkApprove={handleBulkApprove}
            onBulkReject={handleBulkReject}
          />
        </div>
      )}
    </AdminLayout>
  );
}
export default ImportPage;
