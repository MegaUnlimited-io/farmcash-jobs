"use client";

import { useState } from "react";
import { RatingForm } from "./RatingForm";

interface Props {
  jobId: string;
  userId: string | null;
  hasRated: boolean;
}

const LOGIN_URL =
  "https://farmcash.app/login/?login=true&next=https://farmcash.app/jobs/auth/callback";

export function RatingSection({ jobId, userId, hasRated }: Props) {
  const [open, setOpen] = useState(false);
  // Track whether the user submitted during this session
  const [submitted, setSubmitted] = useState(false);

  const alreadyRated = hasRated || submitted;

  if (!userId) {
    return (
      <p className="text-sm text-center text-muted py-1">
        <a href={LOGIN_URL} className="text-primary hover:underline">
          Sign in
        </a>{" "}
        to rate this offer.
      </p>
    );
  }

  return (
    <div>
      {/* Collapsed trigger */}
      {!open && (
        alreadyRated ? (
          // Post-rating: small unobtrusive link
          <button
            onClick={() => setOpen(true)}
            className="text-sm text-muted hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            Edit my rating
          </button>
        ) : (
          // Pre-rating: secondary CTA button — visible but subordinate to primary CTA
          <button onClick={() => setOpen(true)} className="btn-secondary">
            ★ Rate this offer
          </button>
        )
      )}

      {/* Expandable form — grid trick animates height 0 → auto */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-fg">
                {alreadyRated ? "Update your rating" : "Your rating"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-muted hover:text-fg transition-colors"
              >
                Cancel
              </button>
            </div>
            <RatingForm
              jobId={jobId}
              userId={userId}
              onSuccess={() => setSubmitted(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
