import { useState } from 'react';
import { Star, X, Send, MessageSquare } from 'lucide-react';

/**
 * RatingModal — beautiful animated 5-star rating + optional comment.
 * Props:
 *   visible:    boolean
 *   onSubmit:   (rating: number, comment: string) => void
 *   onSkip:     () => void
 *   slotName:   string (for display)
 *   loading:    boolean
 */
export default function RatingModal({ visible, onSubmit, onSkip, slotName = '', loading = false }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');

  if (!visible) return null;

  const labels = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];

  return (
    <>
      <style>{`
        .rating-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: ratingFadeIn 0.3s ease;
        }
        @keyframes ratingFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .rating-card {
          width: 100%; max-width: 400px;
          background: linear-gradient(165deg, #1e293b 0%, #0f172a 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 32px 24px 24px;
          position: relative;
          overflow: hidden;
          animation: ratingSlideUp 0.4s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes ratingSlideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* decorative glow */
        .rating-card::before {
          content: '';
          position: absolute;
          top: -60px; left: 50%; transform: translateX(-50%);
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(250,204,21,0.15), transparent 70%);
          pointer-events: none;
        }

        .rating-close {
          position: absolute; top: 16px; right: 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          color: #64748b; cursor: pointer;
          transition: all 0.2s;
        }
        .rating-close:hover { color: #94a3b8; background: rgba(255,255,255,0.1); }

        .rating-emoji {
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(250,204,21,0.12);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px; font-size: 28px;
          border: 1px solid rgba(250,204,21,0.15);
        }

        .rating-title {
          text-align: center; font-size: 20px; font-weight: 700;
          color: #f1f5f9; margin-bottom: 4px;
        }
        .rating-subtitle {
          text-align: center; font-size: 13px; color: #475569;
          margin-bottom: 20px;
        }
        .rating-slot-name {
          color: #60a5fa; font-weight: 600;
        }

        /* stars container */
        .rating-stars {
          display: flex; gap: 8px; justify-content: center;
          margin-bottom: 8px;
        }
        .rating-star-btn {
          background: none; border: none; cursor: pointer;
          padding: 4px; transition: transform 0.15s;
        }
        .rating-star-btn:hover { transform: scale(1.15); }
        .rating-star-btn:active { transform: scale(0.95); }

        .rating-star-btn svg {
          width: 36px; height: 36px;
          transition: all 0.2s;
          filter: drop-shadow(0 0 0px transparent);
        }
        .rating-star-btn.filled svg {
          color: #facc15;
          fill: #facc15;
          filter: drop-shadow(0 0 6px rgba(250,204,21,0.4));
        }
        .rating-star-btn.empty svg {
          color: #334155;
          fill: none;
        }

        .rating-label {
          text-align: center; font-size: 13px; font-weight: 600;
          color: #facc15; min-height: 20px; margin-bottom: 16px;
          transition: all 0.2s;
        }

        /* comment textarea */
        .rating-comment-wrap {
          position: relative; margin-bottom: 16px;
        }
        .rating-comment-icon {
          position: absolute; top: 14px; left: 14px;
          color: #475569; width: 16px; height: 16px;
          pointer-events: none;
        }
        .rating-comment {
          width: 100%;
          min-height: 80px; max-height: 140px; resize: vertical;
          padding: 12px 14px 12px 40px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          color: #f1f5f9; font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .rating-comment::placeholder { color: #334155; }
        .rating-comment:focus {
          border-color: #facc15;
          box-shadow: 0 0 0 3px rgba(250,204,21,0.08);
        }

        /* submit button */
        .rating-submit {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #facc15, #eab308);
          border: none; border-radius: 14px;
          color: #0f172a; font-size: 15px; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(250,204,21,0.25);
        }
        .rating-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(250,204,21,0.35); }
        .rating-submit:active { transform: translateY(0); }
        .rating-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .rating-skip {
          display: block; margin: 12px auto 0;
          background: none; border: none;
          color: #475569; font-size: 13px;
          cursor: pointer; transition: color 0.2s;
        }
        .rating-skip:hover { color: #94a3b8; }

        /* spinner */
        .rating-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(15,23,42,0.3);
          border-top-color: #0f172a;
          border-radius: 50%;
          animation: rspin 0.7s linear infinite;
        }
        @keyframes rspin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="rating-overlay" onClick={(e) => e.target === e.currentTarget && onSkip?.()}>
        <div className="rating-card">
          <button className="rating-close" onClick={onSkip}>
            <X size={16} />
          </button>

          <div className="rating-emoji">⭐</div>
          <p className="rating-title">How was your experience?</p>
          <p className="rating-subtitle">
            Rate your parking at{' '}
            <span className="rating-slot-name">{slotName || 'this slot'}</span>
          </p>

          {/* Stars */}
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`rating-star-btn ${(hover || rating) >= star ? 'filled' : 'empty'}`}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
              >
                <Star />
              </button>
            ))}
          </div>
          <p className="rating-label">{labels[hover || rating] || '\u00A0'}</p>

          {/* Comment */}
          <div className="rating-comment-wrap">
            <MessageSquare className="rating-comment-icon" />
            <textarea
              className="rating-comment"
              placeholder="Share your experience (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Submit */}
          <button
            className="rating-submit"
            disabled={rating === 0 || loading}
            onClick={() => onSubmit?.(rating, comment)}
          >
            {loading ? (
              <div className="rating-spinner" />
            ) : (
              <>
                Submit Rating
                <Send size={16} />
              </>
            )}
          </button>

          <button className="rating-skip" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </>
  );
}
