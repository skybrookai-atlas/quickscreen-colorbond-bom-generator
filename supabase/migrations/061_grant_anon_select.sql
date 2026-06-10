-- ============================================================================
-- 061_grant_anon_select.sql
-- ============================================================================

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_components TO anon;
