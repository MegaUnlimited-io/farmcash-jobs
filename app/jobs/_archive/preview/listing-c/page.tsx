/**
 * LISTING DESIGN C — "Editorial / Magazine"
 * Large featured hero cards, then icon+name tiles.
 * Brand-forward, feels curated and premium.
 */
import { getJobs, getFeaturedJobs } from "@/lib/db/jobs";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import Link from "next/link";

export default async function ListingVariantC() {
  const [jobs, featured] = await Promise.all([getJobs(), getFeaturedJobs()]);
  const featuredIds = new Set(featured.map((j) => j.id));
  const rest = jobs.filter((j) => !featuredIds.has(j.id));
  const hero = featured[0];
  const featuredRest = featured.slice(1);

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Full-width header banner */}
      <div className="bg-primary text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-1">
            FarmCash
          </p>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-sm opacity-80 mt-1">
            {jobs.length.toLocaleString()} offers rated by the community
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Hero featured card */}
        {hero && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Top Pick
            </p>
            <Link
              href={`/jobs/${hero.slug}`}
              className="flex gap-5 p-5 rounded-2xl bg-card border-2 border-primary/30 hover:border-primary/60 transition-colors"
            >
              <JobIcon name={hero.name} iconUrl={hero.icon_url} size={72} className="shrink-0" />
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-fg">{hero.name}</h2>
                {hero.description && (
                  <p className="text-sm text-muted mt-1 line-clamp-2">
                    {hero.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <SeedsChip seeds={hero.payout_max} />
                  <StatusBadge status={hero.status} />
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Featured sub-grid */}
        {featuredRest.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Featured
            </p>
            <div className="grid grid-cols-2 gap-3">
              {featuredRest.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.slug}`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <JobIcon name={job.name} iconUrl={job.icon_url} size={48} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate text-fg">{job.name}</p>
                    <div className="mt-0.5"><SeedsChip seeds={job.payout_max} className="text-sm" /></div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Tile grid for the rest */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            All Offers
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
            {rest.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.slug}`}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="relative">
                  <JobIcon
                    name={job.name}
                    iconUrl={job.icon_url}
                    size={56}
                    className="group-hover:ring-2 ring-primary/50 transition-all"
                  />
                  {job.status !== "active" && (
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-bg" />
                  )}
                </div>
                <span className="text-xs text-center font-medium line-clamp-2 leading-tight text-fg">
                  {job.name}
                </span>
                <SeedsChip seeds={job.payout_max} className="text-xs" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
