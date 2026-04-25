import { createClient, createAnonClient } from "@/lib/supabase/server";
import type { Database, JobComment } from "@/lib/types";

export async function insertComment(
  userId: string,
  jobId: string,
  content: string
): Promise<void> {
  const supabase = await createClient();

  // `satisfies` validates shape; `as any` works around a @supabase/supabase-js ≥2.104
  // overload resolution bug where Insert resolves to `never` with complex Database generics.
  const values = {
    job_id: jobId,
    user_id: userId,
    content: content.trim(),
    is_guide: false,
    is_pinned: false,
    is_bot: false,
    bot_name: null,
    status: "pending" as const,
  } satisfies Database["public"]["Tables"]["job_comments"]["Insert"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("job_comments").insert(values as any);

  if (error) {
    console.error("[db/comments] insertComment error:", error.message);
    throw new Error("Failed to save comment");
  }
}

// Fetches approved comments only — pinned first, then newest.
// Not cached: freshness matters for the admin approval workflow.
export async function getApprovedComments(jobId: string): Promise<JobComment[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("job_comments")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "approved")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[db/comments] getApprovedComments error:", error.message);
    return [];
  }
  return data ?? [];
}
