-- overall_rating is now computed automatically from the 3 sub-dimensions.
  -- Formula: average of whichever sub-dims the user rated (null dims are excluded).
  -- To add weightings later, update the function body only.

  CREATE OR REPLACE FUNCTION public.compute_overall_rating()
  RETURNS TRIGGER AS $$
  DECLARE
    total NUMERIC := 0;
    count INT := 0;
  BEGIN
    IF NEW.ad_aggression IS NOT NULL THEN
      total := total + NEW.ad_aggression;
      count := count + 1;
    END IF;
    IF NEW.task_difficulty IS NOT NULL THEN
      total := total + NEW.task_difficulty;
      count := count + 1;
    END IF;
    IF NEW.payment_speed IS NOT NULL THEN
      total := total + NEW.payment_speed;
      count := count + 1;
    END IF;

    NEW.overall_rating := CASE WHEN count > 0 THEN ROUND(total / count, 2) ELSE NULL END;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS job_ratings_compute_overall ON public.job_ratings;
  CREATE TRIGGER job_ratings_compute_overall
    BEFORE INSERT OR UPDATE ON public.job_ratings
    FOR EACH ROW EXECUTE FUNCTION public.compute_overall_rating();