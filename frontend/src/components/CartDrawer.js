import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { removeFromCart, updateCartItem } from '../features/cartSlice';
import { closeCartDrawer } from '../features/uiSlice';
import { getImageUrl } from '../api/axiosConfig';
import { FiX, FiTrash2, FiMinus, FiPlus, FiTruck, FiShoppingBag } from 'react-icons/fi';
import toast from 'react-hot-toast';

/**
 * Myntra/Ajio/Nykaa-style "added to bag" slide-over: instead of a bare toast
 * that leaves the shopper wondering what's in their bag, adding an item
 * slides this panel in over the current page so they can see the whole bag,
 * adjust quantity, or jump straight to checkout without losing their place.
 */
const CartDrawer = () => {
  const open = useSelector((state) => state.ui.cartDrawerOpen);
  const { items, discountAmount } = useSelector((state) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dispatch(closeCartDrawer());
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, dispatch]);

  const close = () => dispatch(closeCartDrawer());

  const changeQuantity = (item, delta) => {
    const requested = item.quantity + delta;
    if (requested < 1) return;
    const capped = item.stock ? Math.min(requested, item.stock) : requested;
    if (item.stock && requested > item.stock) {
      toast.error(`Only ${item.stock} left in stock`);
    }
    dispatch(updateCartItem({ id: item.id, quantity: capped }));
  };

  const goToCheckout = () => {
    close();
    navigate('/checkout');
  };

  return (
    <div
      className={`fixed inset-0 z-[70] ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />

      <div
        className={`absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="font-extrabold text-ink flex items-center gap-2">
            <FiShoppingBag /> My Bag {items.length > 0 && `(${items.length})`}
          </h2>
          <button onClick={close} aria-label="Close bag" className="text-ink p-1">
            <FiX size={22} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <FiShoppingBag size={40} className="text-gray-300" />
            <p className="text-muted">Your bag is empty</p>
            <Link to="/products" onClick={close} className="btn-primary px-6 py-2.5">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <img
                    src={getImageUrl(item.image_url) || 'https://via.placeholder.com/80'}
                    alt={item.name}
                    className="w-16 h-16 object-contain bg-surface rounded shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{item.name}</p>
                    <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
                      <p className="text-sm font-bold text-ink">₹{item.price}</p>
                      {item.mrp > item.price && (
                        <span className="text-xs text-muted line-through">₹{item.mrp}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border border-gray-300 rounded">
                        <button
                          onClick={() => changeQuantity(item, -1)}
                          className="w-7 h-7 flex items-center justify-center text-ink disabled:opacity-30"
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <FiMinus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => changeQuantity(item, 1)}
                          className="w-7 h-7 flex items-center justify-center text-ink disabled:opacity-30"
                          disabled={Boolean(item.stock) && item.quantity >= item.stock}
                          aria-label="Increase quantity"
                        >
                          <FiPlus size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => dispatch(removeFromCart(item.id))}
                        className="text-muted hover:text-red-600 ml-auto"
                        aria-label={`Remove ${item.name}`}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 px-5 py-4 shrink-0">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-700 font-semibold mb-1">
                  <span>Coupon Discount</span>
                  <span>- ₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-ink mb-3">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted mb-3">
                <FiTruck className="text-brand shrink-0" /> Free shipping on every order, no minimum
              </p>
              <button onClick={goToCheckout} className="btn-primary w-full mb-2">
                Proceed to Checkout
              </button>
              <Link to="/cart" onClick={close} className="btn-secondary w-full text-center block">
                View Bag
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
