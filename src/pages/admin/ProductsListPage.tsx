import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, GitBranch, Variable, Puzzle, ChevronRight, Plus, Upload } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { listAllSuppliers, listSystemInstances } from '../../lib/multiSupplier/queries';
import { Button } from '../../components/ui/Button';

const TYPE_COLOURS: Record<string, string> = {
  fence: 'text-brand-accent bg-brand-accent/10 border-brand-accent/30',
  gate: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  other: 'text-brand-muted bg-brand-border/20 border-brand-border/40',
};

export function ProductsListPage() {
  const navigate = useNavigate();
  const { data: products = [], isLoading, error } = useAdminProducts();
  const [supplierFilter, setSupplierFilter] = useState('');
  const [instanceFilter, setInstanceFilter] = useState('');

  const { data: suppliers = [] } = useQuery({
    queryKey: ['admin', 'suppliers', 'all'],
    queryFn: listAllSuppliers,
  });

  const { data: instances = [] } = useQuery({
    queryKey: ['admin', 'instances', 'all'],
    queryFn: () => listSystemInstances(),
  });

  // Filter products by selected supplier and instance
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      if (supplierFilter && p.supplier_id !== supplierFilter) return false;
      if (instanceFilter && p.system_instance_id !== instanceFilter) return false;
      return true;
    });
  }, [products, supplierFilter, instanceFilter]);

  const fences = filteredProducts.filter((p: any) => p.product_type === 'fence');
  const gates = filteredProducts.filter((p: any) => p.product_type === 'gate');
  const others = filteredProducts.filter((p: any) => p.product_type === 'other');

  return (
    <AdminLayout
      title="Product Catalogue"
      subtitle="Manage all system products, configure their variables and rules, or import whole supplier catalogs."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-sm bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:border-brand-accent min-w-[160px]"
            data-testid="product-supplier-filter"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={instanceFilter}
            onChange={(e) => setInstanceFilter(e.target.value)}
            className="text-sm bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:border-brand-accent min-w-[180px]"
            data-testid="product-instance-filter"
          >
            <option value="">All Instances</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({inst.slug})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/admin/imports/new')}
            variant="secondary"
            icon={Upload}
            data-testid="import-catalogue-btn"
          >
            Import Wholesaler File
          </Button>
          <Button
            onClick={() => navigate('/admin/products/new')}
            variant="primary"
            icon={Plus}
            data-testid="create-product-btn"
          >
            New Product
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-brand-muted animate-pulse">Loading products…</div>
      )}
      {error && (
        <div className="text-sm text-red-400 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error.message}
        </div>
      )}

      {!isLoading && !error && filteredProducts.length === 0 && (
        <div className="py-12 text-center text-sm text-brand-muted border border-dashed border-brand-border rounded-lg bg-brand-card">
          No products match the selected filters.
        </div>
      )}

      {[
        { label: 'Fences', items: fences },
        { label: 'Gates', items: gates },
        { label: 'Other', items: others },
      ].map(
        ({ label, items }) =>
          items.length > 0 && (
            <section key={label} className="mb-8">
              <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">
                {label} ({items.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((product: any) => {
                  const ruleCount = product.product_rules?.[0]?.count ?? 0;
                  const varCount = product.product_variables?.[0]?.count ?? 0;
                  const selectorCount = product.product_component_selectors?.[0]?.count ?? 0;
                  const ruleSetCount = product.rule_sets?.[0]?.count ?? 0;

                  return (
                    <div
                      key={product.id}
                      className="group block bg-brand-card border border-brand-border rounded-lg p-4 hover:border-brand-accent/40 hover:shadow-md transition-all relative"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-brand-border/30">
                            <Package size={14} className="text-brand-muted" />
                          </div>
                          <div>
                            <Link
                              to={`/admin/products/${product.id}`}
                              className="text-sm font-semibold text-brand-text hover:text-brand-accent transition-colors block"
                            >
                              {product.name}
                            </Link>
                            <div className="text-xs text-brand-muted font-mono mt-0.5">
                              {product.system_type}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded border ${
                              TYPE_COLOURS[product.product_type] ?? TYPE_COLOURS.other
                            }`}
                          >
                            {product.product_type}
                          </span>
                          {!product.active && (
                            <span className="text-xs px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/30">
                              inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-xs text-brand-muted mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      {product.compatible_with_system_types?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {product.compatible_with_system_types.map((st: string) => (
                            <span
                              key={st}
                              className="text-xs px-1.5 py-0.5 rounded bg-brand-bg border border-brand-border text-brand-muted"
                            >
                              {st}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-border/50">
                        <div className="flex items-center gap-1.5 text-xs text-brand-muted">
                          <GitBranch size={11} />
                          <span>{ruleSetCount} set{ruleSetCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-brand-muted">
                          <Variable size={11} />
                          <span>{varCount} var{varCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-brand-muted">
                          <Puzzle size={11} />
                          <span>{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-brand-border/30 text-xs">
                        <Link
                          to={`/admin/products/${product.id}/edit`}
                          className="text-brand-accent hover:underline"
                          data-testid="edit-product-link"
                        >
                          Edit Details
                        </Link>
                        <Link
                          to={`/admin/products/${product.id}`}
                          className="flex items-center gap-0.5 text-brand-muted hover:text-brand-text"
                        >
                          Engine ({selectorCount})
                          <ChevronRight size={12} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )
      )}
    </AdminLayout>
  );
}
export default ProductsListPage;
