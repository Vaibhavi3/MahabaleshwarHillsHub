import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import ProductCard from '../components/ProductCard';
import { ProductGridSkeleton } from '../components/ProductCardSkeleton';
import toast from 'react-hot-toast';

const CollectionDetail = () => {
  const { slug } = useParams();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .getCollectionBySlug(slug)
      .then((res) => setCollection(res.data))
      .catch((error) => {
        if (error.response?.status === 404) {
          setNotFound(true);
        } else {
          toast.error('Failed to load this collection');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (notFound || !collection) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="font-bold text-ink mb-2">Collection not found</p>
        <p className="text-sm text-muted mb-5">It may have been removed or renamed.</p>
        <Link to="/products" className="btn-primary inline-block">
          Browse All Products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative bg-ink text-white bg-cover bg-center"
        style={collection.cover_image ? { backgroundImage: `url(${getImageUrl(collection.cover_image)})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/40" />
        <div className="relative container mx-auto px-4 py-14 text-center">
          <p className="uppercase tracking-[0.3em] text-brand-light font-bold text-sm mb-3">Shop the Edit</p>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">{collection.title}</h1>
          {collection.description && (
            <p className="text-sm md:text-base text-gray-200 max-w-2xl mx-auto">{collection.description}</p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {collection.products.length === 0 ? (
          <p className="text-center text-muted py-10">No products in this collection right now.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 items-start">
            {collection.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionDetail;
