import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch, FiPackage } from 'react-icons/fi';
import api, { getImageUrl } from '../api/axiosConfig';
import OrderTimeline from '../components/OrderTimeline';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

/**
 * Public "Track Your Order" page, matching Myntra/Nykaa/Ajio's
 * order-number + email lookup that works without logging in - so a
 * tracking link shared from an order email still works on another
 * device, or once a session has expired. Reuses the same OrderTimeline
 * stepper shown on the logged-in Orders page.
 */
const TrackOrder = () => {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const runTrack = async (orderNumberValue, emailValue) => {
    if (!orderNumberValue.trim() || !emailValue.trim()) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const { data } = await api.trackOrder(orderNumberValue.trim(), emailValue.trim());
      setOrder(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'No order found matching that order number and email. Please double-check and try again.'
      );
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  // Auto-run when arriving via a prefilled link (e.g. "Copy tracking link" on Your Orders).
  useEffect(() => {
    const qOrder = searchParams.get('order');
    const qEmail = searchParams.get('email');
    if (qOrder && qEmail) {
      runTrack(qOrder, qEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    runTrack(orderNumber, email);
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="text-center mb-8">
        <FiPackage className="text-brand text-4xl mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-ink">Track Your Order</h1>
        <p className="text-muted text-sm mt-1">
          Enter your order number and the email used to place it - no login needed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4 mb-8">
        <div>
          <label className="block text-sm font-semibold text-ink mb-1">Order Number</label>
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="ORD-XXXXXXXX"
            className="w-full border rounded-lg px-4 py-2 uppercase"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border rounded-lg px-4 py-2"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
          <FiSearch /> {loading ? 'Searching...' : 'Track Order'}
        </button>
      </form>

      {searched && error && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-muted">{error}</div>
      )}

      {order && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Order</p>
              <p className="font-bold text-ink">{order.order_number}</p>
            </div>
            <span className={`text-xs font-semibold uppercase px-3 py-1 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-ink'}`}>
              {order.status}
            </span>
          </div>

          <OrderTimeline status={order.status} statusHistory={order.status_history} createdAt={order.created_at} />

          {order.tracking_number && (
            <p className="text-sm text-muted">
              Courier tracking number: <span className="font-semibold text-ink">{order.tracking_number}</span>
            </p>
          )}

          <div className="divide-y">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                {item.product_image && (
                  <img
                    src={getImageUrl(item.product_image)}
                    alt={item.product_name}
                    className="w-14 h-14 object-contain rounded bg-surface shrink-0"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{item.product_name || 'Product'}</p>
                  <p className="text-xs text-muted">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-ink">₹{(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2 border-t font-bold text-ink">
            <span>Total</span>
            <span>₹{order.total_amount.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackOrder;
