interface StarRatingProps {
  rating: number | null;
  count?: number;
  size?: "sm" | "md" | "lg";
}

export function StarRating({ rating, count, size = "md" }: StarRatingProps) {
  if (rating === null) return null;

  const filled = Math.round(rating);
  const sizeClass = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div className={`flex items-center gap-1 ${sizeClass}`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={i <= filled ? "text-secondary" : "text-border"}
          >
            ★
          </span>
        ))}
      </span>
      <span className="text-muted font-medium tabular-nums">
        {rating.toFixed(1)}
      </span>
      {count !== undefined && (
        <span className="text-muted text-sm">({count.toLocaleString()})</span>
      )}
    </div>
  );
}
