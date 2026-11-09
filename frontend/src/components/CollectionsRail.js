import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';

/**
 * Homepage "Shop the Edit" rail - admin-curated collections of real
 * catalogue products, inspired by Myntra/Ajio/Nykaa's curated edit/trend
 * landing pages. Renders nothing until the store owner has actually
 * created at least one non-empty collection in the admin dashboard, so
 * there's never an empty or placeholder section on the live site.
 */
const CollectionsRail = () => {
  const [collections, setCollections] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getCollections()
      .then((res) => setCollections(res.data))
      .catch(() => setCollections([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || collections.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-12 border-t border-gray-100">
      <h2 className="text-xl md:text-2xl font-extrabold mb-8 text-ink">Shop the Edit</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            to={`/collections/${collection.slug}`}
            className="group relative shrink-0 w-64 sm:w-72 rounded-lg overflow-hidden aspect-[4/3] bg-surface snap-start"
          >
            {collection.cover_image ? (
              <img
                src={getImageUrl(collection.cover_image)}
                alt={collection.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full bg-brand-light/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-white text-lg font-extrabold">{collection.title}</h3>
              <span className="text-white text-xs font-semibold uppercase tracking-wide underline underline-offset-2">
                Shop the Edit
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default CollectionsRail;
