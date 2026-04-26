import { getJobs, getFeaturedJobs } from "@/lib/db/jobs";
import type { Metadata } from "next";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import { AuthButton } from "@/components/AuthButton";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jobs",
  description:
    "Browse community-rated offers in the FarmCash app. Find the highest-paying, easiest jobs.",
  alternates: {
    canonical: "/jobs",
  },
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
  const [jobs, featured] = await Promise.all([getJobs(), getFeaturedJobs()]);
  const featuredIds = new Set(featured.map((j) => j.id));
  const rest = jobs.filter((j) => !featuredIds.has(j.id));

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-fg">FarmCash Jobs</h1>
            <p className="text-xs text-muted">
              {jobs.length.toLocaleString()} offers
            </p>
          </div>
          <AuthButton />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Featured section */}
        {featured.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Featured
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {featured.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.slug}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <JobIcon name={job.name} iconUrl={job.icon_url} size={56} />
                  <span className="text-xs text-center font-medium leading-tight line-clamp-2 text-fg">
                    {job.name}
                  </span>
                  <SeedsChip seeds={job.payout_max} className="text-xs" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* All jobs list */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            All Offers
          </h2>
          <div className="space-y-2">
            {rest.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.slug}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <JobIcon
                  name={job.name}
                  iconUrl={job.icon_url}
                  size={48}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-fg">
                    {job.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={job.status} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <SeedsChip seeds={job.payout_max} className="text-sm" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
