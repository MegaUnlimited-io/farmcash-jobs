"use cache";

import { cacheTag, cacheLife } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";
import type { Job, JobRatingsSummary } from "@/lib/types";

// All functions in this file are cached.
// cacheTag calls enable on-demand revalidation from /api/revalidate.
// cacheLife('hours') aligns with the 6h sync cron.

export async function getJobs(): Promise<Job[]> {
  cacheTag("jobs-listing");
  cacheLife("hours");

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .neq("status", "under_review")
    .neq("status", "blacklisted")
    .order("payout_max", { ascending: false });

  if (error) {
    console.error("[db/jobs] getJobs error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getJobBySlug(slug: string): Promise<Job | null> {
  cacheTag(`job:${slug}`);
  cacheLife("hours");

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[db/jobs] getJobBySlug error:", error.message);
    }
    return null;
  }
  return data;
}

export async function getFeaturedJobs(): Promise<Job[]> {
  cacheTag("jobs-featured");
  cacheLife("hours");

  const supabase = createAnonClient();

  // Try jobs_featured table first (created in MIGRATION021)
  const { data: featured, error: featuredError } = await supabase
    .from("jobs_featured" as "jobs")
    .select("job_id, display_order")
    .order("display_order", { ascending: true })
    .limit(7);

  if (!featuredError && featured && featured.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobIds = (featured as any[]).map((f) => f.job_id);
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .in("id", jobIds)
      .eq("status", "active");
    return jobs ?? [];
  }

  // Fallback: top-payout active jobs with icons
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "active")
    .not("icon_url", "is", null)
    .order("payout_max", { ascending: false })
    .limit(7);

  if (error) {
    console.error("[db/jobs] getFeaturedJobs error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getNewJobs(): Promise<Job[]> {
  cacheTag("jobs-new");
  cacheLife("hours");

  const supabase = createAnonClient();

  // Fetch a window of recent active jobs to find the most recent batch date.
  // Jobs are added in sync batches so they share the same created_at date.
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Job[]>();

  if (error) {
    console.error("[db/jobs] getNewJobs error:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  // Determine the most recent batch date (YYYY-MM-DD) from the first result.
  const mostRecentDate = data[0].created_at.slice(0, 10);

  // Return only jobs that share that date.
  return data.filter((j) => j.created_at.slice(0, 10) === mostRecentDate);
}

export async function getAllRatingsSummaries(): Promise<JobRatingsSummary[]> {
  cacheTag("ratings-all");
  cacheLife("hours");

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("job_ratings_summary")
    .select("*");

  if (error) {
    console.error("[db/jobs] getAllRatingsSummaries error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getRatingsSummary(
  jobId: string
): Promise<JobRatingsSummary | null> {
  cacheTag(`ratings:${jobId}`);
  cacheLife("hours");

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("job_ratings_summary")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[db/jobs] getRatingsSummary error:", error.message);
    }
    return null;
  }
  return data;
}
