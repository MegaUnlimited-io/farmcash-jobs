import { notFound } from "next/navigation";
import { getJobBySlug, getRatingsSummary } from "@/lib/db/jobs";
import { getUserRating } from "@/lib/db/ratings";
import { createClient, createAnonClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import { CTAButton } from "@/components/CTAButton";
import { StarRating } from "@/components/StarRating";
import { RatingBar } from "@/components/RatingBar";
import { RatingSection } from "./RatingSection";
import { CommentForm } from "./CommentForm";
import { CommentsList } from "./CommentsList";
import Link from "next/link";
import { Suspense } from "react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Job Not Found" };

  const description =
    job.description?.slice(0, 160) ??
    `Community ratings for ${job.name} on FarmCash.`;

  return {
    title: job.name,
    description,
    alternates: { canonical: `/jobs/${job.slug}` },
    openGraph: {
      title: job.name,
      description,
      url: `/jobs/${job.slug}`,
      siteName: "FarmCash Jobs",
      type: "website",
      ...(job.icon_url
        ? { images: [{ url: job.icon_url, width: 512, height: 512, alt: job.name }] }
        : {}),
    },
    twitter: {
      card: "summary",
      title: job.name,
      description,
      ...(job.icon_url ? { images: [job.icon_url] } : {}),
    },
  };
}

export async function generateStaticParams() {
  const supabase = createAnonClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("jobs") as any)
    .select("slug")
    .neq("status", "under_review");
  return ((data ?? []) as Array<{ slug: string }>).map((j) => ({ slug: j.slug }));
}

export default function JobDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bg" />}>
      <JobDetailContent params={params} />
    </Suspense>
  );
}

async function JobDetailContent({ params }: Props) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const [summary, supabase] = await Promise.all([
    getRatingsSummary(job.id),
    createClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const hasRated = userId ? !!(await getUserRating(job.id, userId)) : false;

  const showCTA = job.status === "active";
  const isRemoved = job.status === "partner_removed";
  const isBlacklisted = job.status === "blacklisted";
  const hasRatings = summary && summary.total_ratings > 0;

  const description =
    job.description?.slice(0, 160) ??
    `Community ratings for ${job.name} on FarmCash.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemPage",
    name: job.name,
    description,
    url: `https://farmcash.app/jobs/${job.slug}`,
    ...(job.icon_url ? { image: job.icon_url } : {}),
    ...(summary && summary.avg_overall && summary.total_ratings > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: summary.avg_overall.toFixed(1),
            ratingCount: summary.total_ratings,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };

  const jsonLdString = JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <main className="min-h-screen bg-bg text-fg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />

      {/* Sticky nav */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2 min-w-0">
          <Link href="/jobs" className="text-muted hover:text-fg transition-colors text-sm shrink-0">
            ← Jobs
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm text-muted truncate">{job.name}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Status notices */}
        {isBlacklisted && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            <strong>Not Recommended</strong> — This offer has been flagged by the FarmCash community.
          </div>
        )}
        {isRemoved && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-border rounded-xl p-4 text-sm text-muted">
            This offer is no longer available, but community ratings remain for reference.
          </div>
        )}

        {/* ── Hero — App Store style ── */}
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <JobIcon name={job.name} iconUrl={job.icon_url} size={100} />

          <div>
            <h1 className="text-2xl font-bold text-fg">{job.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge status={job.status} />
              {job.conversion_type && (
                <span className="text-xs uppercase tracking-wider text-muted">
                  {job.conversion_type}
                </span>
              )}
            </div>
          </div>

          {/* Rating — shown under name, app-store style */}
          {hasRatings ? (
            <div className="flex flex-col items-center gap-0.5">
              <StarRating rating={summary.avg_overall ?? 0} size="lg" />
              {summary.human_ratings > 0 ? (
                <span className="text-xs text-muted">
                  {summary.human_ratings}{" "}
                  {summary.human_ratings === 1 ? "rating" : "ratings"}
                </span>
              ) : (
                <span className="text-xs text-muted italic">
                  AI estimate · be the first to rate!
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted italic">No ratings yet</p>
          )}

          {/* Payout */}
          <div className="flex items-center gap-2">
            {job.payout_max && job.payout_min && job.payout_min < job.payout_max ? (
              <>
                <SeedsChip seeds={job.payout_min} className="text-base" />
                <span className="text-muted text-sm">–</span>
                <SeedsChip seeds={job.payout_max} className="text-base" />
              </>
            ) : (
              <SeedsChip seeds={job.payout_max} className="text-base" />
            )}
          </div>

          {/* PRIMARY CTA */}
          {showCTA && (
            <div className="w-full max-w-xs">
              <CTAButton jobName={job.name} jobSlug={job.slug} />
            </div>
          )}
        </div>

        {/* ── Metrics grid ── */}
        {hasRatings && (
          <div className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
            {[
              { label: "Ads",        value: summary.avg_ad_aggression  },
              { label: "Tasks Difficulty",       value: summary.avg_task_difficulty },
              { label: "Payment Speed",  value: summary.avg_payment_speed  },
            ].map(({ label, value }) => (
              <div key={label} className="bg-card p-4 text-center">
                <p className="text-2xl font-bold text-fg">
                  {value?.toFixed(1) ?? "—"}
                </p>
                <p className="text-xs text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Screenshots ── */}
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

        {/* ── About ── */}
        {job.description && (
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-fg mb-2">About this Offer</h2>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </section>
        )}

        {/* ── Tasks to complete ── */}
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
                      <div className="mt-0.5">
                        <SeedsChip seeds={task.payout_seeds} className="text-xs" />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Community ratings detail ── */}
        {hasRatings && (
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-fg mb-4">Community Ratings</h2>
            <div className="space-y-3">
              <RatingBar label="Ads"       value={summary.avg_ad_aggression}  />
              <RatingBar label="Ease"      value={summary.avg_task_difficulty} />
              <RatingBar label="Pay Speed" value={summary.avg_payment_speed}   />
            </div>
            <p className="text-xs text-muted mt-4">
              {summary.human_ratings > 0
                ? `Based on ${summary.human_ratings} community ${summary.human_ratings === 1 ? "rating" : "ratings"}`
                : "AI estimate — community ratings coming soon"}
            </p>
          </section>
        )}

        {/* ── Rate this offer (expandable, subordinate to CTA) ── */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-fg mb-4">Rate this Offer</h2>
          <RatingSection jobId={job.id} userId={userId} hasRated={hasRated} />
        </section>

        {/* ── Community comments ── */}
        <section className="bg-card border border-border rounded-2xl p-5 space-y-5">
          <div>
            <h2 className="font-semibold text-fg mb-4">Community Comments</h2>
            <Suspense
              fallback={
                <p className="text-sm text-muted animate-pulse">Loading comments…</p>
              }
            >
              <CommentsList jobId={job.id} />
            </Suspense>
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-fg mb-3">Leave a Comment</h3>
            <CommentForm jobId={job.id} userId={userId} />
          </div>
        </section>

      </div>
    </main>
  );
}
