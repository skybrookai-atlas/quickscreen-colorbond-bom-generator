-- ============================================================================
-- 066_byron_and_beyond_fencing_supplier.sql
-- ============================================================================

-- ─── Organization Row ───────────────────────────────────────────────────────
INSERT INTO organisations (name, slug, branding)
VALUES (
  'Byron & Beyond Fencing',
  'byron-and-beyond-fencing',
  '{"cssVars":{"--brand-bg":"#f4f6f5","--brand-card":"#ffffff","--brand-border":"#cbd2ce","--brand-primary":"27 67 50","--brand-accent":"197 160 89","--brand-accent-hover":"#b48f47","--brand-muted":"#556b60","--brand-text":"#13231a","--brand-header-bg":"#1b4332","--brand-header-text":"#ffffff","--brand-radius":"0.5rem","--brand-radius-sm":"0.375rem"},"branding":{"title":"Byron & Beyond Fencing","titleItalic":"","subtitle":"Premium Northern Rivers Fencing & Gates","hideThemeToggle":true}}'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    branding = EXCLUDED.branding;

-- ─── Supplier Row ───────────────────────────────────────────────────────────
INSERT INTO suppliers (slug, name, brand_colour, contact_email, trust_tier, status, org_id, metadata)
VALUES (
  'byron-and-beyond-fencing',
  'Byron & Beyond Fencing',
  '#1b4332', -- Elegant coastal/forest dark green
  'bbfencing@hotmail.com',
  'platform',
  'active',
  (SELECT id FROM organisations WHERE slug = 'byron-and-beyond-fencing'),
  jsonb_build_object(
    'website', 'https://byronandbeyondfencing.com.au',
    'address', '1/9 Mogo Pl, Billinudgel, NSW 2483',
    'phone', '(02) 6680 4766',
    'service_regions', jsonb_build_array('Byron Shire', 'Northern Rivers', 'Tweed Shire', 'Ballina Shire'),
    'capabilities', jsonb_build_array('install', 'supply', 'custom_gates', 'pool_fence_compliance'),
    'principal', 'Liam Kelly',
    'founded_approx', '2012'
  )
)
ON CONFLICT (slug) DO UPDATE
SET brand_colour = EXCLUDED.brand_colour,
    contact_email = EXCLUDED.contact_email,
    org_id = EXCLUDED.org_id,
    metadata = EXCLUDED.metadata;

-- ─── System instances ───────────────────────────────────────────────────────
WITH bbf AS (SELECT id FROM suppliers WHERE slug = 'byron-and-beyond-fencing')
INSERT INTO system_instances (
  supplier_id, archetype_id, slug, name, status, readiness_status,
  trust_tier, visibility, description, metadata, org_id
) VALUES
  -- Colorbond steel panels
  ((SELECT id FROM bbf), (SELECT id FROM system_archetypes WHERE slug='panel-fence'),
    'bbf-colorbond', 'Byron & Beyond — Colorbond Steel Fencing',
    'active', 'imported', 'platform', 'public',
    'Premium Colorbond steel panel fencing, ideal for coastal climates. Hard-wearing, low-maintenance privacy screens and boundary fences available in full range of Colorbond finishes.',
    jsonb_build_object(
      'source_page', 'https://byronandbeyondfencing.com.au',
      'styles', jsonb_build_array('standard', 'lattice_top', 'slat_top'),
      'standard_heights_m', jsonb_build_array(1.5, 1.8, 2.1),
      'warranty', '10-year Bluescope warranty'
    ),
    (SELECT id FROM organisations WHERE slug = 'byron-and-beyond-fencing')),

  -- Timber paling (Treated Pine / Hardwood)
  ((SELECT id FROM bbf), (SELECT id FROM system_archetypes WHERE slug='timber-fence'),
    'bbf-timber-paling', 'Byron & Beyond — Timber Paling Fencing',
    'active', 'imported', 'platform', 'public',
    'Traditional timber fencing in Lapped, Lapped-and-Capped, and standard Butted styles. Sourced from high-quality local treated pine or hardwood, perfect for natural screening.',
    jsonb_build_object(
      'source_page', 'https://byronandbeyondfencing.com.au',
      'styles', jsonb_build_array('butted', 'lapped', 'lapped_and_capped'),
      'treatment', 'H3 above-ground, H4 in-ground',
      'standard_heights_mm', jsonb_build_array(1200, 1500, 1800, 2100)
    ),
    (SELECT id FROM organisations WHERE slug = 'byron-and-beyond-fencing')),

  -- Aluminium Slats (QuickScreen / Horizontal Slats)
  ((SELECT id FROM bbf), (SELECT id FROM system_archetypes WHERE slug='slat-fence'),
    'bbf-slat-screen', 'Byron & Beyond — Aluminium Slat Screening',
    'active', 'imported', 'platform', 'public',
    'Elegant aluminium slat screens and gates. Choice of slat size and gap width to control privacy and airflow. Durable powdercoat and timber-grain finishes.',
    jsonb_build_object(
      'source_page', 'https://byronandbeyondfencing.com.au',
      'slat_sizes_mm', jsonb_build_array(65, 90),
      'gaps_mm', jsonb_build_array(5, 9, 20),
      'finishes', jsonb_build_array('powdercoat', 'woodgrain')
    ),
    (SELECT id FROM organisations WHERE slug = 'byron-and-beyond-fencing')),

  -- Pool Fencing (Aluminium tubular compliance)
  ((SELECT id FROM bbf), (SELECT id FROM system_archetypes WHERE slug='aluminium-pool-fence'),
    'bbf-aluminium-pool', 'Byron & Beyond — Aluminium Pool Fencing',
    'active', 'imported', 'platform', 'public',
    'Fully compliant glass and aluminium pool fencing. Sturdy, rust-free tubular panels designed to meet strict AS 1926.1 pool safety requirements while preserving views.',
    jsonb_build_object(
      'source_page', 'https://byronandbeyondfencing.com.au',
      'compliance', 'AS 1926.1',
      'styles', jsonb_build_array('flat_top', 'loop_top'),
      'height_mm', 1200
    ),
    (SELECT id FROM organisations WHERE slug = 'byron-and-beyond-fencing')),

  -- Glass Pool Fencing (Frameless & Semi-Frameless)
  ((SELECT id FROM bbf), (SELECT id FROM system_archetypes WHERE slug='glass-pool-fence'),
    'bbf-glass-pool', 'Byron & Beyond — Glass Pool Fencing',
    'active', 'imported', 'platform', 'public',
    'Premium 12mm fully frameless and semi-frameless glass pool fencing. Compliant with AS 1926.1 safety regulations, offering unobstructed scenic views of the Northern Rivers landscape.',
    jsonb_build_object(
      'source_page', 'https://byronandbeyondfencing.com.au',
      'compliance', 'AS 1926.1',
      'panel_thickness_mm', 12,
      'types', jsonb_build_array('frameless', 'semi_frameless')
    ),
    (SELECT id FROM organisations WHERE slug = 'byron-and-beyond-fencing'))
ON CONFLICT (supplier_id, slug) DO NOTHING;

-- ─── Sanity log ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_supplier UUID; v_instance_count INT;
BEGIN
  SELECT id INTO v_supplier FROM suppliers WHERE slug = 'byron-and-beyond-fencing';
  IF v_supplier IS NULL THEN
    RAISE EXCEPTION 'Byron & Beyond Fencing supplier row not inserted';
  END IF;
  SELECT COUNT(*) INTO v_instance_count FROM system_instances WHERE supplier_id = v_supplier;
  RAISE NOTICE 'Byron & Beyond Fencing seeded: supplier %, % system_instances', v_supplier, v_instance_count;
END $$;
