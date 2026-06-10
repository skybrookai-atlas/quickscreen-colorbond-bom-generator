import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useBranding } from "../hooks/useBranding";
import { listSystemInstances } from "../lib/multiSupplier/queries";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import { AmazingFencingLogo } from "../components/brand/AmazingFencingLogo";
import { 
  ArrowRight, 
  Compass, 
  Layout, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Users,
  Sliders
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "../context/ProfileContext";

export function SupplierPortalPage() {
  const navigate = useNavigate();
  const { supplier, isLoading, branding, logoUrl, bannerUrl } = useBranding();
  const { user, userType, orgSlug } = useProfile();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"builder" | "contractors" | "prices">("builder");

  const canManage = !!user && (userType === 'admin' || (userType === 'supplier_staff' && orgSlug === supplier?.slug));

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const isAmazing = supplier?.slug === "amazing-fencing";

  const { data: instances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ["supplierInstances", supplier?.id],
    queryFn: () => supplier ? listSystemInstances({ supplierId: supplier.id, status: "active" }) : Promise.resolve([]),
    enabled: !!supplier,
  });

  const { data: pricingData, isLoading: loadingPrices } = useQuery({
    queryKey: ["supplierPrices", supplier?.orgId, search, page, activeTab],
    queryFn: async () => {
      if (!supplier?.orgId) return { items: [], total: 0 };
      
      let q = supabase
        .from('product_components')
        .select('id, sku, name, category, unit, default_price', { count: 'exact' })
        .eq('org_id', supplier.orgId);
        
      if (search.trim()) {
        q = q.or(`sku.ilike.%${search}%,name.ilike.%${search}%`);
      }
      
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data: comps, error: compErr, count } = await q
        .order('sku', { ascending: true })
        .range(from, to);
        
      if (compErr) throw compErr;
      if (!comps || comps.length === 0) return { items: [], total: 0 };
      
      const compIds = comps.map(c => c.id);
      const { data: rules, error: rulesErr } = await supabase
        .from('pricing_rules')
        .select('component_id, price, tier_code')
        .in('component_id', compIds)
        .in('tier_code', ['tier1', 'tier2', 'tier3']);
        
      if (rulesErr) throw rulesErr;
      
      const items = comps.map(comp => {
        const compRules = rules?.filter(r => r.component_id === comp.id) || [];
        const t1 = compRules.find(r => r.tier_code === 'tier1')?.price ?? comp.default_price ?? 0;
        const t2 = compRules.find(r => r.tier_code === 'tier2')?.price ?? t1;
        const t3 = compRules.find(r => r.tier_code === 'tier3')?.price ?? t2;
        return {
          sku: comp.sku,
          name: comp.name,
          category: comp.category,
          unit: comp.unit,
          retailPrice: t1,
          tradePrice: t2,
          wholesalePrice: t3,
        };
      });
      
      return { items, total: count ?? 0 };
    },
    enabled: !!supplier?.orgId && activeTab === "prices",
  });

  // Reset page on search change
  useEffect(() => {
    setPage(0);
  }, [search]);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-brand-bg text-brand-text">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
        <p className="mt-4 text-sm text-brand-muted animate-pulse">Loading portal…</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-brand-bg text-brand-text">
        <h1 className="text-xl font-bold text-brand-danger">Portal Not Found</h1>
        <p className="text-sm text-brand-muted mt-2">The requested supplier page could not be resolved.</p>
        <Button onClick={() => navigate("/login")} className="mt-4" variant="primary">
          Back to Login
        </Button>
      </div>
    );
  }

  return (
    <AppShell branding={branding} brandLogoSrc={isAmazing ? undefined : logoUrl} brandLogoAlt={supplier.name}>
      <div className="min-h-full bg-brand-bg pb-12">
        {/* Banner Section */}
        <div 
          className="relative h-48 sm:h-64 w-full bg-gradient-to-r from-brand-primary/20 to-brand-accent/10 border-b border-brand-border/60 flex items-center px-6 sm:px-12 overflow-hidden"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          {bannerUrl && <div className="absolute inset-0 bg-black/40 z-0" />}
          
          <div className="relative z-10 flex w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-6 max-w-6xl mx-auto">
            <div className="max-w-3xl">
              <h1 className="text-2xl sm:text-4xl font-black text-brand-text drop-shadow-sm flex items-center gap-3">
                {isAmazing && <AmazingFencingLogo className="scale-75 origin-left hidden sm:block" />}
                <span>Welcome to {supplier.name}</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-brand-muted max-w-xl leading-relaxed">
                {supplier.metadata?.description as string ?? "Fencing and screening calculators customized for your layout requirements."}
              </p>
            </div>
            {canManage && (
              <div className="flex shrink-0">
                <Button
                  onClick={() => navigate('/admin/system-instances')}
                  variant="secondary"
                  className="bg-brand-card/90 hover:bg-brand-card text-brand-text border-brand-border/60 font-bold text-xs shadow-md hover:shadow-lg transition-all"
                >
                  <Sliders size={14} className="mr-1.5 text-brand-accent" />
                  Manage Calculators
                </Button>
              </div>
            )}
            {isAmazing && (
              <div className="sm:hidden flex justify-start">
                <AmazingFencingLogo className="scale-75 origin-left" />
              </div>
            )}
          </div>
        </div>

        {/* Tab Selection if Amazing Fencing */}
        {isAmazing ? (
          <div className="max-w-6xl mx-auto px-6 mt-8">
            <div className="flex border-b border-brand-border/60 mb-6 bg-brand-card/30 p-1 rounded-lg backdrop-blur">
              <button
                onClick={() => setActiveTab("builder")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-md transition-all ${
                  activeTab === "builder"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-brand-muted hover:text-brand-text hover:bg-brand-border/10"
                }`}
              >
                <Layout size={16} />
                Fence Builder
              </button>
              <button
                onClick={() => setActiveTab("contractors")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-md transition-all ${
                  activeTab === "contractors"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-brand-muted hover:text-brand-text hover:bg-brand-border/10"
                }`}
              >
                <Users size={16} />
                Contractors
              </button>
              <button
                onClick={() => setActiveTab("prices")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-md transition-all ${
                  activeTab === "prices"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-brand-muted hover:text-brand-text hover:bg-brand-border/10"
                }`}
              >
                <Database size={16} />
                Material Prices
              </button>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === "builder" && renderCalculators()}
            {activeTab === "contractors" && renderContractors()}
            {activeTab === "prices" && renderPricingTable()}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-6 mt-8">
            <h2 className="text-lg font-bold text-brand-text mb-4 flex items-center gap-2">
              <Layout size={18} className="text-brand-primary" />
              Available Calculators
            </h2>
            {renderCalculators()}
          </div>
        )}
      </div>
    </AppShell>
  );

  function renderCalculators() {
    if (loadingInstances) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 bg-brand-card border border-brand-border/40 rounded-xl" />
          ))}
        </div>
      );
    }

    if (isAmazing) {
      const amazingCalculators = [
        {
          id: "amazing-colorbond",
          name: "Colorbond",
          description: "Premium Colorbond steel panel fencing sourced from multiple brand partners. Configure posts, rails, sheets, and options.",
          link: `/s/${supplier!.slug}/calculator/amazing-colorbond`,
          trustTier: "platform"
        },
        {
          id: "amazing-timber",
          name: "Timber",
          description: "Treated pine paling fencing in Colonial, Lapped, and Lapped-and-Capped styles. Customise rails, posts, and heights.",
          link: `/s/${supplier!.slug}/calculator/amazing-timber-paling`,
          trustTier: "platform"
        },
        {
          id: "amazing-retaining-wall",
          name: "Retaining Wall",
          description: "Timber sleeper retaining walls using H4 treated pine or hardwood sleepers. Build to correct uneven terrain.",
          link: `/s/${supplier!.slug}/calculator/amazing-retaining-wall`,
          trustTier: "platform"
        },
        {
          id: "amazing-slats",
          name: "Aluminium Slats",
          description: "QuickScreen Horizontal Slat screening and fencing systems. Sourced from the Glass Outlet catalogue.",
          link: "/s/glass-outlet/calculator/qshs",
          trustTier: "platform"
        }
      ];

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {amazingCalculators.map((calc) => (
            <Link
              key={calc.id}
              to={calc.link}
              state={location.state}
              className="group bg-brand-card hover:bg-brand-border/5 border border-brand-border/60 hover:border-brand-primary/50 transition-all rounded-xl p-5 shadow-sm hover:shadow flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base font-black text-brand-text group-hover:text-brand-primary transition-colors">
                  {calc.name}
                </h3>
                <p className="text-xs text-brand-muted mt-2 leading-relaxed line-clamp-3">
                  {calc.description}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-brand-primary pt-2 border-t border-brand-border/30">
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand-primary/30 uppercase tracking-wider font-semibold bg-brand-primary/10">
                  {calc.trustTier}
                </span>
                <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Open Calculator
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    return instances.length === 0 ? (
      <div className="text-center py-12 bg-brand-card border border-brand-border rounded-xl p-8 max-w-md mx-auto mt-6">
        <Compass size={40} className="text-brand-muted mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-brand-text">No calculators published</h3>
        <p className="text-xs text-brand-muted mt-1">This supplier doesn't have any active approved calculators yet.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instances.map((instance) => (
          <Link
            key={instance.id}
            to={`/s/${supplier!.slug}/calculator/${instance.slug}`}
            state={location.state}
            className="group premium-card hover-lift p-5 flex flex-col justify-between"
          >
            <div>
              <h3 className="text-base font-black text-brand-text group-hover:text-brand-primary transition-colors">
                {instance.name}
              </h3>
              <p className="text-xs text-brand-muted mt-2 leading-relaxed line-clamp-3">
                {instance.description || "Design and generate bill of materials for this fencing system."}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-brand-primary pt-2 border-t border-brand-border/30">
              <span className="text-[9px] px-2 py-0.5 rounded border border-brand-primary/30 uppercase tracking-wider font-extrabold bg-brand-primary/10">
                {instance.trustTier}
              </span>
              <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform font-bold">
                Open Calculator
                <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  function renderContractors() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Davey Windsor Business Card Info */}
        <div className="bg-brand-card border border-brand-border/60 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-black text-brand-text mb-4 border-b border-brand-border/40 pb-2">
            Supplier Profile & Contacts
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <Users size={18} />
              </div>
              <div>
                <p className="text-xs text-brand-muted font-bold uppercase tracking-wider">Contact Person</p>
                <p className="text-sm font-black text-brand-text">Davey Windsor</p>
                <p className="text-xs text-brand-muted">General Manager</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-xs text-brand-muted font-bold uppercase tracking-wider">Phone</p>
                <a href="tel:0738047799" className="text-sm font-bold text-brand-primary hover:underline">
                  (07) 3804 7799
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-xs text-brand-muted font-bold uppercase tracking-wider">Email Address</p>
                <a href="mailto:david@afqld.net.au" className="text-sm font-bold text-brand-primary hover:underline">
                  david@afqld.net.au
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-xs text-brand-muted font-bold uppercase tracking-wider">Depot / Yard Address</p>
                <p className="text-sm text-brand-text font-bold">18 Old Pacific Highway, Yatala QLD 4207</p>
              </div>
            </div>

            <div className="flex items-start gap-4 border-t border-brand-border/40 pt-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <Globe size={18} />
              </div>
              <div>
                <p className="text-xs text-brand-muted font-bold uppercase tracking-wider">Websites</p>
                <div className="space-y-1">
                  <a href="https://amazingfencing.com.au" target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold text-brand-primary hover:underline">
                    amazingfencing.com.au (Main Site)
                  </a>
                  <a href="https://www.fencing-supplies.com.au" target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold text-brand-primary hover:underline">
                    fencing-supplies.com.au (Sister Site)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contractor Network / Info */}
        <div className="bg-brand-card border border-brand-border/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-brand-text mb-4 border-b border-brand-border/40 pb-2">
              Contractor Installer Network
            </h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              Amazing Fencing supports a certified network of fencing installers across NSW, VIC, and QLD.
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-brand-bg p-3 border border-brand-border/40 text-xs">
                <p className="font-bold text-brand-text">Postcodes Serviced</p>
                <p className="text-brand-muted mt-1">Sydney Metro, Melbourne Metro, Brisbane Metro, Gold Coast, Yatala, and surrounding suburbs.</p>
              </div>
              <div className="rounded-lg bg-brand-bg p-3 border border-brand-border/40 text-xs">
                <p className="font-bold text-brand-text">Business Capabilities</p>
                <p className="text-brand-muted mt-1">Supply only, supply and install, custom gates fabrication, large commercial sites, and residential subdivisions.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-brand-border/40">
            <Button
              onClick={() => toast.info("Contractor request details sent to David Windsor")}
              className="w-full justify-center"
              variant="primary"
            >
              Request Contractor Installation Quote
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderPricingTable() {
    return (
      <div className="bg-brand-card border border-brand-border/60 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-black text-brand-text">Material Price List</h3>
            <p className="text-xs text-brand-muted mt-1">
              Active components catalog for Amazing Fencing. Showing trade, retail, and wholesale pricing.
            </p>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted h-4 w-4" />
            <input
              type="text"
              placeholder="Search SKU or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-brand-border bg-brand-bg text-brand-text focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        {loadingPrices ? (
          <div className="space-y-3 py-10">
            <div className="h-8 bg-brand-bg rounded animate-pulse" />
            <div className="h-12 bg-brand-bg rounded animate-pulse" />
            <div className="h-12 bg-brand-bg rounded animate-pulse" />
          </div>
        ) : !pricingData || pricingData.items.length === 0 ? (
          <div className="text-center py-12">
            <Database size={40} className="text-brand-muted mx-auto mb-3" />
            <p className="text-sm font-semibold text-brand-text">No materials found</p>
            <p className="text-xs text-brand-muted mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-brand-border/60 rounded-xl shadow-sm bg-brand-card">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-bg/65 border-b border-brand-border/50 text-[10px] font-extrabold text-brand-muted uppercase tracking-wider">
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4 text-right">Trade (T2)</th>
                  <th className="py-3.5 px-4 text-right">Retail (T1)</th>
                  <th className="py-3.5 px-4 text-right">Wholesale (T3)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40 font-medium text-brand-text">
                {pricingData.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-brand-accent/5 transition-colors border-b border-brand-border/40 last:border-0">
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-primary">{item.sku}</td>
                    <td className="py-3.5 px-4 max-w-xs sm:max-w-md truncate" title={item.name}>{item.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold bg-brand-bg border border-brand-border/50 uppercase text-brand-muted tracking-wide">
                        {item.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 capitalize text-brand-muted">{item.unit}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-brand-text font-mono">
                      ${item.tradePrice.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-brand-muted">
                      ${item.retailPrice.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-brand-muted">
                      ${item.wholesalePrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-brand-border/60">
              <span className="text-xs text-brand-muted">
                Showing <span className="font-bold text-brand-text">{page * pageSize + 1}</span> to{" "}
                <span className="font-bold text-brand-text">
                  {Math.min((page + 1) * pageSize, pricingData.total)}
                </span>{" "}
                of <span className="font-bold text-brand-text">{pricingData.total}</span> materials
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  variant="secondary"
                  size="small"
                  className="inline-flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  Prev
                </Button>
                <Button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * pageSize >= pricingData.total}
                  variant="secondary"
                  size="small"
                  className="inline-flex items-center gap-1"
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
