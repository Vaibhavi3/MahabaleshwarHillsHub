import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import api, { getImageUrl } from '../api/axiosConfig';
import toast from 'react-hot-toast';
import OrderTimeline from '../components/OrderTimeline';
import CancelOrderModal from '../components/CancelOrderModal';
import ReturnRequestModal from '../components/ReturnRequestModal';
import ReturnRequestStatus from '../components/ReturnRequestStatus';
import { addToCart } from '../features/cartSlice';
import { FiAward, FiDownload, FiRefreshCw, FiLifeBuoy, FiGift } from 'react-icons/fi';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);
const RETURN_WINDOW_DAYS = 7;

const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  completed: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
  refund_failed: 'Paid (refund pending)',
};

const deliveredAt = (order) => {
  const entry = (order.status_history || []).find((h) => h.status === 'delivered');
  return entry ? new Date(entry.created_at) : null;
};

const withinReturnWindow = (order) => {
  const delivered = deliveredAt(order);
  if (!delivered) return false;
  const daysSince = (Date.now() - delivered.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince <= RETURN_WINDOW_DAYS;
};

const returnDeadlineLabel = (order) => {
  const delivered = deliveredAt(order);
  if (!delivered) return null;
  const deadline = new Date(delivered.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [reorderingId, setReorderingId] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.getOrders();
        setOrders([...response.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } catch (error) {
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
      try {
        const rrResponse = await api.getMyReturnRequests();
        setReturnRequests(rrResponse.data);
      } catch (error) {
        // non-critical - the page still works without return status badges
      }
    };
    load();
  }, []);

  const returnRequestForItem = (itemId) => returnRequests.find((r) => r.order_item_id === itemId);

  const handleReturnSubmit = async (payload) => {
    try {
      const response = await api.createReturnRequest(returnTarget.order.id, returnTarget.item.id, payload);
      setReturnRequests((prev) => [...prev, response.data]);
      toast.success(payload.request_type === 'exchange' ? 'Exchange requested' : 'Return requested');
      setReturnTarget(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not submit this request');
    }
  };

  const handleDownloadInvoice = async (order) => {
    try {
      const response = await api.downloadInvoice(order.id);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${order.order_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Could not download the invoice right now');
    }
  };

  const handleBuyAgain = async (order) => {
    setReorderingId(order.id);
    try {
      const { data } = await api.reorder(order.id);
      data.available.forEach((item) => {
        dispatch(
          addToCart({
            id: item.product_id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            stock: item.stock,
            category: item.category,
            quantity: item.quantity,
          })
        );
      });

      if (data.available.length === 0) {
        toast.error("None of this order's items are available right now");
      } else {
        toast.success(
          `${data.available.length} item${data.available.length > 1 ? 's' : ''} added to your bag`
        );
      }
      if (data.skipped.length > 0) {
        toast(
          data.skipped.map((s) => `${s.product_name}: ${s.reason}`).join('\n'),
          { icon: '⚠️', duration: 5000 }
        );
      }
      if (data.available.length > 0) {
        navigate('/cart');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not add these items to your bag');
    } finally {
      setReorderingId(null);
    }
  };

  const handleCancelConfirm = async (reason) => {
    try {
      const response = await api.cancelOrder(cancelTarget.id, reason);
      setOrders((prev) => prev.map((o) => (o.id === response.data.id ? response.data : o)));
      toast.success('Order cancelled');
      setCancelTarget(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not cancel this order');
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">No orders yet</h1>
        <Link to="/products" className="btn-primary">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
              <div>
                <p className="font-semibold">{order.order_number}</p>
                <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                  {order.status}
                </span>
                {order.payment_status === 'completed' && (
                  <button
                    onClick={() => handleDownloadInvoice(order)}
                    className="flex items-center gap-1 text-xs font-semibold uppercase text-brand hover:underline"
                  >
                    <FiDownload /> Invoice
                  </button>
                )}
                <button
                  onClick={() => handleBuyAgain(order)}
                  disabled={reorderingId === order.id}
                  className="flex items-center gap-1 text-xs font-semibold uppercase text-brand hover:underline disabled:opacity-50"
                >
                  <FiRefreshCw className={reorderingId === order.id ? 'animate-spin' : ''} />
                  {reorderingId === order.id ? 'Adding...' : 'Buy Again'}
                </button>
                <Link
                  to={`/help?order=${order.id}`}
                  className="flex items-center gap-1 text-xs font-semibold uppercase text-brand hover:underline"
                >
                  <FiLifeBuoy /> Need Help?
                </Link>
              </div>
            </div>
            <div className="border-y py-3 mb-4">
              <OrderTimeline
                status={order.status}
                statusHistory={order.status_history}
                createdAt={order.created_at}
              />
            </div>
            {order.is_gift && (
              <div className="flex items-start gap-2 bg-brand-light/20 border border-brand-light rounded-lg px-4 py-2.5 mb-4 text-sm">
                <FiGift className="text-brand mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold text-ink">
                    Sent as a gift{order.gift_recipient_name ? ` for ${order.gift_recipient_name}` : ''}
                  </span>
                  {order.gift_message && (
                    <span className="block text-muted italic mt-0.5">"{order.gift_message}"</span>
                  )}
                </span>
              </div>
            )}
            <div className="space-y-3 mb-4">
              {order.items.map((item) => {
                const existingRequest = returnRequestForItem(item.id);
                const eligible = order.status === 'delivered' && withinReturnWindow(order);
                return (
                  <div key={item.id} className="text-sm">
                    <div className="flex items-center gap-3">
                      <img
                        src={getImageUrl(item.product_image) || 'https://via.placeholder.com/60'}
                        alt={item.product_name || 'Product'}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <span className="flex-1 text-gray-700">
                        {item.product_name || `Product #${item.product_id}`} x {item.quantity}
                      </span>
                      <span className="text-gray-700">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    {existingRequest ? (
                      <ReturnRequestStatus request={existingRequest} orderId={order.id} />
                    ) : (
                      eligible && (
                        <div className="mt-2 ml-[60px] flex items-center gap-2">
                          <button
                            onClick={() => setReturnTarget({ order, item })}
                            className="text-xs font-semibold uppercase text-brand hover:underline"
                          >
                            Return / Exchange
                          </button>
                          <span className="text-xs text-muted">
                            (by {returnDeadlineLabel(order)})
                          </span>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center border-t pt-4">
              <span className="text-gray-600">
                Payment: {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
              </span>
              <span className="font-bold text-lg">₹{order.total_amount.toFixed(2)}</span>
            </div>
            {order.refunded_amount > 0 && (
              <p className="text-xs text-emerald-700 font-semibold mt-2">
                ₹{order.refunded_amount.toFixed(0)} refunded to your original payment method
              </p>
            )}
            {order.payment_status === 'refund_failed' && (
              <p className="text-xs text-muted mt-2">
                We hit an issue refunding this order automatically.{' '}
                <Link to={`/help?order=${order.id}`} className="text-brand font-semibold hover:underline">
                  Contact support
                </Link>{' '}
                and we'll sort it out.
              </p>
            )}
            {order.status === 'delivered' && order.points_earned > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-2">
                <FiAward /> You earned {order.points_earned} Hills Rewards points on this order
              </p>
            )}
            {order.multibuy_discount_amount > 0 && (
              <p className="text-xs text-muted mt-1">
                Mix &amp; Match Socks discount saved ₹{order.multibuy_discount_amount.toFixed(0)} on this order
              </p>
            )}
            {order.points_redeemed > 0 && (
              <p className="text-xs text-muted mt-1">
                {order.points_redeemed} Hills Rewards points were redeemed for ₹{order.points_discount_amount.toFixed(0)} off this order
              </p>
            )}
            {order.gift_card_amount > 0 && (
              <p className="text-xs text-muted mt-1">
                Gift card {order.gift_card_code} covered ₹{order.gift_card_amount.toFixed(0)} of this order
              </p>
            )}
            {order.status === 'cancelled' && order.cancellation_reason && (
              <p className="text-xs text-muted mt-2">Cancellation reason: {order.cancellation_reason}</p>
            )}
            {CANCELLABLE_STATUSES.has(order.status) && (
              <button
                onClick={() => setCancelTarget(order)}
                className="mt-4 text-sm font-semibold uppercase text-red-600 hover:underline"
              >
                Cancel Order
              </button>
            )}
          </div>
        ))}
      </div>

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {returnTarget && (
        <ReturnRequestModal
          order={returnTarget.order}
          item={returnTarget.item}
          onClose={() => setReturnTarget(null)}
          onSubmitted={handleReturnSubmit}
        />
      )}
    </div>
  );
};

export default Orders;
