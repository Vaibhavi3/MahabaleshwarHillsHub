import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api, { getReviewPhotoUrl } from '../api/axiosConfig';
import { requireAuth } from '../utils/requireAuth';
import { FiThumbsUp, FiCheckCircle, FiStar, FiCamera, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

const MAX_REVIEW_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

// Fullscreen viewer for a set of review photos, with prev/next - the same
// tap-to-zoom affordance customers already know from the product gallery.
const PhotoLightbox = ({ photoIds, startIndex, onClose }) => {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photoIds.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photoIds.length) % photoIds.length);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [photoIds.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-10" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
      >
        <FiX size={22} />
      </button>
      <img
        src={getReviewPhotoUrl(photoIds[index])}
        alt="Customer upload, full size"
        className="max-w-full max-h-full w-auto h-auto object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {photoIds.length > 1 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-xs font-semibold bg-white/10 px-3 py-1 rounded-full"
          onClick={(e) => e.stopPropagation()}
        >
          {index + 1} / {photoIds.length}
        </div>
      )}
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
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState(null);
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { photoIds, index }
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => photoPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [photoPreviews]);

  const handleFilesSelected = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    if (photoFiles.length + picked.length > MAX_REVIEW_PHOTOS) {
      toast.error(`You can attach up to ${MAX_REVIEW_PHOTOS} photos`);
      return;
    }
    for (const file of picked) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        toast.error('Photos must be JPEG, PNG, or WebP');
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error('Each photo must be under 5MB');
        return;
      }
    }
    setPhotoFiles((prev) => [...prev, ...picked]);
    setPhotoPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const removePhotoAt = (idx) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const myReview = useMemo(
    () => (user ? reviews.find((r) => r.user_id === user.id) : undefined),
    [reviews, user]
  );

  const avgRating = useMemo(
    () => (reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0),
    [reviews]
  );

  // Every review's real uploaded photos, flattened for the "Customer
  // Photos" strip - never placeholder or stock imagery.
  const allPhotos = useMemo(
    () => reviews.flatMap((r) => (r.photo_ids || []).map((photoId) => ({ reviewId: r.id, photoId }))),
    [reviews]
  );

  const visibleReviews = useMemo(
    () => (onlyWithPhotos ? reviews.filter((r) => (r.photo_ids || []).length > 0) : reviews),
    [reviews, onlyWithPhotos]
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
      let savedReview = response.data;

      if (photoFiles.length > 0) {
        try {
          const photoResponse = await api.uploadReviewPhotos(savedReview.id, photoFiles);
          savedReview = photoResponse.data;
        } catch (photoError) {
          toast.error(photoError.response?.data?.detail || 'Review saved, but photos could not be uploaded');
        }
      }

      setReviews([savedReview, ...reviews]);
      setRating(0);
      setTitle('');
      setComment('');
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPhotoFiles([]);
      setPhotoPreviews([]);
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

      {allPhotos.length > 0 && (
        <div className="mb-8">
          <p className="text-sm font-bold text-ink uppercase mb-3">Customer Photos ({allPhotos.length})</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {allPhotos.map((photo, i) => (
              <button
                key={photo.photoId}
                type="button"
                onClick={() =>
                  setLightbox({ photoIds: allPhotos.map((p) => p.photoId), index: i })
                }
                className="shrink-0 w-20 h-20 rounded overflow-hidden border border-gray-200"
              >
                <img
                  src={getReviewPhotoUrl(photo.photoId)}
                  alt="Customer upload"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
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

          {photoPreviews.length > 0 && (
            <div className="flex gap-2 mb-3">
              {photoPreviews.map((url, i) => (
                <div key={url} className="relative w-16 h-16 rounded overflow-hidden border border-gray-200">
                  <img src={url} alt={`Upload preview ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhotoAt(i)}
                    aria-label="Remove photo"
                    className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
                  >
                    <FiX size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoFiles.length >= MAX_REVIEW_PHOTOS}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiCamera size={14} /> Add Photos ({photoFiles.length}/{MAX_REVIEW_PHOTOS})
          </button>
          <div>
            <button type="submit" disabled={submitting} className="btn-primary px-6 py-2 text-sm disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        </form>
      )}

      {reviews.length > 0 && allPhotos.length > 0 && (
        <button
          type="button"
          onClick={() => setOnlyWithPhotos((v) => !v)}
          className={`filter-chip mb-4 ${onlyWithPhotos ? 'filter-chip-active' : 'filter-chip-inactive'}`}
        >
          <FiCamera size={13} className="inline mr-1.5 -mt-0.5" />
          With Photos
        </button>
      )}

      {visibleReviews.length > 0 ? (
        <div className="space-y-4">
          {visibleReviews.map((review) => (
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
              {(review.photo_ids || []).length > 0 && (
                <div className="flex gap-2 mb-3">
                  {review.photo_ids.map((photoId, i) => (
                    <button
                      key={photoId}
                      type="button"
                      onClick={() => setLightbox({ photoIds: review.photo_ids, index: i })}
                      className="w-16 h-16 rounded overflow-hidden border border-gray-200"
                    >
                      <img
                        src={getReviewPhotoUrl(photoId)}
                        alt="Customer upload"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
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
        <p className="text-muted text-sm">
          {onlyWithPhotos ? 'No photo reviews yet.' : 'No reviews yet - be the first to share your experience.'}
        </p>
      )}

      {lightbox && (
        <PhotoLightbox
          photoIds={lightbox.photoIds}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

export default ReviewsSection;
