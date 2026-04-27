-- MIGRATION023: Human-first ratings summary view.
--
-- Logic:
--   - If a job has >= 1 human rating: averages exclude ALL bot rows entirely.
--   - If a job has 0 human ratings: averages fall back to bot rows only.
--
-- This means the bot's ad_aggression score seeds the display until one real
-- farmer rates the job, at which point the community takes over completely.
-- Bot ratings remain in job_ratings for audit/history — they're just excluded
-- from the displayed averages once human data exists.
--
-- Replaces the existing materialized view with a regular view (always live,
-- no manual REFRESH needed). PostgreSQL does not support
-- CREATE OR REPLACE MATERIALIZED VIEW, so we drop and recreate.

DROP MATERIALIZED VIEW IF EXISTS public.job_ratings_summary;

CREATE VIEW public.job_ratings_summary AS
SELECT
  job_id,

  COUNT(*)                                AS total_ratings,
  COUNT(*) FILTER (WHERE NOT is_bot)      AS human_ratings,

  -- Overall: human avg when >=1 human rating exists, else bot avg
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT is_bot) >= 1
      THEN ROUND(AVG(overall_rating)  FILTER (WHERE NOT is_bot)::NUMERIC, 2)
    ELSE   ROUND(AVG(overall_rating)  FILTER (WHERE     is_bot)::NUMERIC, 2)
  END AS avg_overall,

  -- ad_aggression: same human-first logic (bot sets this from Play Store data)
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT is_bot) >= 1
      THEN ROUND(AVG(ad_aggression)   FILTER (WHERE NOT is_bot)::NUMERIC, 2)
    ELSE   ROUND(AVG(ad_aggression)   FILTER (WHERE     is_bot)::NUMERIC, 2)
  END AS avg_ad_aggression,

  -- task_difficulty: bot never sets this, so effectively always human-only
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT is_bot) >= 1
      THEN ROUND(AVG(task_difficulty) FILTER (WHERE NOT is_bot)::NUMERIC, 2)
    ELSE   ROUND(AVG(task_difficulty) FILTER (WHERE     is_bot)::NUMERIC, 2)
  END AS avg_task_difficulty,

  -- payment_speed: bot never sets this, so effectively always human-only
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT is_bot) >= 1
      THEN ROUND(AVG(payment_speed)   FILTER (WHERE NOT is_bot)::NUMERIC, 2)
    ELSE   ROUND(AVG(payment_speed)   FILTER (WHERE     is_bot)::NUMERIC, 2)
  END AS avg_payment_speed

FROM public.job_ratings
GROUP BY job_id;
