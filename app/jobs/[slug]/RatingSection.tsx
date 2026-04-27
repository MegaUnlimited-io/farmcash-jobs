"use client";

import { useState } from "react";
import { RatingForm } from "./RatingForm";

interface Props {
  jobId: string;
  userId: string | null;
}

const LOGIN_URL =
  "https://farmcash.app/login/?login=true&next=https://farmcash.app/jobs/auth/callback";

export function RatingSection({ jobId, userId }: Props) {
  const [open, setOpen] = useState(false);

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
      {/* Trigger — visually subordinate to the CTA button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-fg hover:border-primary/40 transition-colors"
        >
          ★ Rate this offer
        </button>
      )}

      {/* Expandable form — CSS grid trick animates height: 0 → auto */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-fg">Your Rating</span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-muted hover:text-fg transition-colors"
              >
                Cancel
              </button>
            </div>
            <RatingForm jobId={jobId} userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}
