import type { JobStatus } from "@/lib/types";

const CONFIG: Record<JobStatus, { label: string; className: string }> = {
  active:           { label: "Active",          className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  partner_removed:  { label: "Offer Ended",     className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  blacklisted:      { label: "Not Recommended", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  seasonal:         { label: "Seasonal",        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  under_review:     { label: "Under Review",    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.under_review;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
