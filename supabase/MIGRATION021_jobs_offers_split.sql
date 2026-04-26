-- MIGRATION021: Split jobs into jobs (wiki entity) + job_offers (partner data)
--
-- Run the blow-away SQL FIRST if you have existing data to clear:
--   TRUNCATE public.job_ratings, public.job_comments, public.jobs RESTART IDENTITY CASCADE;
-- Then run this file.
--
-- New model:
--   jobs        — one row per app (deduped by app_package_id). Owns the wiki page + community data.
--   job_offers  — one row per partner offer. Many per job. Drives payout_min/max on jobs.
--
-- Wiki eligibility rule (Phase 1): offer must have app_package_id (bundle ID).
--   Web offers (no bundle ID) land in job_offers only, with promote_to_wiki = false.
--   Future Phase 2: add landing_url / name dedup for web offers.
--
-- Manual override: any field in jobs.manual_overrides (JSONB) is skipped by the sync.
--   Example: {"name": "My Name", "icon_url": "https://..."} — sync won't touch those fields.

-- ─── 1. jobs: remove offer-specific columns ───────────────────────────────────

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_partner_id_partner_offer_id_key;

ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS partner_id,
  DROP COLUMN IF EXISTS partner_offer_id,
  DROP COLUMN IF EXISTS payout_amount,
  DROP COLUMN IF EXISTS seeds_amount,
  DROP COLUMN IF EXISTS tracking_link_template,
  DROP COLUMN IF EXISTS last_seen_in_partner_api,
  DROP COLUMN IF EXISTS consecutive_missing_syncs;

-- ─── 2. jobs: add new columns ─────────────────────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payout_min      INTEGER,
  ADD COLUMN IF NOT EXISTS payout_max      INTEGER,
  ADD COLUMN IF NOT EXISTS manual_overrides JSONB NOT NULL DEFAULT '{}';

-- conversion_type and cpe_tasks stay on jobs (denormalized from best active offer)

-- ─── 3. jobs: make app_package_id unique (the wiki dedup key) ─────────────────
-- Nullable UNIQUE allows multiple NULLs (future web offers have no bundle ID).

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_app_package_id_key;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_app_package_id_key UNIQUE (app_package_id);

-- ─── 4. Create job_offers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_offers (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                      UUID        REFERENCES public.jobs(id) ON DELETE SET NULL,
  partner_id                  TEXT        NOT NULL,
  partner_offer_id            TEXT        NOT NULL,
  app_package_id              TEXT,
  name                        TEXT        NOT NULL,
  payout_amount               INTEGER,          -- Seeds total for this offer
  conversion_type             TEXT,
  cpe_tasks                   JSONB,
  tracking_link_template      TEXT,
  landing_page                TEXT,             -- Play Store / web URL from partner
  promote_to_wiki             BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active                   BOOLEAN     NOT NULL DEFAULT TRUE,
  consecutive_missing_syncs   INTEGER     NOT NULL DEFAULT 0,
  last_seen_in_partner_api    TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_offers_partner_offer_key UNIQUE (partner_id, partner_offer_id)
);

ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read: job_offers" ON public.job_offers;
CREATE POLICY "Public read: job_offers"
  ON public.job_offers FOR SELECT USING (true);

-- ─── 5. Create jobs_featured ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.jobs_featured (
  job_id          UUID        PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  display_order   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jobs_featured ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read: jobs_featured" ON public.jobs_featured;
CREATE POLICY "Public read: jobs_featured"
  ON public.jobs_featured FOR SELECT USING (true);

-- ─── 6. updated_at trigger for job_offers ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_offers_updated_at ON public.job_offers;
CREATE TRIGGER job_offers_updated_at
  BEFORE UPDATE ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
