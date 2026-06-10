-- Migration 065: Allow updates to system_instances by org_id
-- This allows supplier staff to toggle the status (on/off) of their own organisation's calculators.

CREATE POLICY "system_instances_update_org" ON public.system_instances
  FOR UPDATE
  TO authenticated
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());
