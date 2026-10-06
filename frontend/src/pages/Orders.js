import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import toast from 'react-hot-toast';
import OrderTimeline from '../components/OrderTimeline';
import CancelOrderModal from '../components/CancelOrderModal';
import ReturnRequestModal from '../components/ReturnRequestModal';
import ReturnRequestStatus from '../components/ReturnRequestStatus';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);
const RETURN_WINDOW_DAYS = 7;

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
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                {order.status}
              </span>
            </div>
            <div className="border-y py-3 mb-4">
              <OrderTimeline
                status={order.status}
                statusHistory={order.status_history}
                createdAt={order.created_at}
              />
            </div>
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
                      <ReturnRequestStatus request={existingRequest} />
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
              <span className="text-gray-600">Payment: {order.payment_status}</span>
              <span className="font-bold text-lg">₹{order.total_amount.toFixed(2)}</span>
            </div>
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
