import { notFound } from "next/navigation";
import { getJobBySlug, getRatingsSummary } from "@/lib/db/jobs";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import { CTAButton } from "@/components/CTAButton";
import { RatingsSummary } from "@/components/RatingsSummary";
import { RatingForm } from "./RatingForm";
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
  return {
    title: job.name,
    description:
      job.description?.slice(0, 160) ??
      `Community ratings for ${job.name} on FarmCash.`,
  };
}

// params is a runtime API with cacheComponents — must be inside <Suspense>.
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

  const showCTA = job.status === "active";
  const isRemoved = job.status === "partner_removed";
  const isBlacklisted = job.status === "blacklisted";

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Back nav */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/jobs" className="text-muted hover:text-fg transition-colors text-sm">
            ← Jobs
          </Link>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium truncate text-fg">{job.name}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
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

        {/* Hero card */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex gap-4">
            <JobIcon name={job.name} iconUrl={job.icon_url} size={80} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-tight text-fg">{job.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusBadge status={job.status} />
                {job.conversion_type && (
                  <span className="text-xs font-medium uppercase tracking-wider text-muted">
                    {job.conversion_type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-3">
                {job.payout_amount && (
                  <span className="text-2xl font-bold text-primary">
                    ${job.payout_amount.toFixed(2)}
                  </span>
                )}
                <SeedsChip seeds={job.seeds_amount} className="text-base" />
              </div>
            </div>
          </div>

          {showCTA && (
            <div className="mt-4">
              <CTAButton />
            </div>
          )}
        </div>

        {/* Community rating summary */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-fg mb-4">Community Rating</h2>
          <RatingsSummary summary={summary} />
        </section>

        {/* Rate this offer */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-fg mb-4">Rate this Offer</h2>
          <RatingForm jobId={job.id} userId={userId} />
        </section>

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
                  className="h-64 w-auto rounded-xl object-cover flex-shrink-0 snap-start border border-border"
                />
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {job.description && (
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-fg mb-3">About this Offer</h2>
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
                      <p className="text-xs text-muted mt-0.5">
                        ${task.payout_usd.toFixed(2)} reward
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Community comments */}
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
