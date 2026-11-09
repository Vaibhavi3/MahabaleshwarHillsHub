import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { addToCart, removeFromCart, updateCartItem, clearCart, applyCoupon, removeCoupon } from '../features/cartSlice';
import { setSavedForLaterItems, mapSavedForLaterResponse } from '../features/savedForLaterSlice';
import api, { getImageUrl } from '../api/axiosConfig';
import OffersList from '../components/OffersList';
import RecommendedForYou from '../components/RecommendedForYou';
import { FiTrash2, FiTag, FiX, FiTruck, FiShield, FiPackage, FiBookmark, FiShoppingBag } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { computeMultibuyDiscount } from '../utils/multibuy';

const Cart = () => {
  const { items, couponCode, discountAmount } = useSelector((state) => state.cart);
  const { items: savedItems } = useSelector((state) => state.savedForLater);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyingCode, setApplyingCode] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [movingId, setMovingId] = useState(null);

  const handleSaveForLater = async (item) => {
    setSavingId(item.id);
    try {
      const response = await api.saveForLater(item.id, item.quantity);
      dispatch(setSavedForLaterItems(mapSavedForLaterResponse(response.data)));
      dispatch(removeFromCart(item.id));
      toast.success(`${item.name} saved for later`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save item for later');
    } finally {
      setSavingId(null);
    }
  };

  const handleMoveToBag = async (item) => {
    setMovingId(item.id);
    try {
      const response = await api.removeSavedForLater(item.id);
      dispatch(setSavedForLaterItems(mapSavedForLaterResponse(response.data)));
      const capped = item.stock ? Math.min(item.quantity, item.stock) : item.quantity;
      if (item.stock && capped < item.quantity) {
        toast.error(`Only ${item.stock} left in stock - added ${capped} to your bag`);
      }
      dispatch(addToCart({ ...item, quantity: capped }));
      toast.success(`${item.name} moved to your bag`);
    } catch (error) {
      toast.error('Could not move item to your bag');
    } finally {
      setMovingId(null);
    }
  };

  const handleRemoveSaved = async (item) => {
    try {
      const response = await api.removeSavedForLater(item.id);
      dispatch(setSavedForLaterItems(mapSavedForLaterResponse(response.data)));
    } catch (error) {
      toast.error('Could not remove item');
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const mrpSavings = items.reduce(
    (sum, item) => sum + (item.mrp > item.price ? (item.mrp - item.price) * item.quantity : 0),
    0
  );
  const multibuy = computeMultibuyDiscount(items);
  const subtotalAfterMultibuy = Math.max(0, subtotal - multibuy.amount);
  const total = Math.max(0, subtotalAfterMultibuy - discountAmount);

  // Re-validate the applied coupon whenever the cart total changes (e.g. a
  // quantity edit could drop it below the coupon's minimum order value).
  useEffect(() => {
    if (!couponCode || items.length === 0) return;
    api
      .validateCoupon(couponCode, subtotalAfterMultibuy)
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
  }, [subtotalAfterMultibuy]);

  const applyCouponCode = async (code) => {
    if (!code.trim()) return;
    setApplying(true);
    setApplyingCode(code);
    try {
      const { data } = await api.validateCoupon(code.trim(), subtotalAfterMultibuy);
      if (data.valid) {
        dispatch(applyCoupon({ couponCode: code.trim().toUpperCase(), discountAmount: data.discount_amount }));
        toast.success(`Coupon applied - you saved ₹${data.discount_amount.toFixed(2)}`);
        setCodeInput('');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not apply coupon');
    } finally {
      setApplying(false);
      setApplyingCode(null);
    }
  };

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    applyCouponCode(codeInput);
  };

  const SavedForLaterSection = () =>
    savedItems.length === 0 ? null : (
      <div className="mt-10">
        <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
          <FiBookmark className="text-muted" /> Saved For Later
          <span className="text-muted font-normal text-base">({savedItems.length})</span>
        </h2>
        <div className="space-y-4">
          {savedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-4 bg-white rounded-lg shadow p-4">
              <img
                src={getImageUrl(item.image_url) || 'https://via.placeholder.com/100'}
                alt={item.name}
                className="w-20 h-20 object-contain bg-surface rounded"
              />
              <div className="flex-1">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-ink font-bold">₹{item.price}</p>
                <p className="text-xs text-muted mt-1">Qty {item.quantity}</p>
                {item.stock === 0 && <p className="text-xs font-semibold text-red-600 mt-1">Out of stock</p>}
              </div>
              <button
                onClick={() => handleMoveToBag(item)}
                disabled={movingId === item.id || item.stock === 0}
                className="flex items-center gap-1.5 btn-secondary disabled:opacity-50 whitespace-nowrap"
              >
                <FiShoppingBag size={14} /> Move to Bag
              </button>
              <button onClick={() => handleRemoveSaved(item)} className="text-red-600 hover:text-red-800">
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </div>
    );

  if (items.length === 0) {
    return (
      <div>
        <div className="container mx-auto px-4 pt-16 pb-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Link to="/products" className="btn-primary">
            Continue Shopping
          </Link>
        </div>
        {savedItems.length > 0 && (
          <div className="container mx-auto px-4">
            <SavedForLaterSection />
          </div>
        )}
        <RecommendedForYou />
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
              className="w-20 h-20 object-contain bg-surface rounded"
            />
            <div className="flex-1">
              <h3 className="font-semibold">{item.name}</h3>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-ink font-bold">₹{item.price}</p>
                {item.mrp > item.price && (
                  <>
                    <span className="text-xs text-muted line-through">₹{item.mrp}</span>
                    <span className="text-xs font-bold text-orange-500">
                      ({Math.round((1 - item.price / item.mrp) * 100)}% OFF)
                    </span>
                  </>
                )}
              </div>
              {item.stock > 0 && item.stock <= 5 && (
                <p className="text-xs font-semibold text-brand mt-1">Only {item.stock} left</p>
              )}
              <button
                onClick={() => handleSaveForLater(item)}
                disabled={savingId === item.id}
                className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand mt-1.5 disabled:opacity-50"
              >
                <FiBookmark size={12} /> Save for later
              </button>
            </div>
            <input
              type="number"
              min="1"
              max={item.stock || undefined}
              value={item.quantity}
              onChange={(e) => {
                const requested = Math.max(1, parseInt(e.target.value) || 1);
                const capped = item.stock ? Math.min(requested, item.stock) : requested;
                if (item.stock && requested > item.stock) {
                  toast.error(`Only ${item.stock} left in stock`);
                }
                dispatch(updateCartItem({ id: item.id, quantity: capped }));
              }}
              className="border rounded px-3 py-1 w-16 text-center"
            />
            <span className="font-semibold w-24 text-right">₹{(item.price * item.quantity).toFixed(2)}</span>
            <button onClick={() => dispatch(removeFromCart(item.id))} className="text-red-600 hover:text-red-800">
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      {(multibuy.eligibleQuantity > 0 || multibuy.amount > 0) && (
        <div className="max-w-md ml-auto mb-4 flex items-start gap-2.5 bg-brand-light/20 border border-brand-light rounded-lg px-4 py-3">
          <FiPackage className="text-brand shrink-0 mt-0.5" />
          {multibuy.amount > 0 ? (
            <p className="text-sm text-ink">
              <span className="font-bold">Mix &amp; Match Socks: {multibuy.percent}% off applied!</span> You're
              saving ₹{multibuy.amount.toFixed(2)} on {multibuy.eligibleQuantity} Home Socks.
            </p>
          ) : (
            <p className="text-sm text-ink">
              Add {multibuy.itemsUntilNextTier} more Home Sock{multibuy.itemsUntilNextTier > 1 ? 's' : ''} to unlock{' '}
              <span className="font-bold">{multibuy.nextTier}% off</span> with Mix &amp; Match Socks.
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 max-w-md ml-auto">
        {!couponCode && <OffersList onApply={applyCouponCode} applyingCode={applyingCode} />}
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
          {mrpSavings > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>You saved on MRP</span>
              <span>₹{mrpSavings.toFixed(2)}</span>
            </div>
          )}
          {multibuy.amount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Mix &amp; Match Socks ({multibuy.percent}%)</span>
              <span>- ₹{multibuy.amount.toFixed(2)}</span>
            </div>
          )}
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
        <div className="flex flex-col gap-1.5 mb-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <FiTruck className="text-brand shrink-0" /> Free shipping on every order, no minimum
          </span>
          <span className="flex items-center gap-1.5">
            <FiShield className="text-brand shrink-0" /> Pay securely online via Stripe or Razorpay
          </span>
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

      <SavedForLaterSection />
    </div>
  );
};

export default Cart;
