"use client";

import { useState } from "react";

interface Props {
  jobName: string;
  jobSlug: string;
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

// CTA button — shows a waitlist toast until deep link integration (Phase 3).
export function CTAButton({ jobName, jobSlug }: Props) {
  const [visible, setVisible] = useState(false);

  function handleClick() {
    // Push to GTM dataLayer — triggers "jobs_cta_click" custom event in GTM/GA4
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: "jobs_cta_click",
      job_name: jobName,
      job_slug: jobSlug,
    });

    if (visible) return;
    setVisible(true);
    setTimeout(() => setVisible(false), 4000);
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-primary hover:bg-primary-hover transition-colors"
      >
        Open in FarmCash App
      </button>

      {/* Toast */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm
          bg-fg text-bg text-sm font-medium rounded-2xl px-4 py-3 shadow-lg
          flex items-start gap-2 transition-all duration-300
          ${visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"}`}
      >
        <span className="shrink-0 mt-px">⚡</span>
        <span>
          FarmCash is coming soon! Sign up at{" "}
          <a
            href="https://farmcash.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            farmcash.app
          </a>{" "}
          to claim your early adopter seeds.
        </span>
      </div>
    </>
  );
}
