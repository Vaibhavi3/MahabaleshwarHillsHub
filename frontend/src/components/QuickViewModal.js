import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api, { getImageUrl } from '../api/axiosConfig';
import { addToCart } from '../features/cartSlice';
import { setWishlistItems, mapWishlistResponse } from '../features/wishlistSlice';
import { requireAuth } from '../utils/requireAuth';
import { FiX, FiHeart } from 'react-icons/fi';
import toast from 'react-hot-toast';

const BRAND = 'Ancles Home Socks';

/**
 * Myntra/Nykaa/Ajio-style "quick view": lets a shopper see price, colour
 * variants, stock and add to bag right from the grid, without leaving the
 * listing page. Reuses the same product payload the grid already has plus
 * the existing /variants endpoint - no new backend surface needed.
 */
const QuickViewModal = ({ product, onClose }) => {
  const [variants, setVariants] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useSelector((state) => state.auth);
  const wishlistItems = useSelector((state) => state.wishlist.items);
  const wishlisted = wishlistItems.some((item) => item.id === product.id);

  useEffect(() => {
    let cancelled = false;
    api
      .getProductVariants(product.id)
      .then((res) => {
        if (!cancelled) setVariants(res.data);
      })
      .catch(() => {
        if (!cancelled) setVariants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const rating = product.rating || 0;

  const handleAddToCart = () => {
    if (outOfStock) return;
    if (!requireAuth(token, navigate, location, 'Please login or register to add items to your bag')) return;
    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        stock: product.stock,
        quantity: parseInt(quantity, 10) || 1,
      })
    );
    toast.success('Added to bag');
    onClose();
  };

  const handleWishlist = async () => {
    if (!requireAuth(token, navigate, location, 'Please login or register to save items to your wishlist')) return;
    try {
      const response = wishlisted
        ? await api.removeFromWishlistApi(product.id)
        : await api.addToWishlist(product.id);
      dispatch(setWishlistItems(mapWishlistResponse(response.data)));
      toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (error) {
      toast.error('Could not update wishlist. Please try again.');
    }
  };

  // Portaled to <body>: ProductCard renders this inside its own <a> (the
  // whole card is a Link), so without a portal the modal's own links and
  // buttons would be invalid nested anchors and clicks on them would also
  // trigger the card's navigation.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view: ${product.name}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2">
        <button
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-ink z-10"
        >
          <FiX size={20} />
        </button>

        <div className="bg-surface flex items-center justify-center p-6 sm:p-8">
          <img
            src={getImageUrl(product.image_url) || 'https://via.placeholder.com/400'}
            alt={product.name}
            className="max-w-full max-h-[45vh] sm:max-h-[70vh] w-auto h-auto object-contain"
          />
        </div>

        <div className="p-6 sm:p-8 flex flex-col">
          <h4 className="font-extrabold text-base text-ink">{BRAND}</h4>
          <p className="text-sm text-muted mb-3">{product.name}</p>

          {rating > 0 && (
            <span className="inline-flex items-center gap-1 bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded w-fit mb-3">
              {rating.toFixed(1)} ★
            </span>
          )}

          <span className="text-2xl font-extrabold text-ink">₹{product.price}</span>
          <p className="text-xs text-muted mt-1 mb-3">inclusive of all taxes</p>

          {outOfStock ? (
            <p className="text-sm font-bold text-red-600 mb-4">Out of Stock</p>
          ) : lowStock ? (
            <p className="text-sm font-bold text-brand mb-4">Hurry! Only {product.stock} left</p>
          ) : (
            <div className="mb-4" />
          )}

          {variants.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-ink uppercase mb-2">
                Colour: <span className="font-normal normal-case text-muted">{product.color}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="w-10 h-10 rounded overflow-hidden border-2 border-brand ring-2 ring-brand-light bg-surface shrink-0">
                  <img
                    src={getImageUrl(product.image_url) || 'https://via.placeholder.com/40'}
                    alt={product.color}
                    className="w-full h-full object-contain"
                  />
                </span>
                {variants.map((v) => (
                  <Link
                    key={v.id}
                    to={`/products/${v.id}`}
                    onClick={onClose}
                    title={v.color}
                    className="w-10 h-10 rounded overflow-hidden border-2 border-transparent hover:border-gray-300 bg-surface shrink-0"
                  >
                    <img
                      src={getImageUrl(v.image_url) || 'https://via.placeholder.com/40'}
                      alt={v.color}
                      className="w-full h-full object-contain"
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs font-bold text-ink uppercase mb-4">
            Size: <span className="font-normal normal-case text-muted">{product.size || 'One Size'}</span>
          </p>

          {product.description && (
            <p className="text-sm text-ink leading-relaxed mb-4 line-clamp-3">{product.description}</p>
          )}

          {!outOfStock && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-ink uppercase">Qty:</span>
              <input
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 w-16 text-sm"
              />
            </div>
          )}

          <div className="mt-auto flex flex-col sm:flex-row gap-3 pt-2">
            {outOfStock ? (
              <Link to={`/products/${product.id}`} onClick={onClose} className="btn-primary flex-1 text-center py-3">
                View Details
              </Link>
            ) : (
              <button onClick={handleAddToCart} className="btn-primary flex-1 py-3">
                Add to Bag
              </button>
            )}
            <button
              onClick={handleWishlist}
              className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
            >
              <FiHeart className={wishlisted ? 'text-brand fill-current' : ''} />
              {wishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>
          </div>
          <Link
            to={`/products/${product.id}`}
            onClick={onClose}
            className="text-brand text-sm font-semibold uppercase hover:underline text-center mt-4"
          >
            View Full Details
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuickViewModal;
