import { createServiceClient } from "@/lib/supabase/service";
import type { CommentStatus, JobComment, Job, PendingComment, JobStatus } from "@/lib/types";

export interface FeaturedEntry {
  job_id: string;
  display_order: number;
  job_name: string;
  job_slug: string;
  job_icon_url: string | null;
}

export interface JobSearchResult {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  status: JobStatus;
  enriched_at: string | null;
}

// All functions here use the service role client (bypasses RLS).
// Cast data from .select() to the expected type — @supabase/supabase-js ≥2.104
// resolves Row to `never` when the Database generic doesn't fully resolve.

export interface AdminStats {
  totalJobs: number;
  enrichedJobs: number;
  unenrichedJobs: number;
  pendingComments: number;
  totalRatings: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createServiceClient();

  const [
    { count: totalJobs },
    { count: enrichedJobs },
    { count: unenrichedJobs },
    { count: pendingComments },
    { count: totalRatings },
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }),
    supabase.from("jobs").select("*", { count: "exact", head: true }).not("enriched_at", "is", null),
    supabase.from("jobs").select("*", { count: "exact", head: true }).is("enriched_at", null).not("app_package_id", "is", null),
    supabase.from("job_comments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("job_ratings").select("*", { count: "exact", head: true }).eq("is_bot", false),
  ]);

  return {
    totalJobs:       totalJobs       ?? 0,
    enrichedJobs:    enrichedJobs    ?? 0,
    unenrichedJobs:  unenrichedJobs  ?? 0,
    pendingComments: pendingComments ?? 0,
    totalRatings:    totalRatings    ?? 0,
  };
}

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

export async function getFeaturedList(): Promise<FeaturedEntry[]> {
  const supabase = createServiceClient();

  const { data: rawRows, error } = await supabase
    .from("jobs_featured")
    .select("job_id, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[db/admin] getFeaturedList error:", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase ≥2.104 Row resolves to never
  const rows = (rawRows ?? []) as any[];
  if (rows.length === 0) return [];

  const jobIds = rows.map((r) => r.job_id);
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, slug, icon_url")
    .in("id", jobIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row resolves to never with partial select
  const jobMap = new Map(((jobs ?? []) as any[]).map((j) => [j.id, j]));

  return rows.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = jobMap.get(r.job_id) as any;
    return {
      job_id: r.job_id,
      display_order: r.display_order,
      job_name: job?.name ?? "Unknown",
      job_slug: job?.slug ?? "",
      job_icon_url: job?.icon_url ?? null,
    };
  });
}

export async function searchJobs(query: string): Promise<JobSearchResult[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, name, slug, icon_url, status, enriched_at")
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[db/admin] searchJobs error:", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial select Row issue
  return ((data ?? []) as any[]) as JobSearchResult[];
}

export async function addFeatured(jobId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("jobs_featured")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) >= 7) {
    return { error: "Max 7 featured slots reached. Remove one first." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row resolves to never (supabase ≥2.104)
  const { data: maxRow } = await (supabase as any)
    .from("jobs_featured")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = ((maxRow as { display_order?: number } | null)?.display_order ?? 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Insert resolves to never (supabase ≥2.104)
  const { error } = await (supabase.from("jobs_featured") as any)
    .insert({ job_id: jobId, display_order: nextOrder });

  if (error) {
    if (error.code === "23505") return { error: "Job is already featured." };
    console.error("[db/admin] addFeatured error:", error.message);
    return { error: "Failed to add featured job." };
  }
  return {};
}

export async function removeFeatured(jobId: string): Promise<void> {
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row resolves to never (supabase ≥2.104)
  const { error } = await (supabase.from("jobs_featured") as any)
    .delete()
    .eq("job_id", jobId);
  if (error) {
    console.error("[db/admin] removeFeatured error:", error.message);
    throw new Error("Failed to remove featured job");
  }
}

export async function reorderFeatured(orderedJobIds: string[]): Promise<void> {
  const supabase = createServiceClient();

  // Update each row's display_order based on position in the ordered array.
  await Promise.all(
    orderedJobIds.map((jobId, index) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row resolves to never (supabase ≥2.104)
      (supabase.from("jobs_featured") as any)
        .update({ display_order: index + 1 })
        .eq("job_id", jobId)
    )
  );
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<{ slug: string } | { error: string }> {
  const supabase = createServiceClient();

  // Fetch the slug first so the caller can revalidate the job page.
  const { data: job } = await supabase
    .from("jobs")
    .select("slug")
    .eq("id", jobId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial select Row issue
  const slug = (job as any)?.slug as string | undefined;
  if (!slug) return { error: "Job not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Update Row resolves to never
  const { error } = await (supabase.from("jobs") as any)
    .update({ status })
    .eq("id", jobId);

  if (error) {
    console.error("[db/admin] updateJobStatus error:", error.message);
    return { error: "Failed to update job status" };
  }

  return { slug };
}
