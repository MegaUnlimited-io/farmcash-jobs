"use client";

import { useState } from "react";

interface Props {
  jobId: string;
  userId: string | null;
}

const DIMENSIONS = [
  { key: "overall_rating" as const, label: "Overall", required: true },
  { key: "ad_aggression" as const, label: "Ads (fewer = better)", required: false },
  { key: "task_difficulty" as const, label: "Ease (easier = better)", required: false },
  { key: "payment_speed" as const, label: "Pay Speed", required: false },
];

type DimensionKey = (typeof DIMENSIONS)[number]["key"];

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

export function RatingForm({ jobId, userId }: Props) {
  const [ratings, setRatings] = useState<Record<DimensionKey, number | null>>({
    overall_rating: null,
    ad_aggression: null,
    task_difficulty: null,
    payment_speed: null,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!userId) {
    return (
      <p className="text-sm text-muted">
        <a
          href="https://farmcash.app/login/?login=true&next=https://farmcash.app/verify/?next=https://farmcash.app/jobs"
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratings.overall_rating) {
      setErrorMsg("Overall rating is required.");
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
      {DIMENSIONS.map(({ key, label, required }) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <span className="text-sm text-fg shrink-0">
            {label}
            {required && <span className="text-primary ml-0.5">*</span>}
          </span>
          <StarPicker
            value={ratings[key]}
            onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))}
          />
        </div>
      ))}

      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "loading" || !ratings.overall_rating}
        className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
      >
        {status === "loading" ? "Saving…" : "Submit Rating"}
      </button>
    </form>
  );
}
