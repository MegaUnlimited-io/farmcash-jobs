"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import type { FeaturedEntry, JobSearchResult } from "@/lib/db/admin";

const MAX_SLOTS = 7;

// ── Shared job identity card ─────────────────────────────────────────────────

interface JobAdminCardProps {
  id: string;
  name: string;
  iconUrl: string | null;
}

function JobAdminCard({ id, name, iconUrl }: JobAdminCardProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt=""
          width={32}
          height={32}
          className="rounded-lg shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-border shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-sm text-fg font-medium truncate leading-tight">{name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-muted font-mono tracking-wide">
            …{id.slice(-6)}
          </span>
          <button
            onClick={copy}
            title="Copy full UUID"
            className="flex items-center justify-center w-4 h-4 rounded text-muted hover:text-fg transition-colors"
            aria-label="Copy job ID"
          >
            {copied ? (
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-primary" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="4" width="6.5" height="7" rx="1" />
                <path d="M2.5 8H2a.5.5 0 0 1-.5-.5V1.5A.5.5 0 0 1 2 1h6a.5.5 0 0 1 .5.5V2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FeaturedManager ───────────────────────────────────────────────────────────

interface Props {
  initialList: FeaturedEntry[];
}

export function FeaturedManager({ initialList }: Props) {
  const [featured, setFeatured] = useState<FeaturedEntry[]>(initialList);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const featuredIds = new Set(featured.map((f) => f.job_id));

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/jobs/api/admin/jobs/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    search(v);
  };

  const add = async (job: JobSearchResult) => {
    if (featured.length >= MAX_SLOTS) return;
    setBusy(job.id);
    setError(null);
    try {
      const res = await fetch("/jobs/api/admin/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add"); return; }
      const nextOrder = (featured[featured.length - 1]?.display_order ?? 0) + 1;
      setFeatured((prev) => [
        ...prev,
        { job_id: job.id, display_order: nextOrder, job_name: job.name, job_slug: job.slug, job_icon_url: job.icon_url },
      ]);
      setQuery("");
      setResults([]);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (jobId: string) => {
    setBusy(jobId);
    setError(null);
    try {
      const res = await fetch("/jobs/api/admin/featured", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) { setError("Failed to remove"); return; }
      setFeatured((prev) => {
        const next = prev.filter((f) => f.job_id !== jobId);
        return next.map((f, i) => ({ ...f, display_order: i + 1 }));
      });
    } finally {
      setBusy(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= featured.length) return;
    const next = [...featured];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    const reordered = next.map((f, i) => ({ ...f, display_order: i + 1 }));
    setFeatured(reordered);
    setBusy("reorder");
    setError(null);
    try {
      const res = await fetch("/jobs/api/admin/featured", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedJobIds: reordered.map((f) => f.job_id) }),
      });
      if (!res.ok) setError("Failed to save order");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Featured Jobs</h2>
        <span className={`text-xs font-medium ${featured.length >= MAX_SLOTS ? "text-yellow-500" : "text-muted"}`}>
          {featured.length}/{MAX_SLOTS} slots
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Current featured list */}
      {featured.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted border border-dashed border-border rounded-xl">
          No featured jobs — use the search below to add some.
        </div>
      ) : (
        <div className="space-y-2">
          {featured.map((entry, index) => (
            <div
              key={entry.job_id}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
            >
              <div className="w-16 shrink-0 flex flex-col items-end gap-0.5">
                <span className="text-xs text-muted">{index + 1}</span>
                {index === 0 && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-primary leading-none">
                    Top Pick
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <JobAdminCard
                  id={entry.job_id}
                  name={entry.job_name}
                  iconUrl={entry.job_icon_url}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || busy !== null}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-border disabled:opacity-30 transition-colors text-xs"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === featured.length - 1 || busy !== null}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-border disabled:opacity-30 transition-colors text-xs"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => remove(entry.job_id)}
                  disabled={busy === entry.job_id}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30 transition-colors text-xs"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search to add */}
      {featured.length < MAX_SLOTS && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search jobs by name…"
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">…</span>
            )}
          </div>

          {results.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {results.map((job) => {
                const alreadyFeatured = featuredIds.has(job.id);
                return (
                  <div key={job.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <JobAdminCard id={job.id} name={job.name} iconUrl={job.icon_url} />
                    </div>
                    <span className="text-xs text-muted shrink-0">{job.status}</span>
                    <button
                      onClick={() => add(job)}
                      disabled={alreadyFeatured || busy !== null}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {alreadyFeatured ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
