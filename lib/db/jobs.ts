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
    .limit(6);

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
    .limit(6);

  if (error) {
    console.error("[db/jobs] getFeaturedJobs error:", error.message);
    return [];
  }
  return data ?? [];
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
