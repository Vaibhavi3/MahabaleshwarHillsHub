import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axiosConfig';
import { requireAuth } from '../utils/requireAuth';
import { FiThumbsUp, FiCheckCircle, FiStar } from 'react-icons/fi';
import toast from 'react-hot-toast';

const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
        className="text-2xl leading-none"
      >
        <FiStar
          className={n <= value ? 'text-brand fill-current' : 'text-gray-300'}
        />
      </button>
    ))}
  </div>
);

// Real counts derived from the reviews this page already has - never a
// fabricated or separately-fetched breakdown.
const RatingBreakdown = ({ reviews }) => {
  const total = reviews.length;
  const counts = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => r.rating === star).length);

  return (
    <div className="max-w-md space-y-1.5 mb-8">
      {[5, 4, 3, 2, 1].map((star, i) => {
        const count = counts[i];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-3 text-sm">
            <span className="w-10 text-ink font-semibold shrink-0">{star} ★</span>
            <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

const ReviewsSection = ({ productId, reviews, setReviews }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useSelector((state) => state.auth);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState(null);

  const myReview = useMemo(
    () => (user ? reviews.find((r) => r.user_id === user.id) : undefined),
    [reviews, user]
  );

  const avgRating = useMemo(
    () => (reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0),
    [reviews]
  );

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!requireAuth(token, navigate, location, 'Please login to write a review')) return;
    if (rating < 1) {
      toast.error('Please pick a star rating');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.createReview({
        product_id: Number(productId),
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      setReviews([response.data, ...reviews]);
      setRating(0);
      setTitle('');
      setComment('');
      toast.success('Thanks for your review!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not submit your review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (review) => {
    if (!requireAuth(token, navigate, location, 'Please login to mark a review as helpful')) return;
    setVotingId(review.id);
    try {
      const response = await api.voteReviewHelpful(review.id);
      setReviews(
        reviews.map((r) =>
          r.id === review.id
            ? { ...r, helpful_count: response.data.helpful_count, voted_helpful: response.data.voted_helpful }
            : r
        )
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Something went wrong, please try again');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="mt-16 border-t border-gray-200 pt-8">
      <h2 className="text-xl font-extrabold text-ink mb-6">Ratings &amp; Reviews</h2>

      {reviews.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-start gap-8 mb-8">
          <div className="text-center shrink-0">
            <p className="text-4xl font-extrabold text-ink">{avgRating.toFixed(1)}</p>
            <p className="text-brand text-lg leading-none">★★★★★</p>
            <p className="text-xs text-muted mt-1">{reviews.length} rating{reviews.length !== 1 ? 's' : ''}</p>
          </div>
          <RatingBreakdown reviews={reviews} />
        </div>
      )}

      {!myReview && (
        <form onSubmit={handleSubmitReview} className="border border-gray-200 rounded p-4 mb-8 max-w-xl">
          <p className="text-sm font-bold text-ink uppercase mb-3">Write a Review</p>
          <div className="mb-3">
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your review a title (optional)"
            maxLength={100}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full mb-3"
          />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this product (optional)"
            rows={3}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full mb-3"
          />
          <button type="submit" disabled={submitting} className="btn-primary px-6 py-2 text-sm disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>
      )}

      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border border-gray-200 rounded p-4">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {review.rating} ★
                  </span>
                  {review.title && <span className="text-sm font-semibold text-ink">{review.title}</span>}
                  {review.verified_purchase && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <FiCheckCircle size={12} /> Verified Purchase
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted">{review.reviewer_name}</span>
              </div>
              {review.comment && <p className="text-gray-700 text-sm mb-3">{review.comment}</p>}
              {user?.id !== review.user_id && (
                <button
                  onClick={() => handleHelpful(review)}
                  disabled={votingId === review.id}
                  className={`flex items-center gap-1.5 text-xs font-semibold disabled:opacity-60 ${
                    review.voted_helpful ? 'text-brand' : 'text-muted hover:text-ink'
                  }`}
                >
                  <FiThumbsUp className={review.voted_helpful ? 'fill-current' : ''} size={13} />
                  Helpful{review.helpful_count > 0 ? ` (${review.helpful_count})` : ''}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm">No reviews yet - be the first to share your experience.</p>
      )}
    </div>
  );
};

export default ReviewsSection;
