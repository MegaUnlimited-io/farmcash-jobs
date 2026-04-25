/**
 * DETAIL DESIGN B — "Review Card"
 * Rating is the hero — large score + stars fill the top card alongside the icon.
 * Feels like a review site (G2, Trustpilot). Sub-ratings are visible immediately
 * as bars inside the same hero card. CTA is prominent below the hero.
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

export default function DetailVariantB({ params }: Props) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bg" />}>
      <DetailVariantBContent params={params} />
    </Suspense>
  );
}

async function DetailVariantBContent({ params }: Props) {
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
      {/* Nav */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/jobs/preview/listing-b" className="text-muted hover:text-fg text-sm transition-colors">
            ← Listing B
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status notices */}
        {isBlacklisted && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            <strong>Not Recommended</strong> — Flagged by the FarmCash community.
          </div>
        )}
        {isRemoved && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-border rounded-xl p-4 text-sm text-muted">
            This offer is no longer available. Ratings remain for reference.
          </div>
        )}

        {/* Hero card: icon + name left, rating right */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex gap-4">
            <JobIcon name={job.name} iconUrl={job.icon_url} size={72} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-tight text-fg">{job.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <StatusBadge status={job.status} />
                {job.conversion_type && (
                  <span className="text-xs uppercase tracking-wider text-muted">{job.conversion_type}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2">
                {job.payout_amount && (
                  <span className="text-2xl font-bold text-primary">
                    ${job.payout_amount.toFixed(2)}
                  </span>
                )}
                <SeedsChip seeds={job.seeds_amount} />
              </div>
            </div>
          </div>

          {/* Rating takes centre stage — side by side with score */}
          <div className="border-t border-border pt-4">
            {hasRatings ? (
              <div className="flex gap-6 items-start">
                {/* Big score */}
                <div className="text-center shrink-0">
                  <p className="text-5xl font-bold text-fg leading-none">
                    {summary.avg_overall?.toFixed(1) ?? "—"}
                  </p>
                  <StarRating rating={summary.avg_overall ?? 0} size="sm" />
                  <p className="text-xs text-muted mt-1">{summary.human_ratings} ratings</p>
                </div>
                {/* Breakdown bars */}
                <div className="flex-1 space-y-2 pt-1">
                  <RatingBar label="Ease" value={summary.avg_task_difficulty} />
                  <RatingBar label="Ads" value={summary.avg_ad_aggression} />
                  <RatingBar label="Pay Speed" value={summary.avg_payment_speed} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted italic">No ratings yet — be the first!</p>
            )}
          </div>

          {showCTA && <CTAButton />}
        </div>

        {/* Screenshots */}
        {job.screenshots && job.screenshots.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-fg mb-3">Screenshots</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x -mx-1 px-1">
              {job.screenshots.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`${job.name} screenshot ${i + 1}`}
                  className="h-56 w-auto rounded-xl object-cover flex-shrink-0 snap-start border border-border"
                />
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {job.description && (
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-fg mb-2">About this Offer</h2>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </section>
        )}

        {/* CPE Tasks */}
        {job.cpe_tasks && job.cpe_tasks.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-fg mb-3">Tasks to Complete</h2>
            <ol className="space-y-3">
              {job.cpe_tasks.map((task, i) => (
                <li key={task.id} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">{task.name}</p>
                    {task.payout_usd && (
                      <p className="text-xs text-muted mt-0.5">${task.payout_usd.toFixed(2)} reward</p>
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
