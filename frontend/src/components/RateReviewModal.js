import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiStar, FiCamera } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api, { getImageUrl } from '../api/axiosConfig';

const MAX_REVIEW_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const FIT_OPTIONS = [
  { value: 'runs_small', label: 'Runs Small' },
  { value: 'true_to_size', label: 'True to Size' },
  { value: 'runs_large', label: 'Runs Large' },
];

const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
        className="text-3xl leading-none"
      >
        <FiStar className={n <= value ? 'text-brand fill-current' : 'text-gray-300'} />
      </button>
    ))}
  </div>
);

/**
 * Quick "Rate & Review" flow launched straight from the order history page,
 * the way Myntra/Flipkart/Amazon prompt customers to review a delivered
 * item without having to go find the product page themselves. Submits to
 * the same reviews endpoints the product page's review form already uses -
 * this is a second entry point, not a second review system.
 */
const RateReviewModal = ({ item, orderNumber, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [fit, setFit] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error('Please pick a star rating');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.createReview({
        product_id: item.product_id,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
        fit: fit || undefined,
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

      toast.success('Thanks for your review!');
      onSubmitted(item.product_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not submit your review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg text-ink">Rate &amp; Review</h2>
          <button onClick={onClose} aria-label="Close">
            <FiX size={20} className="text-muted" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <img
            src={getImageUrl(item.product_image) || 'https://via.placeholder.com/60'}
            alt={item.product_name || 'Product'}
            className="w-12 h-12 object-cover rounded"
          />
          <div className="text-sm">
            <p className="font-semibold text-ink">{item.product_name}</p>
            <p className="text-muted">Order {orderNumber}</p>
          </div>
        </div>

        <div className="mb-4 text-center">
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

        <p className="text-xs font-semibold text-muted mb-1.5">How did it fit? (optional)</p>
        <div className="flex gap-2 mb-4">
          {FIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFit(fit === opt.value ? null : opt.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                fit === opt.value
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-ink border-gray-300 hover:border-brand'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

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
          className="flex items-center gap-1.5 text-xs font-semibold text-brand mb-5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiCamera size={14} /> Add Photos ({photoFiles.length}/{MAX_REVIEW_PHOTOS})
        </button>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RateReviewModal;
