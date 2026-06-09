-- 063_create_buildforge_usage.sql
-- Create table for tracking Build Forge chat session usage and limits.

CREATE TABLE IF NOT EXISTS public.buildforge_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  est_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  outcome TEXT CHECK (outcome IN ('completed', 'abandoned', 'limit_hit', 'active')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.buildforge_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage details
CREATE POLICY "Users can view own usage" ON public.buildforge_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Org admins can view all usage in their organization
CREATE POLICY "Org admins can view org usage" ON public.buildforge_usage
  FOR SELECT USING (org_id = public.user_org_id());

-- Grant access to authenticated users
GRANT ALL ON public.buildforge_usage TO authenticated;
GRANT ALL ON public.buildforge_usage TO service_role;
