-- =====================================================
-- MIGRATION019_jobs_tables.sql
-- Purpose:
--   Create the Jobs Wiki core tables: jobs, job_ratings, job_comments.
--   Adds materialized view job_ratings_summary with auto-refresh trigger.
--   All tables live in public schema, FKs reference public.users.
--   Media fields (icon_url, screenshots) are present but may initially
--   hold Play Store URLs — R2 migration handled in a future pipeline phase.
-- =====================================================


-- =====================================================
-- TABLE: jobs
-- Core offer/job metadata, synced from partner APIs.
-- PK is our own UUID. Partner reference stored separately.
-- Unique constraint on (partner_id, partner_offer_id) prevents
-- duplicates across multi-partner future support.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Partner reference
  partner_id                VARCHAR NOT NULL,              -- e.g. 'ayetstudios', 'revu', 'bitlabs'
  partner_offer_id          VARCHAR NOT NULL,              -- Partner's own ID, e.g. '280911'

  -- Content
  name                      VARCHAR NOT NULL,
  slug                      VARCHAR NOT NULL UNIQUE,       -- URL key, e.g. 'coffee-pack-sorting-puzzle'
  description               TEXT,
  category                  VARCHAR,                       -- e.g. 'puzzle', 'casino', 'strategy'
  ai_generated_content      TEXT,                         -- LLM-generated description, tips, overview
  
  -- Media (initially Play Store URLs; migrated to R2 CDN in enrichment phase)
  icon_url                  VARCHAR,
  screenshots               JSONB DEFAULT '[]'::jsonb,    -- Array of image URLs

  -- Offer data
  payout_amount             DECIMAL(10,2),                -- Current payout from partner
  app_package_id            VARCHAR,                      -- e.g. 'com.king.coffee' — Play Store + deep link prep

  -- Lifecycle / sync
  status                    VARCHAR NOT NULL DEFAULT 'active',
                            -- active | partner_removed | blacklisted | seasonal | under_review
  last_seen_in_partner_api  TIMESTAMP WITH TIME ZONE,
  consecutive_missing_syncs INT NOT NULL DEFAULT 0,       -- Incremented each sync cycle job is absent
  enriched_at               TIMESTAMP WITH TIME ZONE,     -- NULL = not yet AI-enriched; used by enrichment queue

  created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_partner_offer UNIQUE (partner_id, partner_offer_id)
);

-- Indexes
CREATE INDEX idx_jobs_status         ON public.jobs (status);
CREATE INDEX idx_jobs_partner        ON public.jobs (partner_id);
CREATE INDEX idx_jobs_partner_offer  ON public.jobs (partner_id, partner_offer_id);
CREATE INDEX idx_jobs_slug           ON public.jobs (slug);
CREATE INDEX idx_jobs_enriched       ON public.jobs (enriched_at) WHERE enriched_at IS NULL;
CREATE INDEX idx_jobs_package        ON public.jobs (app_package_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs are publicly readable"
  ON public.jobs FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage jobs"
  ON public.jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Grants
GRANT SELECT ON public.jobs TO authenticated;
GRANT SELECT ON public.jobs TO anon;
GRANT ALL    ON public.jobs TO service_role;


-- =====================================================
-- TABLE: job_ratings
-- Per-user multi-dimensional ratings.
-- One rating per user per job (enforced by unique constraint).
-- is_bot = true for AI-seeded sentinel ratings.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.job_ratings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  user_id             UUID REFERENCES public.users (id) ON DELETE CASCADE,

  -- Rating dimensions (1–5)
  overall_rating      INT CHECK (overall_rating BETWEEN 1 AND 5),
  ad_aggression       INT CHECK (ad_aggression BETWEEN 1 AND 5),  -- 1=very aggressive, 5=no/few ads
  task_difficulty     INT CHECK (task_difficulty BETWEEN 1 AND 5), -- 1=very hard, 5=very easy
  payment_speed       INT CHECK (payment_speed BETWEEN 1 AND 5),  -- 1=very slow, 5=very fast

  -- Bot / AI-seeded flag
  is_bot              BOOLEAN NOT NULL DEFAULT false,
  bot_name            VARCHAR,                                     -- e.g. 'Sentiment Analyzer'

  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One human rating per user per job; bots can have multiple (no user_id)
  CONSTRAINT uq_user_job_rating UNIQUE NULLS NOT DISTINCT (job_id, user_id)
);

-- Indexes
CREATE INDEX idx_job_ratings_job     ON public.job_ratings (job_id);
CREATE INDEX idx_job_ratings_user    ON public.job_ratings (user_id);
CREATE INDEX idx_job_ratings_bot     ON public.job_ratings (is_bot);

-- Auto-update updated_at
CREATE TRIGGER trg_job_ratings_updated_at
  BEFORE UPDATE ON public.job_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.job_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are publicly readable"
  ON public.job_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own ratings"
  ON public.job_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings"
  ON public.job_ratings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage ratings"
  ON public.job_ratings FOR ALL
  USING (auth.role() = 'service_role');

-- Grants
GRANT SELECT ON public.job_ratings TO authenticated;
GRANT SELECT ON public.job_ratings TO anon;
GRANT INSERT, UPDATE ON public.job_ratings TO authenticated;
GRANT ALL    ON public.job_ratings TO service_role;


-- =====================================================
-- TABLE: job_comments
-- Flat comments and strategy guides per job.
-- Moderation queue: pending → approved | rejected.
-- is_bot = true for AI-seeded sentinel comments.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.job_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users (id) ON DELETE CASCADE,

  -- Content
  content     TEXT NOT NULL,
  is_guide    BOOLEAN NOT NULL DEFAULT false,   -- User flagged as strategy guide
  is_pinned   BOOLEAN NOT NULL DEFAULT false,   -- Admin pinned (best guides surface first)

  -- Bot / AI-seeded flag
  is_bot      BOOLEAN NOT NULL DEFAULT false,
  bot_name    VARCHAR,                          -- e.g. 'Community Summary'

  -- Moderation
  status      VARCHAR NOT NULL DEFAULT 'pending',
              -- pending | approved | rejected

  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_comments_job     ON public.job_comments (job_id);
CREATE INDEX idx_job_comments_status  ON public.job_comments (status);
CREATE INDEX idx_job_comments_pinned  ON public.job_comments (is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_job_comments_user    ON public.job_comments (user_id);

-- Auto-update updated_at
CREATE TRIGGER trg_job_comments_updated_at
  BEFORE UPDATE ON public.job_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.job_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved comments are publicly readable"
  ON public.job_comments FOR SELECT
  USING (status = 'approved' OR auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert comments"
  ON public.job_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending comments"
  ON public.job_comments FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Service role can manage comments"
  ON public.job_comments FOR ALL
  USING (auth.role() = 'service_role');

-- Grants
GRANT SELECT ON public.job_comments TO authenticated;
GRANT SELECT ON public.job_comments TO anon;
GRANT INSERT, UPDATE ON public.job_comments TO authenticated;
GRANT ALL    ON public.job_comments TO service_role;


-- =====================================================
-- MATERIALIZED VIEW: job_ratings_summary
-- Pre-aggregated rating scores per job.
-- Refreshed automatically after each INSERT/UPDATE/DELETE
-- on job_ratings via trigger.
--
-- If materialized views are unavailable on your plan,
-- replace CREATE MATERIALIZED VIEW with CREATE VIEW
-- and remove the refresh function + trigger below.
-- =====================================================

CREATE MATERIALIZED VIEW public.job_ratings_summary AS
SELECT
  job_id,
  COUNT(*)                                          AS total_ratings,
  COUNT(*) FILTER (WHERE is_bot = false)            AS human_ratings,
  ROUND(AVG(overall_rating), 2)                     AS avg_overall,
  ROUND(AVG(ad_aggression), 2)                      AS avg_ad_aggression,
  ROUND(AVG(task_difficulty), 2)                    AS avg_task_difficulty,
  ROUND(AVG(payment_speed), 2)                      AS avg_payment_speed
FROM public.job_ratings
GROUP BY job_id
WITH DATA;

CREATE UNIQUE INDEX idx_job_ratings_summary_job ON public.job_ratings_summary (job_id);

GRANT SELECT ON public.job_ratings_summary TO authenticated;
GRANT SELECT ON public.job_ratings_summary TO anon;
GRANT ALL    ON public.job_ratings_summary TO service_role;

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_job_ratings_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.job_ratings_summary;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_job_ratings_summary() TO service_role;

-- Trigger: refresh after any rating change
CREATE TRIGGER trg_refresh_ratings_summary
  AFTER INSERT OR UPDATE OR DELETE ON public.job_ratings
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_job_ratings_summary();
