interface SeedsChipProps {
  seeds: number | null;
  className?: string;
}

// Inline seed icon using SVG leaf to avoid image dependency
export function SeedsChip({ seeds, className = "" }: SeedsChipProps) {
  if (!seeds) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-secondary font-semibold ${className}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10 2C6 2 3 6 3 10c0 3.5 2.5 6.5 5.5 7.5V15c-2-.5-3.5-2.5-3.5-5 0-2 1-4 2.5-5C8 6 9 7 9 8v4.5c0 .3.2.5.5.5S10 12.8 10 12.5V8c0-1 1-2 1.5-3 1.5 1 2.5 3 2.5 5 0 2.5-1.5 4.5-3.5 5v2.5C13.5 16.5 16 13.5 16 10c0-4-3-8-6-8z"/>
      </svg>
      {seeds.toLocaleString()}
    </span>
  );
}
