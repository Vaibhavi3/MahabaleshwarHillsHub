import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Want to change the address or payment method',
  'Other',
];

/**
 * Confirmation modal for the self-service "Cancel Order" flow, styled
 * after Myntra/Nykaa/Ajio's cancel-before-shipped UX: pick a reason,
 * then confirm. Only rendered while an order is still pending/confirmed.
 */
const CancelOrderModal = ({ order, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await onConfirm(reason);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg text-ink">Cancel Order</h2>
          <button onClick={onClose} aria-label="Close">
            <FiX size={20} className="text-muted" />
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          Order <span className="font-semibold text-ink">{order.order_number}</span> hasn&rsquo;t shipped yet, so
          it can be cancelled. Help us improve by telling us why.
        </p>
        <div className="space-y-2 mb-6">
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="cancel-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-brand w-4 h-4"
              />
              <span className="text-ink">{r}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
            Keep Order
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason || submitting}
            className="flex-1 py-2.5 text-sm rounded font-bold uppercase tracking-wide bg-red-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Cancelling…' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;
