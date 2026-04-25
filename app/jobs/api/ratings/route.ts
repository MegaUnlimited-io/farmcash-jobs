import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { upsertRating, checkEligibility } from "@/lib/db/ratings";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eligibility = checkEligibility(user);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, overall_rating, ad_aggression, task_difficulty, payment_speed } =
    body as Record<string, unknown>;

  if (typeof job_id !== "string" || !job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  if (
    typeof overall_rating !== "number" ||
    overall_rating < 1 ||
    overall_rating > 5
  ) {
    return NextResponse.json(
      { error: "overall_rating must be 1–5" },
      { status: 400 }
    );
  }

  const toRating = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number" && v >= 1 && v <= 5) return v;
    return null;
  };

  try {
    await upsertRating(user.id, {
      job_id,
      overall_rating,
      ad_aggression: toRating(ad_aggression),
      task_difficulty: toRating(task_difficulty),
      payment_speed: toRating(payment_speed),
    });
    revalidateTag(`ratings:${job_id}`, "hours");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/ratings] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
