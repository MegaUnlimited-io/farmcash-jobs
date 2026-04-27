-- MIGRATION022: Allow bot-generated ratings and comments without a real user_id.
--
-- Bots (enrichment pipeline) don't exist in public.users, so user_id must be
-- nullable when is_bot = true. Human ratings still require user_id (enforced
-- by application logic and the existing unique constraint on (job_id, user_id)).
--
-- Also adds partial unique indexes so each bot can only rate/comment on a job once.
-- These support upsert/dedup logic in the enrichment pipeline.

-- ─── 1. Allow NULL user_id for bot entries ────────────────────────────────────

ALTER TABLE public.job_ratings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.job_comments ALTER COLUMN user_id DROP NOT NULL;

-- ─── 2. Unique index: one bot rating per job per bot_name ─────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS job_ratings_bot_unique
  ON public.job_ratings (job_id, bot_name)
  WHERE is_bot = true;

-- ─── 3. Unique index: one bot comment per job per bot_name ────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS job_comments_bot_unique
  ON public.job_comments (job_id, bot_name)
  WHERE is_bot = true;
