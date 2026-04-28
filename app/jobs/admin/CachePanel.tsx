"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "ok" | "error";

interface ButtonState {
  status: Status;
  message: string;
}

const IDLE: ButtonState = { status: "idle", message: "" };

function useRevalidate() {
  const fire = async (
    action: string,
    slug?: string
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch("/jobs/api/admin/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, slug }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.error ?? "Failed" };
      return { ok: true, message: `Done — ${(data.revalidated as string[]).join(", ")}` };
    } catch {
      return { ok: false, message: "Network error" };
    }
  };
  return fire;
}

// ── Single action button ──────────────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  description: string;
  action: string;
}

function ActionButton({ label, description, action }: ActionButtonProps) {
  const [state, setState] = useState<ButtonState>(IDLE);
  const fire = useRevalidate();

  const run = async () => {
    setState({ status: "loading", message: "" });
    const result = await fire(action);
    setState({ status: result.ok ? "ok" : "error", message: result.message });
    setTimeout(() => setState(IDLE), 4000);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">{label}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <button
          onClick={run}
          disabled={state.status === "loading"}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-fg hover:border-fg/30 disabled:opacity-40 transition-colors"
        >
          {state.status === "loading" ? "…" : "Bust"}
        </button>
      </div>
      {state.status !== "idle" && state.status !== "loading" && (
        <p className={`text-[10px] truncate ${state.status === "ok" ? "text-primary" : "text-red-500"}`}>
          {state.status === "ok" ? "✓ " : "✗ "}{state.message}
        </p>
      )}
    </div>
  );
}

// ── Job slug action ───────────────────────────────────────────────────────────

function JobRevalidateRow() {
  const [slug, setSlug] = useState("");
  const [state, setState] = useState<ButtonState>(IDLE);
  const fire = useRevalidate();

  const run = async () => {
    if (!slug.trim()) return;
    setState({ status: "loading", message: "" });
    const result = await fire("job", slug.trim());
    setState({ status: result.ok ? "ok" : "error", message: result.message });
    if (result.ok) setSlug("");
    setTimeout(() => setState(IDLE), 4000);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">Job Page</p>
        <p className="text-xs text-muted">Busts job page + ratings cache for a specific slug</p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="job-slug-here"
          className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-fg placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors font-mono"
        />
        <button
          onClick={run}
          disabled={!slug.trim() || state.status === "loading"}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-fg hover:border-fg/30 disabled:opacity-40 transition-colors"
        >
          {state.status === "loading" ? "…" : "Bust"}
        </button>
      </div>
      {state.status !== "idle" && state.status !== "loading" && (
        <p className={`text-[10px] truncate ${state.status === "ok" ? "text-primary" : "text-red-500"}`}>
          {state.status === "ok" ? "✓ " : "✗ "}{state.message}
        </p>
      )}
    </div>
  );
}

// ── CachePanel ────────────────────────────────────────────────────────────────

export function CachePanel() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Cache Revalidation</h2>
      <div className="space-y-4 divide-y divide-border">
        <ActionButton
          label="Jobs Listing"
          description="jobs-listing tag + /jobs path"
          action="listing"
        />
        <div className="pt-4">
          <ActionButton
            label="Featured Jobs"
            description="jobs-featured tag + /jobs path"
            action="featured"
          />
        </div>
        <div className="pt-4">
          <ActionButton
            label="All Ratings"
            description="ratings-all tag across all job pages"
            action="ratings"
          />
        </div>
        <div className="pt-4">
          <JobRevalidateRow />
        </div>
      </div>
    </div>
  );
}
