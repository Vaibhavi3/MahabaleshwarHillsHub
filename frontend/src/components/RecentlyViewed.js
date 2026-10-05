import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axiosConfig';
import ProductCard from './ProductCard';

// Recently-viewed is account-backed once logged in (see
// backend/app/routes/recently_viewed.py), the same way the wishlist is -
// it follows the shopper across devices. Guests get the same rail, but it
// lives only in this browser's local storage until they sign in.
const STORAGE_KEY = 'recentlyViewedIds';
const MAX_STORED = 20;

export const recordProductView = (productId, token) => {
  if (!productId) return;

  if (token) {
    api.recordRecentlyViewed(productId).catch(() => {
      // Best-effort browsing-history log - a failure here shouldn't
      // interrupt or alert the shopper.
    });
    return;
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const withoutCurrent = stored.filter((entry) => entry.id !== productId);
    const next = [{ id: productId, viewedAt: Date.now() }, ...withoutCurrent].slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing, quota) - the rail just
    // won't have anything to show next time, nothing to recover from.
  }
};

const RecentlyViewed = ({ excludeId, title = 'Recently Viewed' }) => {
  const { token } = useSelector((state) => state.auth);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (token) {
          const response = await api.getRecentlyViewed(8, excludeId);
          if (!cancelled) setProducts(response.data.map((entry) => entry.product));
          return;
        }

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        const ids = stored
          .filter((entry) => entry.id !== excludeId)
          .sort((a, b) => b.viewedAt - a.viewedAt)
          .slice(0, 8)
          .map((entry) => entry.id);

        if (ids.length === 0) {
          if (!cancelled) setProducts([]);
          return;
        }

        const results = await Promise.allSettled(ids.map((id) => api.getProductById(id)));
        if (!cancelled) {
          setProducts(
            results.filter((r) => r.status === 'fulfilled').map((r) => r.value.data)
          );
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token, excludeId]);

  if (loading || products.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-xl md:text-2xl font-extrabold mb-8 text-ink">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 items-start">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};

export default RecentlyViewed;
