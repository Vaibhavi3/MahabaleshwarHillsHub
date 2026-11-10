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
  const [refundMethod, setRefundMethod] = useState('original');
  const [submitting, setSubmitting] = useState(false);
  const wasPaid = order.payment_status === 'completed';

  const handleConfirm = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await onConfirm(reason, wasPaid ? refundMethod : 'original');
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
        {wasPaid && (
          <div className="mb-4">
            <p className="text-xs font-bold text-ink uppercase tracking-wide mb-2">
              How should we refund your ₹{order.total_amount.toFixed(2)}?
            </p>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2 ${
                  refundMethod === 'original' ? 'border-brand bg-brand/5' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="refund-method"
                  value="original"
                  checked={refundMethod === 'original'}
                  onChange={() => setRefundMethod('original')}
                  className="accent-brand w-4 h-4 mt-0.5"
                />
                <span>
                  <span className="font-semibold text-ink">Original payment method</span>
                  <span className="block text-xs text-muted">
                    Refunded automatically - can take a few days to reflect in your bank/card statement.
                  </span>
                </span>
              </label>
              <label
                className={`flex items-start gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2 ${
                  refundMethod === 'wallet' ? 'border-brand bg-brand/5' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="refund-method"
                  value="wallet"
                  checked={refundMethod === 'wallet'}
                  onChange={() => setRefundMethod('wallet')}
                  className="accent-brand w-4 h-4 mt-0.5"
                />
                <span>
                  <span className="font-semibold text-ink">Hills Wallet (instant)</span>
                  <span className="block text-xs text-muted">
                    Credited to your account right away - usable on your next order.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}
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
