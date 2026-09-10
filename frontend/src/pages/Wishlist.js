import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { removeFromWishlist } from '../features/wishlistSlice';
import { addToCart } from '../features/cartSlice';
import { getImageUrl } from '../api/axiosConfig';
import { FiTrash2, FiShoppingBag } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Wishlist = () => {
  const { items } = useSelector((state) => state.wishlist);
  const dispatch = useDispatch();

  const handleMoveToBag = (item) => {
    dispatch(addToCart({ ...item, quantity: 1 }));
    dispatch(removeFromWishlist(item.id));
    toast.success('Moved to bag');
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-ink mb-4">Your wishlist is empty</h1>
        <p className="text-muted mb-6">Tap the heart on any product to save it here.</p>
        <Link to="/products" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-ink mb-8">
        My Wishlist <span className="text-muted font-normal text-base">({items.length})</span>
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 items-start">
        {items.map((item) => (
          <div key={item.id} className="bg-white">
            <Link to={`/products/${item.id}`} className="block relative bg-surface overflow-hidden mb-3">
              <img
                src={getImageUrl(item.image_url) || 'https://via.placeholder.com/300x400'}
                alt={item.name}
                className="w-full h-auto block"
              />
            </Link>
            <p className="text-sm text-ink font-semibold truncate mb-1">{item.name}</p>
            <p className="text-sm font-bold text-ink mb-3">₹{item.price}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleMoveToBag(item)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-ink text-white text-xs font-bold uppercase tracking-wide py-2 hover:bg-black transition-colors"
              >
                <FiShoppingBag size={14} /> Add to Bag
              </button>
              <button
                onClick={() => dispatch(removeFromWishlist(item.id))}
                className="px-3 border border-gray-300 text-ink hover:border-ink transition-colors"
                title="Remove from wishlist"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Wishlist;
