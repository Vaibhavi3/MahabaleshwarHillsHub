import React from 'react';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  requested: 'Requested',
  approved: 'Approved',
  picked_up: 'Picked Up',
  rejected: 'Rejected',
};

const label = (request) => {
  if (request.status === 'completed') {
    return request.request_type === 'exchange' ? 'Exchanged' : 'Refunded';
  }
  return STATUS_LABELS[request.status] || request.status;
};

const ReturnRequestStatus = ({ request, orderId }) => (
  <div className="mt-3 flex items-center gap-2 flex-wrap">
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[request.status] || 'bg-gray-100 text-gray-800'}`}>
      {request.request_type === 'exchange' ? 'Exchange' : 'Return'}: {label(request)}
    </span>
    {request.status === 'rejected' && (
      <span className="text-xs text-muted">
        Questions?{' '}
        <Link to={orderId ? `/help?order=${orderId}` : '/help'} className="text-brand font-semibold hover:underline">
          Contact support
        </Link>
      </span>
    )}
  </div>
);

export default ReturnRequestStatus;
