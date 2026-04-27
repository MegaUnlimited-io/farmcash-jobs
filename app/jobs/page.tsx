import { getJobs, getFeaturedJobs, getAllRatingsSummaries } from "@/lib/db/jobs";
import { JobsListing } from "./JobsListing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobs",
  description:
    "Browse community-rated offers in the FarmCash app. Find the highest-paying, easiest jobs.",
  alternates: { canonical: "/jobs" },
  openGraph: {
    title: "FarmCash Jobs",
    description:
      "Browse community-rated offers in the FarmCash app. Find the highest-paying, easiest jobs.",
    url: "/jobs",
    siteName: "FarmCash Jobs",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "FarmCash Jobs",
    description:
      "Browse community-rated offers in the FarmCash app. Find the highest-paying, easiest jobs.",
  },
};

export default async function JobsPage() {
  const [jobs, featured, summaries] = await Promise.all([
    getJobs(),
    getFeaturedJobs(),
    getAllRatingsSummaries(),
  ]);

  const ratingsById = Object.fromEntries(summaries.map((s) => [s.job_id, s]));

  return <JobsListing jobs={jobs} featured={featured} ratingsById={ratingsById} />;
}
