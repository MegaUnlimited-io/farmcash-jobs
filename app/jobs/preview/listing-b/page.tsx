/**
 * LISTING DESIGN B — "Ranked List"
 * Compact numbered list sorted by payout. Featured as top banner cards.
 * Information-dense, power-user friendly.
 */
import { getJobs, getFeaturedJobs } from "@/lib/db/jobs";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import Link from "next/link";

export default async function ListingVariantB() {
  const [jobs, featured] = await Promise.all([getJobs(), getFeaturedJobs()]);
  const featuredIds = new Set(featured.map((j) => j.id));
  const rest = jobs.filter((j) => !featuredIds.has(j.id));

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">FarmCash Jobs</h1>
            <p className="text-sm text-muted mt-0.5">Community-rated offer wall</p>
          </div>
          <span className="text-sm font-medium text-muted">
            {jobs.length.toLocaleString()} offers
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Featured banner row */}
        {featured.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Featured Offers
            </p>
            <div className="grid grid-cols-2 gap-3">
              {featured.slice(0, 4).map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.slug}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
                >
                  <JobIcon name={job.name} iconUrl={job.icon_url} size={44} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate text-fg">{job.name}</p>
                    <p className="text-sm font-bold text-primary mt-0.5">
                      {job.payout_amount ? `$${job.payout_amount.toFixed(2)}` : "—"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Ranked list */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            All Offers — Ranked by Payout
          </p>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {rest.map((job, i) => (
              <Link
                key={job.id}
                href={`/jobs/${job.slug}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-border/30 transition-colors"
              >
                {/* rank */}
                <span className="text-sm font-bold text-muted w-6 shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <JobIcon name={job.name} iconUrl={job.icon_url} size={40} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-fg">{job.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusBadge status={job.status} />
                    {job.conversion_type && (
                      <span className="text-xs text-muted uppercase">{job.conversion_type}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  {job.payout_amount && (
                    <p className="font-bold text-primary text-sm">
                      ${job.payout_amount.toFixed(2)}
                    </p>
                  )}
                  <SeedsChip seeds={job.seeds_amount} className="text-xs justify-end" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
