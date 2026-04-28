"use client";

import { useState, useCallback, useRef } from "react";
import { JobAdminCard } from "./JobAdminCard";
import type { JobSearchResult } from "@/lib/db/admin";

type OverrideKey = "name" | "description" | "icon_url";

const FIELDS: { key: OverrideKey; label: string; multiline?: boolean }[] = [
  { key: "name",        label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "icon_url",    label: "Icon URL" },
];

interface OverrideFormProps {
  job: JobSearchResult;
  onSaved: (jobId: string, overrides: Record<string, string>) => void;
}

function OverrideForm({ job, onSaved }: OverrideFormProps) {
  const [values, setValues] = useState<Record<OverrideKey, string>>({
    name:        job.manual_overrides?.name        ?? "",
    description: job.manual_overrides?.description ?? "",
    icon_url:    job.manual_overrides?.icon_url    ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedKeys = new Set(Object.keys(job.manual_overrides ?? {}));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/jobs/api/admin/jobs/overrides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, overrides: values }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }

      // Derive new locked keys from saved values
      const nextOverrides: Record<string, string> = {};
      for (const key of Object.keys(values) as OverrideKey[]) {
        if (values[key].trim()) nextOverrides[key] = values[key].trim();
      }
      onSaved(job.id, nextOverrides);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-3 bg-bg border border-border rounded-xl space-y-3">
      {error && (
        <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-1.5">{error}</p>
      )}

      {FIELDS.map(({ key, label, multiline }) => {
        const isLocked = lockedKeys.has(key);
        const liveValue = key === "name" ? job.name : key === "icon_url" ? job.icon_url : job.description;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted">{label}</label>
              {isLocked ? (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-yellow-500 bg-yellow-500/10 rounded px-1 py-0.5">
                  Locked
                </span>
              ) : (
                <span className="text-[9px] uppercase tracking-wide text-muted/60">Sync managed</span>
              )}
            </div>
            {liveValue && !isLocked && (
              <p className="text-[10px] text-muted/70 italic truncate">
                Current: {liveValue}
              </p>
            )}
            {multiline ? (
              <textarea
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={`Override ${label.toLowerCase()}… (empty = let sync manage)`}
                rows={3}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            ) : (
              <input
                type="text"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={`Override ${label.toLowerCase()}… (empty = let sync manage)`}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
              />
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted/60">Empty fields revert to sync-managed values on save.</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving…" : saved ? (
            <>
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Saved
            </>
          ) : "Save Overrides"}
        </button>
      </div>
    </div>
  );
}

// ── ManualOverrideEditor ──────────────────────────────────────────────────────

export function ManualOverrideEditor() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setExpandedId(null); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/jobs/api/admin/jobs/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setExpandedId(null);
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

  const handleSaved = (jobId: string, overrides: Record<string, string>) => {
    setResults((prev) =>
      prev.map((r) => r.id === jobId ? { ...r, manual_overrides: overrides } : r)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Manual Overrides</h2>
      </div>

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
        <div className="space-y-2">
          {results.map((job) => {
            const isExpanded = expandedId === job.id;
            const lockedCount = Object.keys(job.manual_overrides ?? {}).length;
            return (
              <div key={job.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-border/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <JobAdminCard id={job.id} name={job.name} iconUrl={job.icon_url} slug={job.slug} appPackageId={job.app_package_id} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lockedCount > 0 && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-yellow-500 bg-yellow-500/10 rounded px-1.5 py-0.5">
                        {lockedCount} locked
                      </span>
                    )}
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      className={`w-3 h-3 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <OverrideForm job={job} onSaved={handleSaved} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && query.length >= 2 && !searching && (
        <p className="text-center text-sm text-muted py-6">No jobs found.</p>
      )}
    </div>
  );
}
