-- MIGRATION020: Unique constraint on job_ratings (job_id, user_id)
-- Required for upsert with onConflict: "job_id,user_id" in the ratings API.
-- One rating per user per job — re-submitting updates the existing record.

ALTER TABLE public.job_ratings
  ADD CONSTRAINT job_ratings_job_id_user_id_key UNIQUE (job_id, user_id);
