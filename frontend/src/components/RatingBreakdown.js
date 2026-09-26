import React from 'react';
import { FiStar } from 'react-icons/fi';

/**
 * 5-star -> 1-star distribution bars, the same "ratings distribution
 * summary" pattern Myntra/Nykaa/Ajio show under a product's overall
 * rating - built from the reviews already loaded on the page, no extra
 * request.
 */
const RatingBreakdown = ({ reviews }) => {
  const total = reviews.length;
  if (total === 0) return null;

  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="space-y-1.5 max-w-xs">
      {counts.map(({ star, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs text-muted">
            <span className="flex items-center gap-0.5 w-8 shrink-0 font-semibold text-ink">
              {star}
              <FiStar size={11} className="fill-current" />
            </span>
            <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

export default RatingBreakdown;
