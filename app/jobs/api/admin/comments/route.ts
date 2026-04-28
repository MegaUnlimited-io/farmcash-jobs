import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, moderateComment, toggleCommentFlag } from "@/lib/db/admin";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminStatus = await isAdmin(user.id);
  if (!adminStatus) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status, field, value } = body as Record<string, unknown>;

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Pin / guide toggle
  if (field !== undefined) {
    if (field !== "is_pinned" && field !== "is_guide") {
      return NextResponse.json({ error: "field must be is_pinned or is_guide" }, { status: 400 });
    }
    if (typeof value !== "boolean") {
      return NextResponse.json({ error: "value must be boolean" }, { status: 400 });
    }
    try {
      await toggleCommentFlag(id, field, value);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Failed to update flag" }, { status: 500 });
    }
  }

  // Status change (approve / reject)
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be approved or rejected" },
      { status: 400 }
    );
  }

  try {
    await moderateComment(id, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/comments] PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
