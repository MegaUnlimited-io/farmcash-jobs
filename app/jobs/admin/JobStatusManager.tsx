"use client";

import { useState, useCallback, useRef } from "react";
import { JobAdminCard } from "./JobAdminCard";
import type { JobSearchResult } from "@/lib/db/admin";
import type { JobStatus } from "@/lib/types";

const STATUSES: { value: JobStatus; label: string; color: string }[] = [
  { value: "active",          label: "Active",          color: "text-green-500" },
  { value: "partner_removed", label: "Partner Removed", color: "text-yellow-500" },
  { value: "blacklisted",     label: "Blacklisted",     color: "text-red-500" },
  { value: "seasonal",        label: "Seasonal",        color: "text-blue-400" },
  { value: "under_review",    label: "Under Review",    color: "text-muted" },
];

function statusColor(status: JobStatus): string {
  return STATUSES.find((s) => s.value === status)?.color ?? "text-muted";
}

function formatEnrichedDate(iso: string | null): string {
  if (!iso) return "Not enriched";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface JobRow extends JobSearchResult {
  saving?: boolean;
  saved?: boolean;
  saveError?: string;
}

export function JobStatusManager() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<JobRow[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setRows([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/jobs/api/admin/jobs/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
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

  const changeStatus = async (jobId: string, status: JobStatus) => {
    setRows((prev) =>
      prev.map((r) => r.id === jobId ? { ...r, saving: true, saved: false, saveError: undefined } : r)
    );

    const res = await fetch("/jobs/api/admin/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });
    const data = await res.json();

    setRows((prev) =>
      prev.map((r) =>
        r.id === jobId
          ? { ...r, saving: false, status: res.ok ? status : r.status, saved: res.ok, saveError: res.ok ? undefined : (data.error ?? "Failed") }
          : r
      )
    );

    if (res.ok) setTimeout(() => setRows((prev) => prev.map((r) => r.id === jobId ? { ...r, saved: false } : r)), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Job Status</h2>
      </div>

      {/* Search */}
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

      {/* Results */}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
            >
              <div className="flex-1 min-w-0">
                <JobAdminCard id={job.id} name={job.name} iconUrl={job.icon_url} slug={job.slug} appPackageId={job.app_package_id} />
              </div>

              <span className="text-[10px] text-muted shrink-0 hidden sm:block">
                {formatEnrichedDate(job.enriched_at)}
              </span>

              {/* Status indicator */}
              <div className="flex items-center gap-2 shrink-0">
                {job.saving && (
                  <span className="text-xs text-muted">…</span>
                )}
                {job.saved && !job.saving && (
                  <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5 text-primary shrink-0" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {job.saveError && (
                  <span className="text-xs text-red-500 shrink-0">{job.saveError}</span>
                )}

                <select
                  value={job.status}
                  onChange={(e) => changeStatus(job.id, e.target.value as JobStatus)}
                  disabled={job.saving}
                  className={`text-xs font-medium rounded-lg border border-border bg-card px-2 py-1.5 focus:outline-none focus:border-primary/50 disabled:opacity-50 transition-colors cursor-pointer ${statusColor(job.status)}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && query.length >= 2 && !searching && (
        <p className="text-center text-sm text-muted py-6">No jobs found.</p>
      )}
    </div>
  );
}
