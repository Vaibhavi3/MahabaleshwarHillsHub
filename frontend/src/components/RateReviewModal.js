import React, { useEffect, useRef, useState } from 'react';
import api, { getImageUrl } from '../api/axiosConfig';
import { FiStar, FiX, FiCamera } from 'react-icons/fi';
import toast from 'react-hot-toast';

const MAX_REVIEW_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const FIT_OPTIONS = [
  { value: 'runs_small', label: 'Runs Small' },
  { value: 'true_to_size', label: 'True to Size' },
  { value: 'runs_large', label: 'Runs Large' },
];

// "Rate & Review" launched directly from a delivered order item, inspired
// by Myntra/Nykaa/Ajio prompting reviews right on Your Orders instead of
// only from the product page. Submits through the same /reviews +
// /reviews/{id}/photos endpoints the product-page review form uses.
const RateReviewModal = ({ item, onClose, onSubmitted }) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      const savedReview = response.data;

      if (photoFiles.length > 0) {
        try {
          await api.uploadReviewPhotos(savedReview.id, photoFiles);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg text-ink">Rate &amp; Review</h2>
          <button onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          {item.product_image && (
            <img src={getImageUrl(item.product_image)} alt={item.product_name} className="w-12 h-12 object-cover rounded border border-gray-200" />
          )}
          <p className="text-sm font-semibold text-ink">{item.product_name}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className="text-2xl leading-none"
              >
                <FiStar className={n <= rating ? 'text-brand fill-current' : 'text-gray-300'} />
              </button>
            ))}
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
          <div className="flex gap-2 mb-3">
            {FIT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFit(fit === opt.value ? null : opt.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  fit === opt.value ? 'bg-brand text-white border-brand' : 'bg-white text-ink border-gray-300 hover:border-brand'
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
            className="flex items-center gap-1.5 text-xs font-semibold text-brand mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiCamera size={14} /> Add Photos ({photoFiles.length}/{MAX_REVIEW_PHOTOS})
          </button>

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RateReviewModal;
