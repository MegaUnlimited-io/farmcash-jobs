/**
 * DETAIL DESIGN C — "Dashboard / Compact"
 * Slim top bar with icon + name + CTA inline.
 * Below: two-column scorecard (rating left, payout right) in a single band.
 * Everything else stacks in clean cards. Very information-dense, minimal chrome.
 * Works great on mobile because every section is scannable at a glance.
 */
import { notFound } from "next/navigation";
import { getJobBySlug, getRatingsSummary } from "@/lib/db/jobs";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import { CTAButton } from "@/components/CTAButton";
import { StarRating } from "@/components/StarRating";
import { RatingBar } from "@/components/RatingBar";
import Link from "next/link";
import { Suspense } from "react";

interface Props {
  params: Promise<{ slug: string }>;
}

export default function DetailVariantC({ params }: Props) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bg" />}>
      <DetailVariantCContent params={params} />
    </Suspense>
  );
}

async function DetailVariantCContent({ params }: Props) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const summary = await getRatingsSummary(job.id);

  const showCTA = job.status === "active";
  const isRemoved = job.status === "partner_removed";
  const isBlacklisted = job.status === "blacklisted";
  const hasRatings = summary && summary.total_ratings > 0;

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Compact top bar: icon + name inline */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/jobs/preview/listing-c" className="text-muted hover:text-fg text-sm transition-colors shrink-0">
              ←
            </Link>
            <JobIcon name={job.name} iconUrl={job.icon_url} size={36} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-fg">{job.name}</p>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={job.status} />
              </div>
            </div>
            {showCTA && (
              <div className="shrink-0">
                <CTAButton />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {/* Status notices */}
        {isBlacklisted && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
            <strong>Not Recommended</strong> — Flagged by the community.
          </div>
        )}
        {isRemoved && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-border rounded-xl p-3 text-sm text-muted">
            This offer is no longer available. Ratings remain for reference.
          </div>
        )}

        {/* Scorecard band: rating | payout */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Rating
            </p>
            {hasRatings ? (
              <>
                <p className="text-4xl font-bold text-fg leading-none">
                  {summary.avg_overall?.toFixed(1) ?? "—"}
                </p>
                <StarRating rating={summary.avg_overall ?? 0} size="sm" />
                <p className="text-xs text-muted mt-1">{summary.human_ratings} reviews</p>
              </>
            ) : (
              <p className="text-sm text-muted italic mt-1">No ratings yet</p>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Reward
            </p>
            {job.payout_amount ? (
              <p className="text-4xl font-bold text-primary leading-none">
                ${job.payout_amount.toFixed(2)}
              </p>
            ) : (
              <p className="text-2xl font-bold text-muted leading-none">—</p>
            )}
            <SeedsChip seeds={job.seeds_amount} className="mt-2" />
            {job.conversion_type && (
              <p className="text-xs uppercase tracking-wider text-muted mt-1">
                {job.conversion_type}
              </p>
            )}
          </div>
        </div>

        {/* Sub-rating breakdown */}
        {hasRatings && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Breakdown
            </p>
            <RatingBar label="Ease" value={summary.avg_task_difficulty} />
            <RatingBar label="Ads" value={summary.avg_ad_aggression} />
            <RatingBar label="Pay Speed" value={summary.avg_payment_speed} />
          </div>
        )}

        {/* Screenshots */}
        {job.screenshots && job.screenshots.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Screenshots
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x -mx-1 px-1">
              {job.screenshots.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`${job.name} screenshot ${i + 1}`}
                  className="h-52 w-auto rounded-xl object-cover flex-shrink-0 snap-start border border-border"
                />
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {job.description && (
          <section className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              About
            </p>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </section>
        )}

        {/* CPE Tasks */}
        {job.cpe_tasks && job.cpe_tasks.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Tasks to Complete
            </p>
            <ol className="space-y-2.5">
              {job.cpe_tasks.map((task, i) => (
                <li key={task.id} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">{task.name}</p>
                    {task.payout_usd && (
                      <p className="text-xs text-muted mt-0.5">${task.payout_usd.toFixed(2)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
