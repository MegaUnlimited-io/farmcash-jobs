/**
 * LISTING DESIGN A — "App Store Grid"
 * Icon-forward 2-column card grid. Featured strip at top.
 * Casual, visual, browse-first.
 */
import { getJobs, getFeaturedJobs } from "@/lib/db/jobs";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import Link from "next/link";

export default async function ListingVariantA() {
  const [jobs, featured] = await Promise.all([getJobs(), getFeaturedJobs()]);
  const featuredIds = new Set(featured.map((j) => j.id));
  const rest = jobs.filter((j) => !featuredIds.has(j.id));

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Top bar */}
      <div className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-fg">Jobs</h1>
          <p className="text-sm text-muted mt-1">
            {jobs.length.toLocaleString()} offers · Community rated
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Featured horizontal scroll strip */}
        {featured.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-fg">Featured</h2>
              <span className="text-xs text-muted">Handpicked</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 snap-x -mx-4 px-4">
              {featured.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.slug}`}
                  className="flex-shrink-0 snap-start w-36 flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <JobIcon name={job.name} iconUrl={job.icon_url} size={64} />
                  <span className="text-xs text-center font-medium leading-snug line-clamp-2 text-fg">
                    {job.name}
                  </span>
                  {job.payout_amount && (
                    <span className="text-sm font-bold text-primary">
                      ${job.payout_amount.toFixed(2)}
                    </span>
                  )}
                  <SeedsChip seeds={job.seeds_amount} className="text-xs" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 2-column icon grid */}
        <section>
          <h2 className="font-semibold text-fg mb-3">All Offers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rest.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.slug}`}
                className="flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <JobIcon name={job.name} iconUrl={job.icon_url} size={52} />
                  <StatusBadge status={job.status} />
                </div>
                <div>
                  <p className="font-semibold text-sm line-clamp-2 leading-snug text-fg">
                    {job.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {job.payout_amount && (
                      <span className="font-bold text-primary text-sm">
                        ${job.payout_amount.toFixed(2)}
                      </span>
                    )}
                    <SeedsChip seeds={job.seeds_amount} className="text-xs" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
