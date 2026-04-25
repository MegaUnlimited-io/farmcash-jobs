import type { JobRatingsSummary } from "@/lib/types";
import { StarRating } from "./StarRating";
import { RatingBar } from "./RatingBar";

interface RatingsSummaryProps {
  summary: JobRatingsSummary | null;
}

export function RatingsSummary({ summary }: RatingsSummaryProps) {
  if (!summary || summary.total_ratings === 0) {
    return (
      <p className="text-sm text-muted italic">No ratings yet — be the first!</p>
    );
  }

  return (
    <div className="space-y-4">
      <StarRating
        rating={summary.avg_overall}
        count={summary.human_ratings}
        size="lg"
      />
      <div className="space-y-2">
        <RatingBar label="Ease" value={summary.avg_task_difficulty} />
        <RatingBar label="Ads" value={summary.avg_ad_aggression} />
        <RatingBar label="Pay Speed" value={summary.avg_payment_speed} />
      </div>
    </div>
  );
}
