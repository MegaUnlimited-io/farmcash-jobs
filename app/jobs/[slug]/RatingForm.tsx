"use client";

import { useState, useMemo } from "react";

interface Props {
  jobId: string;
  userId: string | null;
}

const DIMENSIONS = [
  { key: "ad_aggression" as const,  label: "Ad Aggression",  hint: "1 = very aggressive · 5 = no ads"    },
  { key: "task_difficulty" as const, label: "Task Difficulty", hint: "1 = grind · 5 = easy money"          },
  { key: "payment_speed" as const,  label: "Payment Speed",  hint: "1 = long delays · 5 = instant"        },
];

type DimensionKey = (typeof DIMENSIONS)[number]["key"];
type Dimension = (typeof DIMENSIONS)[number];

// ─── Partial star display ────────────────────────────────────────────────────
// Two overlapping rows of ★ characters. The foreground row is clipped to
// `(value / 5) * 100%` width so it fills exactly the right fraction.
// CSS transition on width gives a spring-like animation as the value changes.

function OverallStars({ value }: { value: number | null }) {
  const pct = value !== null ? (value / 5) * 100 : 0;

  return (
    <div className="relative inline-flex select-none" aria-hidden>
      {/* Background: empty stars */}
      <span className="text-2xl leading-none tracking-tight text-border">
        ★★★★★
      </span>
      {/* Foreground: filled stars, clipped to pct% */}
      <span
        className="absolute inset-0 overflow-hidden text-2xl leading-none tracking-tight text-[var(--color-secondary)] whitespace-nowrap"
        style={{
          width: `${pct}%`,
          transition: "width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        ★★★★★
      </span>
    </div>
  );
}

// ─── Input star picker ────────────────────────────────────────────────────────

function StarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="w-8 h-8 flex items-center justify-center text-xl leading-none touch-manipulation"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(star)}
          aria-label={`${star} star`}
        >
          <span
            className={
              active >= star
                ? "text-[var(--color-secondary)]"
                : "text-border"
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function RatingForm({ jobId, userId }: Props) {
  const [ratings, setRatings] = useState<Record<DimensionKey, number | null>>({
    ad_aggression: null,
    task_difficulty: null,
    payment_speed: null,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Live overall preview — mirrors the DB trigger formula (avg of rated dims)
  const overallValue = useMemo(() => {
    const vals = [ratings.ad_aggression, ratings.task_difficulty, ratings.payment_speed]
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [ratings]);

  if (!userId) {
    return (
      <p className="text-sm text-muted">
        <a
          href="https://farmcash.app/login/?login=true&next=https://farmcash.app/jobs/auth/callback"
          className="text-primary hover:underline"
        >
          Sign in
        </a>{" "}
        to rate this offer.
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="text-sm text-muted">
        Rating saved! The summary above may take a moment to update.
      </p>
    );
  }

  const hasAnyRating = Object.values(ratings).some((v) => v !== null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAnyRating) {
      setErrorMsg("Please rate at least one dimension.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/jobs/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, ...ratings }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Something went wrong");
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Sub-dimension pickers */}
      {DIMENSIONS.map(({ key, label, hint }: Dimension) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <span className="text-sm text-fg">{label}</span>
            <p className="text-xs text-muted">{hint}</p>
          </div>
          <StarPicker
            value={ratings[key]}
            onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))}
          />
        </div>
      ))}

      {/* Overall preview — calculated, not editable */}
      <div className="border-t border-border pt-3 mt-1">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-fg">Overall</span>
            <span className="text-xs text-muted ml-1.5">calculated</span>
          </div>
          <div className="flex items-center gap-2">
            <OverallStars value={overallValue} />
            <span
              className={`text-sm font-bold tabular-nums w-8 text-right transition-colors duration-300 ${
                overallValue !== null ? "text-[var(--color-secondary)]" : "text-border"
              }`}
            >
              {overallValue !== null ? overallValue.toFixed(1) : "—"}
            </span>
          </div>
        </div>
      </div>

      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "loading" || !hasAnyRating}
        className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
      >
        {status === "loading" ? "Saving…" : "Submit Rating"}
      </button>
    </form>
  );
}
