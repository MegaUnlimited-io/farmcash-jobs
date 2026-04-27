import { createClient } from "@/lib/supabase/server";
import type { Database, JobRating } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

// Returns the current user's existing rating for a job, or null if they haven't rated yet.
export async function getUserRating(jobId: string, userId: string): Promise<JobRating | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_ratings")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("is_bot", false)
    .maybeSingle();
  return (data as JobRating | null) ?? null;
}

// Phase 1 eligibility: email-verified users only.
// Phase 2 will add job_completions check (see CLAUDE.md).
export function checkEligibility(user: User): {
  eligible: boolean;
  reason?: string;
} {
  if (!user.email_confirmed_at) {
    return { eligible: false, reason: "Please verify your email before rating." };
  }
  return { eligible: true };
}

export interface RatingPayload {
  job_id: string;
  // overall_rating is omitted — computed by DB trigger from the 3 sub-dimensions
  ad_aggression: number | null;
  task_difficulty: number | null;
  payment_speed: number | null;
}

// Upserts a rating — one rating per user per job (unique constraint: job_id, user_id).
// overall_rating is set automatically by the job_ratings_compute_overall trigger.
export async function upsertRating(
  userId: string,
  payload: RatingPayload
): Promise<void> {
  const supabase = await createClient();

  // `satisfies` validates shape; `as any` works around a @supabase/supabase-js ≥2.104
  // overload resolution bug where Insert resolves to `never` with complex Database generics.
  const values = {
    job_id: payload.job_id,
    user_id: userId,
    // overall_rating intentionally omitted — trigger computes it from the 3 sub-dims
    ad_aggression: payload.ad_aggression,
    task_difficulty: payload.task_difficulty,
    payment_speed: payload.payment_speed,
    is_bot: false,
    bot_name: null,
  } satisfies Database["public"]["Tables"]["job_ratings"]["Insert"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("job_ratings").upsert(values as any, {
    onConflict: "job_id,user_id",
  });

  if (error) {
    console.error("[db/ratings] upsertRating error:", error.message);
    throw new Error("Failed to save rating");
  }
}
