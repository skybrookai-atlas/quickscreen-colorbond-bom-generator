import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { AnyfenceLogo } from "../components/brand/AnyfenceLogo";
import { listSuppliers, listSystemInstances } from "../lib/multiSupplier/queries";
import { 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  Building, 
  Hammer,
  Search,
  ExternalLink,
  ChevronRight,
  Plus
} from "lucide-react";
import { toast } from "sonner";

export function ContractorPortalPage() {
  const [bunningsEnabled, setBunningsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("qsg-bunnings-enabled") === "true";
  });

  const [searchQuery, setSearchQuery] = useState("");

  const { data: suppliers, isLoading: loadingSuppliers } = useQuery({
    queryKey: ["suppliers", "list"],
    queryFn: () => listSuppliers(),
  });

  const { data: systemInstances, isLoading: loadingInstances } = useQuery({
    queryKey: ["systemInstances", "list"],
    queryFn: () => listSystemInstances({ status: "active" }),
  });

  const handleBunningsToggle = () => {
    const nextVal = !bunningsEnabled;
    setBunningsEnabled(nextVal);
    window.localStorage.setItem("qsg-bunnings-enabled", String(nextVal));
    // Dispatch a storage event so open tabs synchronize instantly
    window.dispatchEvent(new Event("storage"));
    toast.success(nextVal ? "Bunnings lookup integration enabled!" : "Bunnings integration disabled.");
  };

  const filteredSuppliers = suppliers?.filter(supplier => 
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <AppShell>
      <div className="min-h-screen bg-brand-bg text-brand-text p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6">
            <div>
              <h1 className="text-3xl font-black flex items-center gap-3">
                <Hammer className="text-brand-primary animate-pulse" size={32} />
                Contractor Master Hub
              </h1>
              <p className="text-brand-muted text-sm mt-1">
                Access custom calculators across all national suppliers, configure client quotes, and swap supplier price lists.
              </p>
            </div>
            
            {/* Bunnings Toggle */}
            <div className="flex items-center gap-3 bg-brand-card p-3 rounded-xl border border-brand-border/60 shadow-sm shrink-0">
              <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5 text-brand-muted">
                <Building className="text-brand-accent" size={16} />
                Bunnings Pricing API
              </span>
              <button 
                onClick={handleBunningsToggle}
                className="text-brand-primary hover:text-brand-primary/80 transition-colors focus:outline-none"
                title="When enabled, fallback items in the BOM lookup retail pricing from a mock Bunnings index."
              >
                {bunningsEnabled ? (
                  <ToggleRight size={36} className="text-brand-primary" />
                ) : (
                  <ToggleLeft size={36} className="text-brand-muted" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Stats / Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="premium-card hover-lift p-6 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-brand-primary uppercase tracking-wider bg-brand-primary/10 border border-brand-primary/20 px-2.5 py-0.5 rounded-full inline-block">Pricing Strategy</span>
                <h3 className="text-lg font-black text-brand-text mt-3">Dynamic Switcher</h3>
                <p className="text-xs text-brand-muted mt-1.5 leading-relaxed">
                  Swap pricing books on any active quote instantly. Select another supplier inside the sidebar to compare margins.
                </p>
              </div>
              <Link to="/quotes" className="mt-5 block">
                <Button className="w-full justify-center" variant="secondary" size="small">View Quotes List</Button>
              </Link>
            </div>

            <div className="premium-card hover-lift p-6 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-brand-accent uppercase tracking-wider bg-brand-accent/10 border border-brand-accent/20 px-2.5 py-0.5 rounded-full inline-block">Shared Network</span>
                <h3 className="text-lg font-black text-brand-text mt-3">National Marketplace</h3>
                <p className="text-xs text-brand-muted mt-1.5 leading-relaxed">
                  Browse custom calculators, templates, and layouts created by community builders. Clone to your sandbox.
                </p>
              </div>
              <Link to="/marketplace" className="mt-5 block">
                <Button className="w-full justify-center" variant="secondary" size="small">Browse Marketplace</Button>
              </Link>
            </div>

            <div className="premium-card hover-lift p-6 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-green-500 uppercase tracking-wider bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full inline-block">Calculators Creator</span>
                <h3 className="text-lg font-black text-brand-text mt-3">Calculator Builder</h3>
                <p className="text-xs text-brand-muted mt-1.5 leading-relaxed">
                  Build variables, algebraic rules, SKU selector matrices, and test suites visually. Keep private or publish.
                </p>
              </div>
              <Link to="/builder" className="mt-5 block">
                <Button className="w-full justify-center" variant="primary" size="small" icon={Plus}>Create Calculator</Button>
              </Link>
            </div>

            <div className="premium-card hover-lift p-6 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full inline-block">Client Engagement</span>
                <h3 className="text-lg font-black text-brand-text mt-3">Embeddable Portal</h3>
                <p className="text-xs text-brand-muted mt-1.5 leading-relaxed">
                  Share this interactive estimator with clients so they can map runs, upload videos, and generate rough estimates.
                </p>
              </div>
              <Link to="/embed/skybrook-fencing" className="mt-5 block">
                <Button className="w-full justify-center" variant="secondary" size="small">Preview Client Embed</Button>
              </Link>
            </div>
          </div>

          {/* Generic Calculator Templates */}
          {!loadingInstances && systemInstances && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <Sparkles className="text-brand-primary animate-pulse" size={24} />
                  Generic Calculator Templates
                </h2>
                <p className="text-brand-muted text-xs mt-1 leading-relaxed">
                  Nationwide templates for fencing systems. Open a template to dynamically switch and compare supplier price lists inside.
                </p>
              </div>

              {systemInstances.filter(inst => !inst.supplierId).length === 0 ? (
                <div className="p-8 bg-brand-card/40 border border-dashed border-brand-border rounded-2xl text-center text-brand-muted text-sm animate-fade-in-scale">
                  No generic templates currently configured.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {systemInstances
                    .filter(inst => !inst.supplierId)
                    .map((calc) => (
                      <Link
                        key={calc.id}
                        to={`/calculator/${calc.slug}`}
                        className="group premium-card hover-lift p-5 flex flex-col justify-between transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3.5">
                            <span className="text-[9px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Generic Template
                            </span>
                            {calc.aiVettingStatus === "passed" && (
                              <span className="text-[9px] bg-green-500/10 border border-green-500/20 text-green-500 dark:text-green-400 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                Vetted
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-base text-brand-text group-hover:text-brand-primary transition-colors">
                            {calc.name}
                          </h3>
                          <p className="text-xs text-brand-muted mt-1.5 leading-relaxed">
                            {calc.description || "Supplier-agnostic parameter & BOM estimator."}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-brand-primary mt-5 group-hover:gap-1.5 transition-all">
                          Open Template
                          <ChevronRight size={14} />
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Supplier Catalogues List */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-black">Supplier Calculators Network</h2>
              <div className="relative max-w-sm w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-brand-card border border-brand-border rounded-lg pl-9 pr-4 py-2 text-sm text-brand-text outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            {(loadingSuppliers || loadingInstances) ? (
              <div className="text-center py-12 text-brand-muted text-sm">
                Loading suppliers registry...
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-12 bg-brand-card border border-dashed border-brand-border rounded-2xl text-brand-muted text-sm">
                No matching suppliers found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredSuppliers.map((supplier) => {
                  const supplierCalcs = systemInstances?.filter(
                    (inst) => inst.supplierId === supplier.id
                  ) ?? [];

                  return (
                    <div 
                      key={supplier.id} 
                      className="bg-brand-card border border-brand-border/60 rounded-3xl p-6 space-y-4 hover:shadow-lg transition-all"
                    >
                      {/* Supplier header */}
                      <div className="flex items-center justify-between border-b border-brand-border/40 pb-4">
                        <div className="flex items-center gap-3">
                          {supplier.logoUrl ? (
                            <img 
                              src={supplier.logoUrl} 
                              alt={supplier.name} 
                              className="h-10 w-10 object-contain rounded-lg bg-white/5 p-1 border border-brand-border/30"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center font-black text-brand-primary text-sm">
                              {supplier.name[0]}
                            </div>
                          )}
                          <div>
                            <h3 className="font-black text-lg text-brand-text flex items-center gap-1.5">
                              {supplier.name}
                              {supplier.trustTier === "verified" && (
                                <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold px-1.5 py-0.5 rounded">
                                  Verified
                                </span>
                              )}
                            </h3>
                            <p className="text-[11px] text-brand-muted">{supplier.contactEmail || "No contact email listed"}</p>
                          </div>
                        </div>
                        <Link 
                          to={`/s/${supplier.slug}`}
                          className="text-brand-muted hover:text-brand-primary flex items-center gap-1 text-xs font-bold transition-colors"
                        >
                          Portal
                          <ExternalLink size={14} />
                        </Link>
                      </div>

                      {/* Calculators list */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-brand-muted">
                          Available Calculators ({supplierCalcs.length})
                        </h4>
                        
                        {supplierCalcs.length === 0 ? (
                          <p className="text-xs text-brand-muted italic py-2">
                            No active calculators configured for this supplier.
                          </p>
                        ) : (
                          <div className="grid gap-2">
                            {supplierCalcs.map((calc) => (
                              <Link 
                                key={calc.id}
                                to={`/s/${supplier.slug}/calculator/${calc.slug}`}
                                className="flex items-center justify-between p-3 rounded-xl border border-brand-border/40 bg-brand-bg/40 hover:bg-brand-border/10 hover:border-brand-primary/40 transition-all text-left"
                              >
                                <div className="min-w-0 pr-4">
                                  <p className="text-xs font-bold text-brand-text truncate">
                                    {calc.name}
                                  </p>
                                  <p className="text-[10px] text-brand-muted truncate mt-0.5">
                                    {calc.description || "Interactive Bill of Materials calculator."}
                                  </p>
                                </div>
                                <ChevronRight size={14} className="text-brand-muted shrink-0" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Supplier Selector Info block */}
          <div className="bg-brand-card border border-brand-border rounded-3xl p-8 text-center max-w-xl mx-auto py-12 flex flex-col items-center">
            <AnyfenceLogo showSubtitle={true} className="mb-4" iconClassName="h-10 w-10 text-brand-primary" textClassName="text-2xl" />
            <h3 className="text-lg font-black text-brand-text">National Suppliers & Contractors Portal</h3>
            <p className="text-sm text-brand-muted mt-2 max-w-sm mx-auto leading-relaxed">
              Every calculator created here works dynamically. To share a specific supplier portal with clients, copy their direct Portal URL shown above.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-accent/15 border border-brand-accent/25 text-brand-accent font-semibold flex items-center gap-1">
                <Sparkles size={12} />
                Master Network Online
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
