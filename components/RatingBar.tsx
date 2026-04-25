interface RatingBarProps {
  label: string;
  value: number | null;
  max?: number;
}

export function RatingBar({ label, value, max = 5 }: RatingBarProps) {
  if (value === null) return null;
  const pct = Math.round((value / max) * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-border rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums w-6 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}
