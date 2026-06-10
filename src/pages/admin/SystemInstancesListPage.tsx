import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { listSystemInstances, listAllSuppliers, listArchetypes } from '../../lib/multiSupplier/queries';
import { deleteSystemInstance, updateSystemInstanceStatus } from '../../lib/multiSupplier/mutations';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { useProfile } from '../../context/ProfileContext';

const TIER_BADGES: Record<string, string> = {
  platform: 'text-brand-accent bg-brand-accent/10 border-brand-accent/30',
  verified: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  community: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  user: 'text-brand-muted bg-brand-border/20 border-brand-border/40',
};

const STATUS_BADGES: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  hidden: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  draft: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  discontinued: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const READINESS_BADGES: Record<string, string> = {
  draft: 'text-brand-muted bg-brand-border/20 border-brand-border/30',
  imported: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  calculator_ready: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  price_checked: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  spreadsheet_tested: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

export function SystemInstancesListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin, userType, orgId } = useProfile();

  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [archetypeFilter, setArchetypeFilter] = useState('');

  // Fetch lists for mappings and dropdown options
  const { data: suppliers = [] } = useQuery({
    queryKey: ['admin', 'suppliers', 'all'],
    queryFn: listAllSuppliers,
  });

  const { data: archetypes = [] } = useQuery({
    queryKey: ['admin', 'archetypes'],
    queryFn: listArchetypes,
  });

  // For supplier staff, preset supplier filter to their own supplier id if resolved
  const userSupplier = useMemo(() => {
    if (isAdmin) return null;
    return suppliers.find((s) => s.orgId === orgId);
  }, [suppliers, orgId, isAdmin]);

  const effectiveSupplierFilter = useMemo(() => {
    if (!isAdmin && userType === 'supplier_staff') {
      return userSupplier?.id || 'NO_SUPPLIER_FOUND';
    }
    return supplierFilter;
  }, [isAdmin, userType, userSupplier, supplierFilter]);

  const { data: instances = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'instances', effectiveSupplierFilter, archetypeFilter],
    queryFn: () => listSystemInstances({
      supplierId: effectiveSupplierFilter || undefined,
      archetypeId: archetypeFilter || undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSystemInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'instances'] });
      toast.success('System instance deleted successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to delete system instance: ${err.message}`);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => updateSystemInstanceStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'instances'] });
      toast.success('Calculator status updated successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to update calculator status: ${err.message}`);
    },
  });

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'hidden' : 'active';
    toggleStatusMutation.mutate({ id, status: newStatus });
  };

  // Pre-calculate maps for fast name resolving
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const archetypeMap = useMemo(() => new Map(archetypes.map((a) => [a.id, a.name])), [archetypes]);

  const filteredInstances = useMemo(() => {
    let result = instances;
    if (!isAdmin && userType === 'supplier_staff' && orgId) {
      result = instances.filter((inst) => inst.orgId === orgId);
    }
    return result.filter((inst) => {
      const term = search.toLowerCase();
      const supplierName = inst.supplierId ? (supplierMap.get(inst.supplierId) || '') : '';
      const archetypeName = archetypeMap.get(inst.archetypeId) || '';

      return (
        inst.name.toLowerCase().includes(term) ||
        inst.slug.toLowerCase().includes(term) ||
        supplierName.toLowerCase().includes(term) ||
        archetypeName.toLowerCase().includes(term)
      );
    });
  }, [instances, search, supplierMap, archetypeMap, isAdmin, userType, orgId]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete system instance "${name}"? This action cannot be undone.`)) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <AdminLayout
      title="System Instances"
      subtitle="Configure system instances mapped to specific suppliers and core archetypes."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search instances by name, slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-brand-card border border-brand-border rounded-lg text-brand-text placeholder:text-brand-muted/60 focus:outline-none focus:border-brand-accent"
              data-testid="instance-search-input"
            />
          </div>

          {isAdmin && (
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="text-sm bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:border-brand-accent min-w-[150px]"
              data-testid="instance-supplier-filter"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={archetypeFilter}
            onChange={(e) => setArchetypeFilter(e.target.value)}
            className="text-sm bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:border-brand-accent min-w-[150px]"
            data-testid="instance-archetype-filter"
          >
            <option value="">All Archetypes</option>
            {archetypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <Button
            onClick={() => navigate('/admin/system-instances/new')}
            variant="primary"
            icon={Plus}
            data-testid="create-instance-btn"
          >
            New Instance
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-brand-muted animate-pulse">Loading system instances…</div>
      ) : error ? (
        <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-lg text-sm text-brand-danger">
          {(error as Error).message}
        </div>
      ) : (
        <div className="rounded-lg border border-brand-border overflow-hidden bg-brand-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg/50">
                  <th className="px-4 py-3 font-medium text-brand-muted">Name</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Slug</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Supplier</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Archetype</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Readiness</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Trust</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Visibility</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-brand-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40">
                {filteredInstances.map((inst) => (
                  <tr key={inst.id} className="hover:bg-brand-border/10 transition-colors" data-testid="instance-row">
                    <td className="px-4 py-3 font-semibold text-brand-text">
                      <Link to={`/admin/system-instances/${inst.id}/edit`} className="hover:text-brand-accent transition-colors">
                        {inst.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-muted">{inst.slug}</td>
                    <td className="px-4 py-3 text-brand-text">
                      {inst.supplierId ? (supplierMap.get(inst.supplierId) || '—') : '—'}
                    </td>
                    <td className="px-4 py-3 text-brand-muted">{archetypeMap.get(inst.archetypeId) || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${READINESS_BADGES[inst.readinessStatus]}`}>
                        {inst.readinessStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${TIER_BADGES[inst.trustTier]}`}>
                        {inst.trustTier}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-muted">{inst.visibility}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(inst.id, inst.status)}
                          disabled={toggleStatusMutation.isPending}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            inst.status === 'active' ? 'bg-brand-accent' : 'bg-brand-border/40'
                          } disabled:opacity-50`}
                          title={inst.status === 'active' ? 'Click to hide this calculator' : 'Click to activate this calculator'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              inst.status === 'active' ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${STATUS_BADGES[inst.status]}`}>
                          {inst.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/system-instances/${inst.id}/edit`}
                          className="p-1 text-brand-muted hover:text-brand-accent transition-colors"
                          title="Edit Instance"
                          data-testid="edit-instance-link"
                        >
                          <Edit2 size={13} />
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(inst.id, inst.name)}
                            className="p-1 text-brand-muted hover:text-brand-danger transition-colors disabled:opacity-40"
                            title="Delete Instance"
                            disabled={deleteMutation.isPending}
                            data-testid="delete-instance-btn"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInstances.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-brand-muted">
                      No system instances found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
