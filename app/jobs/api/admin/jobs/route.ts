import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, updateJobStatus } from "@/lib/db/admin";
import type { JobStatus } from "@/lib/types";

const VALID_STATUSES: JobStatus[] = [
  "active",
  "partner_removed",
  "blacklisted",
  "seasonal",
  "under_review",
];

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

  const { jobId, status } = body as Record<string, unknown>;

  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status as JobStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = await updateJobStatus(jobId, status as JobStatus);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  // Bust the job page and listing immediately — no secret needed from server context.
  revalidatePath(`/jobs/${result.slug}`);
  revalidatePath("/jobs");

  return NextResponse.json({ ok: true, slug: result.slug });
}
