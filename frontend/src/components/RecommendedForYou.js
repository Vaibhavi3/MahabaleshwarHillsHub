import React, { useEffect, useState } from 'react';
import api from '../api/axiosConfig';
import ProductCard from './ProductCard';
import { ProductGridSkeleton } from './ProductCardSkeleton';

// Wires up the already-built /recommendations/for-you endpoint (see
// backend/app/routes/recommendations.py), which was shipped but never
// surfaced in the UI. Logged-in shoppers with order history get products
// from their most-ordered categories; everyone else gets real bestsellers
// by units sold. The backend's `personalized` flag decides the heading so
// this never claims "based on your orders" when it's actually the
// trending fallback.
const RecommendedForYou = ({ className = '' }) => {
  const [products, setProducts] = useState([]);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .getRecommendationsForYou(8)
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data.products || []);
        setPersonalized(!!data.personalized);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className={`container mx-auto px-4 py-12 ${className}`}>
      <h2 className="text-xl md:text-2xl font-extrabold mb-1 text-ink">
        {personalized ? 'Picks For You' : 'Trending Picks For You'}
      </h2>
      <p className="text-sm text-muted mb-8">
        {personalized
          ? 'Based on what you’ve ordered before'
          : 'What other shoppers are buying most'}
      </p>
      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 items-start">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
};

export default RecommendedForYou;
