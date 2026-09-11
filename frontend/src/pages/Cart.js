import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { removeFromCart, updateCartItem, clearCart, applyCoupon, removeCoupon } from '../features/cartSlice';
import api, { getImageUrl } from '../api/axiosConfig';
import { FiTrash2, FiTag, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Cart = () => {
  const { items, couponCode, discountAmount } = useSelector((state) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);

  // Re-validate the applied coupon whenever the cart total changes (e.g. a
  // quantity edit could drop it below the coupon's minimum order value).
  useEffect(() => {
    if (!couponCode || items.length === 0) return;
    api
      .validateCoupon(couponCode, subtotal)
      .then(({ data }) => {
        if (data.valid) {
          dispatch(applyCoupon({ couponCode, discountAmount: data.discount_amount }));
        } else {
          dispatch(removeCoupon());
          toast.error(`Coupon removed: ${data.message}`);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setApplying(true);
    try {
      const { data } = await api.validateCoupon(codeInput.trim(), subtotal);
      if (data.valid) {
        dispatch(applyCoupon({ couponCode: codeInput.trim().toUpperCase(), discountAmount: data.discount_amount }));
        toast.success(`Coupon applied - you saved ₹${data.discount_amount.toFixed(2)}`);
        setCodeInput('');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not apply coupon');
    } finally {
      setApplying(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <Link to="/products" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 bg-white rounded-lg shadow p-4">
            <img
              src={getImageUrl(item.image_url) || 'https://via.placeholder.com/100'}
              alt={item.name}
              className="w-20 h-20 object-cover rounded"
            />
            <div className="flex-1">
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-purple-600 font-bold">₹{item.price}</p>
            </div>
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) =>
                dispatch(updateCartItem({ id: item.id, quantity: Math.max(1, parseInt(e.target.value) || 1) }))
              }
              className="border rounded px-3 py-1 w-16 text-center"
            />
            <span className="font-semibold w-24 text-right">₹{(item.price * item.quantity).toFixed(2)}</span>
            <button onClick={() => dispatch(removeFromCart(item.id))} className="text-red-600 hover:text-red-800">
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-md ml-auto">
        <form onSubmit={handleApplyCoupon} className="mb-4">
          {couponCode ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
              <span className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <FiTag /> {couponCode} applied
              </span>
              <button type="button" onClick={() => dispatch(removeCoupon())} className="text-emerald-700 hover:text-emerald-900">
                <FiX />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Enter coupon code"
                className="flex-1 border rounded-lg px-4 py-2 uppercase"
              />
              <button type="submit" disabled={applying} className="btn-secondary disabled:opacity-50">
                {applying ? '...' : 'Apply'}
              </button>
            </div>
          )}
        </form>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Coupon Discount</span>
              <span>- ₹{discountAmount.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between text-lg mb-4 border-t pt-4">
          <span>Total</span>
          <span className="font-bold">₹{total.toFixed(2)}</span>
        </div>
        <button onClick={() => navigate('/checkout')} className="btn-primary w-full mb-2">
          Proceed to Checkout
        </button>
        <button
          onClick={() => {
            dispatch(clearCart());
          }}
          className="btn-secondary w-full"
        >
          Clear Cart
        </button>
      </div>
    </div>
  );
};

export default Cart;
