/**
 * DETAIL DESIGN A — "App Store"
 * Large icon centred at top, star rating directly below icon,
 * then payout/seeds row, then CTA. Tabs feel, info stacked cleanly.
 * Closest to Apple App Store / Google Play Store pattern.
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

export default function DetailVariantA({ params }: Props) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bg" />}>
      <DetailVariantAContent params={params} />
    </Suspense>
  );
}

async function DetailVariantAContent({ params }: Props) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const summary = await getRatingsSummary(job.id);

  const showCTA = job.status === "active";
  const isRemoved = job.status === "partner_removed";
  const isBlacklisted = job.status === "blacklisted";

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Nav */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/jobs/preview/listing-a" className="text-muted hover:text-fg text-sm transition-colors">
            ← Listing A
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Status notices */}
        {isBlacklisted && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            <strong>Not Recommended</strong> — This offer has been flagged by the FarmCash community.
          </div>
        )}
        {isRemoved && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-border rounded-xl p-4 text-sm text-muted">
            This offer is no longer available. Community ratings remain for reference.
          </div>
        )}

        {/* Hero — centred icon + rating */}
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <JobIcon name={job.name} iconUrl={job.icon_url} size={100} />
          <div>
            <h1 className="text-2xl font-bold text-fg">{job.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <StatusBadge status={job.status} />
              {job.conversion_type && (
                <span className="text-xs uppercase tracking-wider text-muted">
                  {job.conversion_type}
                </span>
              )}
            </div>
          </div>

          {/* Star rating directly under name — app-store signature */}
          {summary && summary.total_ratings > 0 ? (
            <StarRating rating={summary.avg_overall ?? 0} count={summary.human_ratings} size="lg" />
          ) : (
            <p className="text-xs text-muted italic">No ratings yet</p>
          )}

          {/* Payout */}
          <div className="flex items-center gap-4">
            <SeedsChip seeds={job.payout_max} className="text-base" />
          </div>

          {showCTA && (
            <div className="w-full max-w-xs">
              <CTAButton />
            </div>
          )}
        </div>

        {/* Horizontal divider metrics row */}
        {summary && summary.total_ratings > 0 && (
          <div className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
            {[
              { label: "Ease", value: summary.avg_task_difficulty },
              { label: "Ads", value: summary.avg_ad_aggression },
              { label: "Pay Speed", value: summary.avg_payment_speed },
            ].map(({ label, value }) => (
              <div key={label} className="bg-card p-4 text-center">
                <p className="text-2xl font-bold text-fg">{value?.toFixed(1) ?? "—"}</p>
                <p className="text-xs text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Screenshots */}
        {job.screenshots && job.screenshots.length > 0 && (
          <section>
            <h2 className="font-semibold text-fg mb-3">Screenshots</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x -mx-4 px-4">
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
                    {task.payout_seeds > 0 && (
                      <div className="mt-0.5"><SeedsChip seeds={task.payout_seeds} className="text-xs" /></div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Rating breakdown — bottom of page, full detail */}
        {summary && summary.total_ratings > 0 && (
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-fg mb-4">Community Ratings</h2>
            <div className="space-y-3">
              <RatingBar label="Ease" value={summary.avg_task_difficulty} />
              <RatingBar label="Ads" value={summary.avg_ad_aggression} />
              <RatingBar label="Pay Speed" value={summary.avg_payment_speed} />
            </div>
            <p className="text-xs text-muted mt-4">
              Based on {summary.human_ratings} community{" "}
              {summary.human_ratings === 1 ? "rating" : "ratings"}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
