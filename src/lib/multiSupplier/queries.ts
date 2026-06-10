import { supabase } from '../supabase';
import type { Supplier, SystemArchetype, SystemInstance } from '../../types/multiSupplier';

// ============================================================================
// Development Mock Fallbacks (used when Supabase is offline or unmigrated)
// ============================================================================

const MOCK_SUPPLIERS: Record<string, Supplier> = {
  "glass-outlet": {
    id: "glass-outlet-id",
    slug: "glass-outlet",
    name: "The Glass Outlet",
    brandColour: "#5a8a32",
    trustTier: "platform",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  "amazing-fencing": {
    id: "amazing-fencing-id",
    slug: "amazing-fencing",
    name: "Amazing Fencing",
    brandColour: "#0d3b66",
    contactEmail: "david@afqld.net.au",
    trustTier: "platform",
    status: "active",
    installs_enabled: true,
    metadata: {
      website: "https://amazingfencing.com.au",
      phone: "(07) 3804 7799",
      address: "18 Old Pacific Highway, Yatala QLD 4207",
      description: "Amazing Fencing supports a certified network of fencing installers across NSW, VIC, and QLD."
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  "discount-fencing": {
    id: "discount-fencing-id",
    slug: "discount-fencing",
    name: "Discount Fencing Supplies",
    brandColour: "#1f3b5c",
    trustTier: "platform",
    status: "active",
    metadata: {
      website: "https://www.dfsau.com.au",
      address: "11 William Banks Drive, Burleigh Heads, QLD 4220",
      description: "Custom fabrication and powder coating for residential and pool fencing projects."
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  "byron-and-beyond-fencing": {
    id: "byron-and-beyond-fencing-id",
    slug: "byron-and-beyond-fencing",
    name: "Byron & Beyond Fencing",
    brandColour: "#1b4332",
    contactEmail: "bbfencing@hotmail.com",
    trustTier: "platform",
    status: "active",
    installs_enabled: true,
    metadata: {
      website: "https://byronandbeyondfencing.com.au",
      address: "1/9 Mogo Pl, Billinudgel, NSW 2483",
      phone: "(02) 6680 4766",
      service_regions: ["Byron Shire", "Northern Rivers", "Tweed Shire", "Ballina Shire"],
      capabilities: ["install", "supply", "custom_gates", "pool_fence_compliance"],
      principal: "Liam Kelly",
      founded_approx: "2012",
      description: "Byron & Beyond Fencing provides premium fencing and custom automated gates in the Northern Rivers."
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

const MOCK_INSTANCES: Record<string, SystemInstance[]> = {
  "glass-outlet-id": [
    {
      id: "qshs",
      supplierId: "glass-outlet-id",
      archetypeId: "slat-fence",
      slug: "qshs",
      name: "QuickScreen Horizontal Slats",
      description: "Configure and estimate slat fencing systems.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  "amazing-fencing-id": [
    {
      id: "amazing-colorbond",
      supplierId: "amazing-fencing-id",
      archetypeId: "panel-fence",
      slug: "amazing-colorbond",
      name: "Amazing Fencing — Colorbond Steel",
      description: "Premium Colorbond steel panel fencing.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "amazing-timber-paling",
      supplierId: "amazing-fencing-id",
      archetypeId: "timber-fence",
      slug: "amazing-timber-paling",
      name: "Amazing Fencing — Treated Pine Paling",
      description: "Traditional timber paling fencing in colonial and capped styles.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "amazing-retaining-wall",
      supplierId: "amazing-fencing-id",
      archetypeId: "timber-fence",
      slug: "amazing-retaining-wall",
      name: "Amazing Fencing — Timber Retaining Wall",
      description: "CCA treated pine sleeper retaining walls.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  "discount-fencing-id": [
    {
      id: "dfsau-cca-pine-paling",
      supplierId: "discount-fencing-id",
      archetypeId: "timber-fence",
      slug: "dfsau-cca-pine-paling",
      name: "Discount Fencing — CCA Pine Paling Fence",
      description: "CCA Pine paling fencing with rails and pine posts.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "dfsau-aluminium-pool",
      supplierId: "discount-fencing-id",
      archetypeId: "aluminium-pool-fence",
      slug: "dfsau-aluminium-pool",
      name: "Discount Fencing — Aluminium Pool Fence",
      description: "Aluminium pool fencing compliant with safety regulations.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  "byron-and-beyond-fencing-id": [
    {
      id: "bbf-colorbond",
      supplierId: "byron-and-beyond-fencing-id",
      archetypeId: "panel-fence",
      slug: "bbf-colorbond",
      name: "Byron & Beyond — Colorbond Steel Fencing",
      description: "Premium Colorbond steel privacy panel fencing.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "bbf-timber-paling",
      supplierId: "byron-and-beyond-fencing-id",
      archetypeId: "timber-fence",
      slug: "bbf-timber-paling",
      name: "Byron & Beyond — Timber Paling Fencing",
      description: "Traditional timber paling fencing in Lapped and Capped styles.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "bbf-slat-screen",
      supplierId: "byron-and-beyond-fencing-id",
      archetypeId: "slat-fence",
      slug: "bbf-slat-screen",
      name: "Byron & Beyond — Aluminium Slat Screening",
      description: "Modern slat privacy screening and pedestrian gates.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "bbf-aluminium-pool",
      supplierId: "byron-and-beyond-fencing-id",
      archetypeId: "aluminium-pool-fence",
      slug: "bbf-aluminium-pool",
      name: "Byron & Beyond — Aluminium Pool Fencing",
      description: "Fully compliant aluminium tubular pool fencing.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "bbf-glass-pool",
      supplierId: "byron-and-beyond-fencing-id",
      archetypeId: "glass-pool-fence",
      slug: "bbf-glass-pool",
      name: "Byron & Beyond — Glass Pool Fencing",
      description: "Premium 12mm frameless and semi-frameless glass pool systems.",
      status: "active",
      readinessStatus: "approved",
      trustTier: "platform",
      visibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

// ============================================================================
// Queries
// ============================================================================

export async function listSuppliers(): Promise<Supplier[]> {
  try {
    const { data, error } = await supabase
      .from('suppliers').select('*').eq('status', 'active').order('name');
    if (!error && data && data.length > 0) {
      return data.map(rowToSupplier);
    }
  } catch (e) {
    console.warn("Supabase query failed, falling back to mocks", e);
  }
  return Object.values(MOCK_SUPPLIERS).filter(s => s.status === 'active');
}

export async function getSupplierBySlug(slug: string): Promise<Supplier | null> {
  try {
    const { data, error } = await supabase
      .from('suppliers').select('*').eq('slug', slug).maybeSingle();
    if (!error && data) {
      return rowToSupplier(data);
    }
  } catch (e) {
    console.warn("Supabase query failed, falling back to mocks", e);
  }
  return MOCK_SUPPLIERS[slug] ?? null;
}

export async function listAllSuppliers(): Promise<Supplier[]> {
  try {
    const { data, error } = await supabase
      .from('suppliers').select('*').order('name');
    if (!error && data && data.length > 0) {
      return data.map(rowToSupplier);
    }
  } catch (e) {
    console.warn("Supabase query failed, falling back to mocks", e);
  }
  return Object.values(MOCK_SUPPLIERS);
}

export async function getSystemInstanceById(id: string): Promise<SystemInstance | null> {
  try {
    const { data, error } = await supabase
      .from('system_instances').select('*').eq('id', id).maybeSingle();
    if (!error && data) {
      return rowToSystemInstance(data);
    }
  } catch (e) {
    console.warn("Supabase query failed, falling back to mocks", e);
  }
  
  // Search mocks
  for (const list of Object.values(MOCK_INSTANCES)) {
    const match = list.find(inst => inst.id === id);
    if (match) return match;
  }
  return null;
}

export async function listArchetypes(): Promise<SystemArchetype[]> {
  const { data, error } = await supabase
    .from('system_archetypes').select('*').eq('status', 'active').order('family').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToArchetype);
}

export async function listSystemInstances(opts: {
  supplierId?: string;
  archetypeId?: string;
  status?: 'active' | 'hidden' | 'draft' | 'discontinued';
} = {}): Promise<SystemInstance[]> {
  try {
    let q = supabase.from('system_instances').select('*');
    if (opts.supplierId) q = q.eq('supplier_id', opts.supplierId);
    if (opts.archetypeId) q = q.eq('archetype_id', opts.archetypeId);
    if (opts.status) q = q.eq('status', opts.status);
    q = q.order('name');
    const { data, error } = await q;
    if (!error && data && data.length > 0) {
      return data.map(rowToSystemInstance);
    }
  } catch (e) {
    console.warn("Supabase query failed, falling back to mocks", e);
  }

  // Fallback to mocks
  if (opts.supplierId) {
    return MOCK_INSTANCES[opts.supplierId] ?? [];
  }
  
  // Return all mocked instances if no supplier filter specified
  return Object.values(MOCK_INSTANCES).flat();
}

function rowToSupplier(row: any): Supplier {
  return {
    id: row.id, slug: row.slug, name: row.name,
    logoUrl: row.logo_url ?? undefined,
    brandColour: row.brand_colour ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    trustTier: row.trust_tier,
    authoredBy: row.authored_by ?? undefined,
    orgId: row.org_id ?? undefined,
    status: row.status, metadata: row.metadata ?? undefined,
    customBrandingLogo: row.custom_branding_logo ?? undefined,
    customBrandingBanner: row.custom_branding_banner ?? undefined,
    customBrandingStyles: row.custom_branding_styles ?? undefined,
    installs_enabled: row.installs_enabled ?? false,
    postcodes_serviced: row.postcodes_serviced ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function rowToArchetype(row: any): SystemArchetype {
  return {
    id: row.id, slug: row.slug, name: row.name, family: row.family,
    geometryModule: row.geometry_module,
    variableSchema: row.variable_schema ?? {},
    ruleTemplateIds: row.rule_template_ids ?? [],
    description: row.description ?? undefined,
    status: row.status, metadata: row.metadata ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function rowToSystemInstance(row: any): SystemInstance {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    archetypeId: row.archetype_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    readinessStatus: row.readiness_status,
    trustTier: row.trust_tier,
    visibility: row.visibility,
    authoredBy: row.authored_by ?? undefined,
    orgId: row.org_id ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    readinessNotes: row.readiness_notes ?? undefined,
    metadata: row.metadata ?? undefined,
    calculatorClonedFrom: row.calculator_cloned_from ?? undefined,
    aiVettingStatus: row.ai_vetting_status ?? undefined,
    aiVettingNotes: row.ai_vetting_notes ?? undefined,
    isPublicLibrary: row.is_public_library ?? false,
    isNewProduct: row.is_new_product ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}