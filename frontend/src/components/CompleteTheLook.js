import React from 'react';
import ProductCard from './ProductCard';

/**
 * Cross-category styling carousel, inspired by Myntra's "Complete the Look" /
 * My Stylist: a horizontal rail of the store's best-rated, in-stock pieces
 * from categories OTHER than the one being viewed, so a sock shopper also
 * sees a top slipper or bag instead of only more socks (that's what
 * /similar and Frequently Bought Together already cover).
 */
const CompleteTheLook = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-16">
      <h2 className="text-xl font-extrabold text-ink mb-1">Complete Your Cozy Set</h2>
      <p className="text-sm text-muted mb-6">
        Pair this with our best-loved handmade pieces from other categories
      </p>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {items.map((p) => (
          <div key={p.id} className="w-40 sm:w-48 shrink-0 snap-start">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompleteTheLook;
