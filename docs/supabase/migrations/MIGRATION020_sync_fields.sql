-- MIGRATION020_sync_fields.sql
-- Adds sync-specific fields to the jobs table.
-- Creates the admins table for farmcash-jobs admin access.
--
-- Run manually in Supabase SQL editor. Never auto-run.
-- Prerequisite: MIGRATION019_jobs_tables_1.sql must already be applied.

-- ─── Jobs: add sync fields ────────────────────────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS seeds_amount         integer,
  ADD COLUMN IF NOT EXISTS conversion_type      text,
  ADD COLUMN IF NOT EXISTS cpe_tasks            jsonb,
  ADD COLUMN IF NOT EXISTS tracking_link_template text;

COMMENT ON COLUMN public.jobs.seeds_amount
  IS 'Seeds earned by completing this offer (AyeT currency_amount). User-facing.';

COMMENT ON COLUMN public.jobs.conversion_type
  IS 'Offer type from partner API: cpi, cpa, cpe, cpl.';

COMMENT ON COLUMN public.jobs.cpe_tasks
  IS 'CPE multi-step task array from partner API. Stored as-is for display.';

COMMENT ON COLUMN public.jobs.tracking_link_template
  IS 'Partner tracking URL template. Stored for future web attribution (Phase 3).';

-- ─── Admins table ─────────────────────────────────────────────────────────────
-- Separate from public.users — that table is owned by the mobile app (read-only).
-- FK references public.users(id) per the shared DB FK pattern.

CREATE TABLE IF NOT EXISTS public.admins (
  user_id    uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admins
  IS 'Users with admin access to farmcash-jobs. Owned by this repo; public.users is read-only.';

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Service role manages the admins list; admins can only read their own row
CREATE POLICY "admins_service_role_all" ON public.admins
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admins_self_read" ON public.admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.admins TO authenticated;
GRANT ALL   ON public.admins TO service_role;
