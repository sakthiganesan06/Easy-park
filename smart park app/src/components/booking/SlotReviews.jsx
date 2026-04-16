import { Star, MessageSquare, User } from 'lucide-react';

/**
 * StarDisplay — renders filled/empty stars for a given rating.
 */
export function StarDisplay({ rating, size = 14, className = '' }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          style={{
            width: size,
            height: size,
            color: star <= Math.round(rating) ? '#facc15' : '#334155',
            fill: star <= Math.round(rating) ? '#facc15' : 'none',
            filter: star <= Math.round(rating) ? 'drop-shadow(0 0 3px rgba(250,204,21,0.3))' : 'none',
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  );
}

/**
 * SlotReviews — scrollable review cards with average rating header.
 * Props:
 *   reviews:        Array<{ id, rating, comment, user_name, created_at }>
 *   averageRating:  number
 *   totalReviews:   number
 *   loading:        boolean
 */
export default function SlotReviews({ reviews = [], averageRating = 0, totalReviews = 0, loading = false }) {
  if (loading) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Reviews
        </h3>
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-white/20 border-t-electric-400 rounded-full animate-spin" />
          <span className="ml-2 text-sm text-white/40">Loading reviews…</span>
        </div>
      </div>
    );
  }

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <>
      <style>{`
        .reviews-scroll {
          max-height: 360px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .reviews-scroll::-webkit-scrollbar { width: 4px; }
        .reviews-scroll::-webkit-scrollbar-track { background: transparent; }
        .reviews-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1); border-radius: 4px;
        }

        .review-item {
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          animation: reviewIn 0.3s ease both;
        }
        .review-item:last-child { border-bottom: none; }

        @keyframes reviewIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .rating-summary-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .rating-bar-track {
          flex: 1; height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 3px; overflow: hidden;
        }
        .rating-bar-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, #facc15, #f59e0b);
          transition: width 0.5s ease;
        }
      `}</style>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
          Reviews & Ratings
        </h3>

        {totalReviews === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-sm text-white/30">No reviews yet</p>
            <p className="text-xs text-white/20 mt-1">Be the first to rate this parking spot!</p>
          </div>
        ) : (
          <>
            {/* Average summary */}
            <div className="flex items-center gap-4 mb-5 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
              {/* big number */}
              <div className="text-center">
                <p className="text-3xl font-bold text-white tabular-nums">{averageRating}</p>
                <StarDisplay rating={averageRating} size={12} className="mt-1" />
                <p className="text-[11px] text-white/35 mt-1">
                  {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                </p>
              </div>

              {/* breakdown bars */}
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter((r) => r.rating === star).length;
                  const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="rating-summary-bar">
                      <span className="text-[11px] text-white/40 w-3 text-right">{star}</span>
                      <Star
                        style={{
                          width: 10, height: 10,
                          color: '#facc15', fill: '#facc15',
                        }}
                      />
                      <div className="rating-bar-track">
                        <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-white/30 w-4">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable reviews list */}
            <div className="reviews-scroll">
              {reviews.map((review, idx) => (
                <div
                  key={review.id || idx}
                  className="review-item"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-electric-500/30 to-emerald-500/30 flex items-center justify-center shrink-0 border border-white/10">
                      <User className="w-3.5 h-3.5 text-white/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white/80 truncate">
                          {review.user_name || 'Anonymous'}
                        </p>
                        <span className="text-[11px] text-white/25 shrink-0">
                          {formatDate(review.created_at)}
                        </span>
                      </div>

                      <StarDisplay rating={review.rating} size={12} className="mt-1" />

                      {review.comment && (
                        <p className="text-[13px] text-white/50 mt-2 leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
