import { createServiceClient } from "@/lib/supabase/service";
import type { CommentStatus, JobComment, Job, PendingComment } from "@/lib/types";

// All functions here use the service role client (bypasses RLS).
// Cast data from .select() to the expected type — @supabase/supabase-js ≥2.104
// resolves Row to `never` when the Database generic doesn't fully resolve.

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function getPendingComments(): Promise<PendingComment[]> {
  const supabase = createServiceClient();

  const { data: raw, error } = await supabase
    .from("job_comments")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[db/admin] getPendingComments error:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase ≥2.104 Row resolves to never
  const comments = (raw ?? []) as JobComment[];
  if (comments.length === 0) return [];

  const jobIds = [...new Set(comments.map((c) => c.job_id))];
  const { data: rawJobs } = await supabase
    .from("jobs")
    .select("id, name, slug")
    .in("id", jobIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same as above
  type JobSummary = Pick<Job, "id" | "name" | "slug">;
  const jobMap = new Map(
    ((rawJobs ?? []) as JobSummary[]).map((j) => [j.id, { name: j.name, slug: j.slug }])
  );

  return comments.map((c) => ({
    ...c,
    job_name: jobMap.get(c.job_id)?.name ?? "Unknown",
    job_slug: jobMap.get(c.job_id)?.slug ?? "",
  }));
}

export async function moderateComment(
  commentId: string,
  status: Extract<CommentStatus, "approved" | "rejected">
): Promise<void> {
  const supabase = createServiceClient();

  // Cast from() to any — same supabase ≥2.104 Update-type-as-never issue.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("job_comments") as any)
    .update({ status })
    .eq("id", commentId);

  if (error) {
    console.error("[db/admin] moderateComment error:", error.message);
    throw new Error("Failed to update comment status");
  }
}
