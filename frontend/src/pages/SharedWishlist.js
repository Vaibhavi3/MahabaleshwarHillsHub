import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import ProductCard from '../components/ProductCard';
import { ProductGridSkeleton } from '../components/ProductCardSkeleton';
import { FiHeart } from 'react-icons/fi';

/**
 * Public, no-login view of a wishlist shared via ShareWishlistCard -
 * matching Myntra/Nykaa/Ajio's "share your wishlist" so whoever gets the
 * link (e.g. a relative picking a gift) sees exactly what was saved,
 * reusing the same ProductCard the rest of the storefront shows.
 */
const SharedWishlist = () => {
  const { token } = useParams();
  const [ownerName, setOwnerName] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .getSharedWishlist(token)
      .then(({ data }) => {
        setOwnerName(data.owner_first_name);
        setProducts(data.items.map((item) => item.product));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-8 w-64 bg-gray-200 rounded mb-8 animate-pulse" />
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-ink mb-4">This wishlist link isn't available</h1>
        <p className="text-muted mb-6">
          It may have been turned off, or the link was typed incorrectly.
        </p>
        <Link to="/products" className="btn-primary">
          Shop All Products
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-2">
        <FiHeart className="text-brand" size={22} />
        <h1 className="text-2xl font-extrabold text-ink">
          {ownerName ? `${ownerName}'s Wishlist` : 'Shared Wishlist'}
        </h1>
      </div>
      <p className="text-sm text-muted mb-8">
        {products.length} {products.length === 1 ? 'item' : 'items'} saved · Free shipping, no minimum · Pay
        securely via Stripe or Razorpay
      </p>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted mb-6">This wishlist is empty right now.</p>
          <Link to="/products" className="btn-primary">
            Shop All Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 items-start">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SharedWishlist;
