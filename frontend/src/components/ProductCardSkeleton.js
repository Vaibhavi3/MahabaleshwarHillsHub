import React from 'react';

const ProductCardSkeleton = () => (
  <div className="block animate-pulse">
    <div className="bg-surface rounded aspect-[3/4] w-full" />
    <div className="pt-3 pb-4 px-0.5 space-y-2">
      <div className="h-3.5 bg-surface rounded w-2/3" />
      <div className="h-3.5 bg-surface rounded w-1/2" />
      <div className="h-3.5 bg-surface rounded w-1/4" />
    </div>
  </div>
);

export const ProductGridSkeleton = ({ count = 8, className = '' }) => (
  <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 items-start ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export default ProductCardSkeleton;
