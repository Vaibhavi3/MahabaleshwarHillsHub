import React from 'react';
import { FiCheck, FiX, FiClock } from 'react-icons/fi';

const STEPS = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

const STEP_INDEX = STEPS.reduce((acc, step, i) => ({ ...acc, [step.key]: i }), {});

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Order tracking timeline shown on "Your Orders", styled after the
 * Order Placed -> Confirmed -> Shipped -> Delivered stepper used by
 * Myntra/Nykaa/Ajio. Dates are only shown where we actually recorded a
 * status_history entry - never guessed - so orders placed before this
 * feature shipped just show checkmarks without a timestamp for steps we
 * have no record of.
 */
const OrderTimeline = ({ status, statusHistory = [], createdAt }) => {
  const historyByStatus = statusHistory.reduce((acc, entry) => {
    if (!acc[entry.status]) acc[entry.status] = entry.created_at;
    return acc;
  }, {});

  if (status === 'cancelled') {
    const cancelledAt = historyByStatus.cancelled;
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <FiX size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-red-600">Order Cancelled</p>
          {cancelledAt && <p className="text-xs text-muted">{formatDate(cancelledAt)}</p>}
        </div>
      </div>
    );
  }

  const currentIndex = STEP_INDEX[status] ?? 0;

  return (
    <div className="flex items-start justify-between py-2">
      {STEPS.map((step, i) => {
        const isComplete = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const date = step.key === 'pending' ? createdAt : historyByStatus[step.key];

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-1 flex-col items-center text-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isComplete ? 'bg-brand text-white' : 'bg-gray-100 text-muted'
                }`}
              >
                {isComplete ? <FiCheck size={16} /> : <FiClock size={14} />}
              </span>
              <p className={`mt-1 text-xs font-medium ${isCurrent ? 'text-ink' : isComplete ? 'text-ink' : 'text-muted'}`}>
                {step.label}
              </p>
              {date && <p className="text-[11px] text-muted">{formatDate(date)}</p>}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mt-3.5 h-0.5 flex-1 ${i < currentIndex ? 'bg-brand' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default OrderTimeline;
