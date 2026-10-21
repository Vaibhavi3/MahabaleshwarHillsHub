import React from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../api/axiosConfig';

const Thumb = ({ src, alt, ready, size }) => (
  <div className={`${size} shrink-0 rounded bg-surface overflow-hidden flex items-center justify-center`}>
    {src ? (
      <img src={getImageUrl(src)} alt={alt} className="max-h-full max-w-full object-contain" />
    ) : ready ? (
      <span className="text-[10px] text-muted text-center px-1 leading-tight">Coming soon</span>
    ) : (
      <div className="h-full w-full animate-pulse bg-gray-200" />
    )}
  </div>
);

// Desktop flyout for one top-level category nav item: a hero panel (thumbnail,
// product count, "Shop All" CTA) plus, when the category has subcategories, a
// grid of subcategory cards each with their own thumbnail and count. Counts
// and thumbnails come from the single /categories/menu aggregate so the
// header issues one request instead of one per category/subcategory.
const MegaMenu = ({ categorySlug, categoryLabel, categoryTo, subcategories, menu, status }) => {
  const ready = status === 'ready';
  const stats = menu?.[categorySlug];
  const count = stats?.product_count || 0;
  const heroImage = stats?.image_url || null;

  return (
    <div className="hidden group-hover:flex absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="w-48 bg-surface p-4 flex flex-col items-start gap-3 border-r border-gray-200">
        <Thumb src={heroImage} alt={categoryLabel} ready={ready} size="h-24 w-24" />
        <div>
          <p className="font-bold text-ink text-sm">{categoryLabel}</p>
          {ready && (
            <p className="text-xs text-muted mt-0.5">
              {count > 0 ? `${count} product${count === 1 ? '' : 's'}` : 'New arrivals coming soon'}
            </p>
          )}
        </div>
        <Link to={categoryTo} className="text-xs font-bold uppercase text-brand hover:text-brand-dark">
          Shop All &rarr;
        </Link>
      </div>

      {subcategories && subcategories.length > 0 && (
        <div className="grid grid-cols-2 gap-1 p-3 min-w-[320px]">
          {subcategories.map((sub) => {
            const subStats = stats?.subcategories?.[sub.slug];
            const subCount = subStats?.product_count || 0;
            return (
              <Link
                key={sub.slug}
                to={`${categoryTo}&subcategory=${sub.slug}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-surface transition-colors"
              >
                <Thumb src={subStats?.image_url} alt={sub.label} ready={ready} size="h-12 w-12" />
                <div>
                  <p className="text-sm font-semibold text-ink">{sub.label}</p>
                  {ready && (
                    <p className="text-xs text-muted">
                      {subCount > 0 ? `${subCount} product${subCount === 1 ? '' : 's'}` : 'Coming soon'}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MegaMenu;
