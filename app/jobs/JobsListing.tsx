"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { JobIcon } from "@/components/JobIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { SeedsChip } from "@/components/SeedsChip";
import { StarRating } from "@/components/StarRating";
import { AuthButton } from "@/components/AuthButton";
import type { Job, JobRatingsSummary } from "@/lib/types";

interface Props {
  jobs: Job[];
  featured: Job[];
  ratingsById: Record<string, JobRatingsSummary>;
}

export function JobsListing({ jobs, featured, ratingsById }: Props) {
  const [query, setQuery] = useState("");

  const featuredIds = useMemo(() => new Set(featured.map((j) => j.id)), [featured]);
  const hero = featured[0] ?? null;
  const featuredRest = useMemo(() => featured.slice(1), [featured]);
  const rest = useMemo(() => jobs.filter((j) => !featuredIds.has(j.id)), [jobs, featuredIds]);

  // Client-side search across all jobs
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.category?.toLowerCase().includes(q) ||
        (j.description ?? "").toLowerCase().slice(0, 300).includes(q)
    );
  }, [query, jobs]);

  const isSearching = searchResults !== null;

  return (
    <main className="min-h-screen bg-bg text-fg">

      {/* ── Green header banner ── */}
      <div className="bg-primary text-white">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-0.5">
                FarmCash
              </p>
              <h1 className="text-3xl font-bold leading-none">Jobs</h1>
              <p className="text-sm opacity-75 mt-1">
                {jobs.length.toLocaleString()} offers rated by the community
              </p>
            </div>
            <div className="shrink-0 mt-1">
              <AuthButton />
            </div>
          </div>

          {/* Search — focal point */}
          <div className="relative flex items-center gap-2 bg-white/95 rounded-xl px-4 py-3 shadow-sm">
            <svg
              className="w-4 h-4 text-muted shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${jobs.length.toLocaleString()} offers…`}
              className="flex-1 bg-transparent text-fg text-sm outline-none placeholder:text-muted min-w-0"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted hover:text-fg transition-colors shrink-0 text-base leading-none"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* ── Search results ── */}
        {isSearching && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              {searchResults!.length > 0
                ? `${searchResults!.length} result${searchResults!.length === 1 ? "" : "s"}`
                : "No results"}
            </p>
            {searchResults!.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">
                No offers match &ldquo;{query}&rdquo;
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults!.map((job) => {
                  const rating = ratingsById[job.id];
                  return (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.slug}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                    >
                      <JobIcon name={job.name} iconUrl={job.icon_url} size={44} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate text-fg">{job.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {rating?.avg_overall != null && rating.total_ratings > 0 && (
                            <span className="text-xs text-secondary font-medium tabular-nums">
                              ★ {rating.avg_overall.toFixed(1)}
                            </span>
                          )}
                          {job.category && (
                            <span className="text-xs text-muted">{job.category}</span>
                          )}
                          <StatusBadge status={job.status} />
                        </div>
                      </div>
                      <SeedsChip seeds={job.payout_max} className="text-sm shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Normal listing (hidden when searching) ── */}
        {!isSearching && (
          <>
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
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-fg">{hero.name}</h2>
                    {hero.description && (
                      <p className="text-sm text-muted mt-1 line-clamp-2">{hero.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <SeedsChip seeds={hero.payout_max} />
                      <StatusBadge status={hero.status} />
                    </div>
                    {ratingsById[hero.id]?.avg_overall != null && (
                      <div className="mt-2">
                        <StarRating
                          rating={ratingsById[hero.id]!.avg_overall!}
                          count={ratingsById[hero.id]!.human_ratings > 0
                            ? ratingsById[hero.id]!.human_ratings
                            : undefined}
                          size="sm"
                        />
                      </div>
                    )}
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
                  {featuredRest.map((job) => {
                    const rating = ratingsById[job.id];
                    return (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.slug}`}
                        className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                      >
                        <JobIcon name={job.name} iconUrl={job.icon_url} size={48} className="shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-fg">{job.name}</p>
                          <div className="mt-0.5">
                            <SeedsChip seeds={job.payout_max} className="text-xs" />
                          </div>
                          {rating?.avg_overall != null && rating.total_ratings > 0 && (
                            <span className="text-xs text-secondary font-medium tabular-nums">
                              ★ {rating.avg_overall.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* All offers — icon tile grid */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                All Offers
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                {rest.map((job) => {
                  const rating = ratingsById[job.id];
                  return (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.slug}`}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className="relative">
                        <JobIcon
                          name={job.name}
                          iconUrl={job.icon_url}
                          size={56}
                          className="group-hover:ring-2 ring-primary/50 transition-all"
                        />
                        {job.status !== "active" && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-bg" />
                        )}
                      </div>
                      <span className="text-xs text-center font-medium line-clamp-2 leading-tight text-fg w-full">
                        {job.name}
                      </span>
                      {rating?.avg_overall != null && rating.total_ratings > 0 ? (
                        <span className="text-xs text-secondary font-medium tabular-nums">
                          ★ {rating.avg_overall.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-transparent select-none">★ 0.0</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
