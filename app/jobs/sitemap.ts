import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAnonClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobs } = await (supabase.from("jobs") as any)
    .select("slug, updated_at")
    .neq("status", "under_review");

  const jobUrls: MetadataRoute.Sitemap = ((jobs ?? []) as Array<{ slug: string; updated_at: string }>).map((job) => ({
    url: `https://farmcash.app/jobs/${job.slug}`,
    lastModified: new Date(job.updated_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: "https://farmcash.app/jobs",
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    ...jobUrls,
  ];
}
