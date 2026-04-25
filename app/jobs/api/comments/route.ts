import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertComment } from "@/lib/db/comments";
import { checkEligibility } from "@/lib/db/ratings";

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

  const { job_id, content } = body as Record<string, unknown>;

  if (typeof job_id !== "string" || !job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (content.trim().length < 10) {
    return NextResponse.json(
      { error: "Comment must be at least 10 characters." },
      { status: 400 }
    );
  }
  if (content.trim().length > 1000) {
    return NextResponse.json(
      { error: "Comment must be under 1000 characters." },
      { status: 400 }
    );
  }

  try {
    await insertComment(user.id, job_id, content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/comments] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
