import React, { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import api, { getImageUrl } from '../api/axiosConfig';

const REASONS = [
  "Size doesn't fit",
  'Received damaged or defective item',
  'Item not as described',
  'Changed my mind',
  'Other',
];

/**
 * Self-service "Return or Exchange" request, styled after Myntra/Nykaa/
 * Ajio's post-delivery return flow on My Orders: pick return vs exchange,
 * a reason, and (for exchange) which colour/size to swap for. Only shown
 * for items still inside the 7-day return window already promised on the
 * homepage and product page trust badges.
 */
const ReturnRequestModal = ({ order, item, onClose, onSubmitted }) => {
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [requestType, setRequestType] = useState('return');
  const [reason, setReason] = useState('');
  const [exchangeProductId, setExchangeProductId] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getProductVariants(item.product_id)
      .then((response) => {
        if (active) setVariants(response.data.filter((v) => v.stock > 0));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingVariants(false);
      });
    return () => {
      active = false;
    };
  }, [item.product_id]);

  const variantLabel = (v) => [v.color, v.size].filter(Boolean).join(' / ') || v.name;

  const canSubmit = reason && (requestType === 'return' || (requestType === 'exchange' && exchangeProductId));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmitted({
        request_type: requestType,
        reason,
        comment: comment.trim() || undefined,
        exchange_product_id: requestType === 'exchange' ? Number(exchangeProductId) : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg text-ink">Return or Exchange</h2>
          <button onClick={onClose} aria-label="Close">
            <FiX size={20} className="text-muted" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <img
            src={getImageUrl(item.product_image) || 'https://via.placeholder.com/60'}
            alt={item.product_name || 'Product'}
            className="w-12 h-12 object-cover rounded"
          />
          <div className="text-sm">
            <p className="font-semibold text-ink">{item.product_name}</p>
            <p className="text-muted">Qty {item.quantity} &middot; Order {order.order_number}</p>
          </div>
        </div>

        <div className="mb-5">
          <h3 className="font-bold text-ink uppercase text-xs mb-2 tracking-wide">What would you like?</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setRequestType('return')}
              className={`flex-1 py-2 rounded text-sm font-semibold border ${
                requestType === 'return' ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-ink'
              }`}
            >
              Return for refund
            </button>
            <button
              onClick={() => setRequestType('exchange')}
              disabled={!loadingVariants && variants.length === 0}
              className={`flex-1 py-2 rounded text-sm font-semibold border disabled:opacity-40 disabled:cursor-not-allowed ${
                requestType === 'exchange' ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-ink'
              }`}
            >
              Exchange
            </button>
          </div>
          {!loadingVariants && variants.length === 0 && (
            <p className="text-xs text-muted mt-1">No other colour/size is currently in stock to exchange for.</p>
          )}
        </div>

        {requestType === 'exchange' && (
          <div className="mb-5">
            <h3 className="font-bold text-ink uppercase text-xs mb-2 tracking-wide">Exchange for</h3>
            <select
              value={exchangeProductId}
              onChange={(e) => setExchangeProductId(e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
            >
              <option value="">Select a colour / size</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {variantLabel(v)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-5">
          <h3 className="font-bold text-ink uppercase text-xs mb-2 tracking-wide">Reason</h3>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="return-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-brand w-4 h-4"
                />
                <span className="text-ink">{r}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add any details that'll help us (optional)"
            rows={2}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnRequestModal;
