import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

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
  overall_rating: number;
  ad_aggression: number | null;
  task_difficulty: number | null;
  payment_speed: number | null;
}

// Upserts a rating — one rating per user per job (unique constraint: job_id, user_id).
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
    overall_rating: payload.overall_rating,
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
