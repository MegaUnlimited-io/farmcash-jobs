import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, updateManualOverrides } from "@/lib/db/admin";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await isAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId, overrides } = body as Record<string, unknown>;

  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return NextResponse.json({ error: "overrides object required" }, { status: 400 });
  }

  const result = await updateManualOverrides(
    jobId,
    overrides as { name?: string; description?: string; icon_url?: string }
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  revalidatePath(`/jobs/${result.slug}`);

  return NextResponse.json({ ok: true, slug: result.slug });
}
