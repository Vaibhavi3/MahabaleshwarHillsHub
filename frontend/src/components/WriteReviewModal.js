import React, { useState } from 'react';
import { FiStar, FiX } from 'react-icons/fi';

const WriteReviewModal = ({ initialReview, onClose, onSubmit }) => {
  const [rating, setRating] = useState(initialReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(initialReview?.title || '');
  const [comment, setComment] = useState(initialReview?.comment || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) return;
    setSubmitting(true);
    try {
      await onSubmit({ rating, title: title.trim(), comment: comment.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:m-auto bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md sm:h-fit p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-extrabold text-lg text-ink">
            {initialReview ? 'Edit Your Review' : 'Write a Review'}
          </h2>
          <button onClick={onClose} aria-label="Close">
            <FiX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p className="text-sm font-bold text-ink uppercase mb-2">Your Rating</p>
          <div className="flex gap-1 mb-5" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                className="p-0.5"
              >
                <FiStar
                  size={28}
                  className={
                    star <= (hoverRating || rating)
                      ? 'text-brand fill-current'
                      : 'text-gray-300'
                  }
                />
              </button>
            ))}
          </div>

          <label className="block text-sm font-bold text-ink uppercase mb-2">
            Review Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Sum up your experience"
              className="mt-2 w-full border border-gray-300 rounded px-3 py-2 text-sm font-normal normal-case"
            />
          </label>

          <label className="block text-sm font-bold text-ink uppercase mb-2 mt-4">
            Your Review
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="What did you like or dislike? How did you use this product?"
              className="mt-2 w-full border border-gray-300 rounded px-3 py-2 text-sm font-normal normal-case"
            />
          </label>

          <button
            type="submit"
            disabled={rating < 1 || submitting}
            className="btn-primary w-full mt-6 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : initialReview ? 'Update Review' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WriteReviewModal;
