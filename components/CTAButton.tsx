"use client";

// CTA button — disabled placeholder until deep link integration (Phase 3).
// Do NOT add href, App Store link, or AyeT tracking link here.
export function CTAButton() {
  return (
    <button
      disabled
      className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-primary opacity-60 cursor-not-allowed select-none"
    >
      Open in FarmCash App
    </button>
  );
}
