import React from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../api/axiosConfig';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../features/cartSlice';
import { toggleWishlist } from '../features/wishlistSlice';
import { FiHeart } from 'react-icons/fi';
import toast from 'react-hot-toast';

const BRAND = 'Ancles Home Socks';

const ProductCard = ({ product }) => {
  const dispatch = useDispatch();
  const wishlistItems = useSelector((state) => state.wishlist.items);
  const wishlisted = wishlistItems.some((item) => item.id === product.id);
  const rating = product.rating || 0;

  const handleAddToCart = (e) => {
    e.preventDefault();
    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity: 1,
      })
    );
    toast.success('Added to bag');
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    dispatch(
      toggleWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
      })
    );
    toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <Link to={`/products/${product.id}`} className="product-card bg-white block group">
      <div className="relative aspect-[3/4] bg-surface overflow-hidden">
        <img
          src={getImageUrl(product.image_url) || 'https://via.placeholder.com/300x400'}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        <button
          onClick={handleWishlist}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
        >
          <FiHeart
            className={wishlisted ? 'text-brand fill-current' : 'text-ink'}
            size={16}
          />
        </button>

        <div className="product-card-overlay absolute bottom-0 left-0 right-0 opacity-0 transition-opacity duration-200">
          <button
            onClick={handleAddToCart}
            className="w-full bg-ink text-white text-xs font-bold uppercase tracking-wide py-2.5 hover:bg-black transition-colors"
          >
            Add to Bag
          </button>
        </div>
      </div>

      <div className="pt-3 pb-4 px-0.5">
        <h4 className="font-bold text-sm text-ink truncate">{BRAND}</h4>
        <p className="text-sm text-muted truncate mb-1.5">{product.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">₹{product.price}</span>
          {rating > 0 && (
            <span className="flex items-center gap-1 bg-emerald-700 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
              {rating.toFixed(1)} ★
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
