import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { slug: 'socks', label: 'Home Socks' },
  { slug: 'slidders', label: 'Home Slidders' },
  { slug: 'bags', label: 'Handmade Bags' },
];

const Home = () => {
  const [bestsellers, setBestsellers] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [categoryThumbs, setCategoryThumbs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [bestsellersRes, newArrivalsRes, ...categoryResponses] = await Promise.all([
          api.getProducts(0, 8),
          api.getProducts(8, 8),
          ...CATEGORIES.map((cat) => api.getProducts(0, 1, cat.slug)),
        ]);
        setBestsellers(bestsellersRes.data);
        setNewArrivals(newArrivalsRes.data);

        const thumbs = {};
        CATEGORIES.forEach((cat, i) => {
          thumbs[cat.slug] = categoryResponses[i]?.data?.[0]?.image_url;
        });
        setCategoryThumbs(thumbs);
      } catch (error) {
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-r from-ink to-[#3d4159] text-white">
        <div className="container mx-auto px-4 py-16 md:py-24 text-center">
          <p className="uppercase tracking-[0.3em] text-brand-light font-bold text-sm mb-3">
            Winter Comfort Edit
          </p>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
            Cozy Feet, All Season
          </h1>
          <p className="text-base md:text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Handmade socks, slidders &amp; bags crafted by Mahabaleshwar artisans - soft, colourful,
            made to last.
          </p>
          <Link to="/products" className="btn-primary text-base px-10 py-3.5 inline-block">
            Shop Now
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-xl md:text-2xl font-extrabold mb-8 text-ink">Shop by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              to={`/products?category=${cat.slug}`}
              className="group relative rounded-lg overflow-hidden aspect-[4/3] bg-surface"
            >
              {categoryThumbs[cat.slug] && (
                <img
                  src={getImageUrl(categoryThumbs[cat.slug])}
                  alt={cat.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="text-white text-lg font-extrabold">{cat.label}</h3>
                <span className="text-white text-xs font-semibold uppercase tracking-wide underline underline-offset-2">
                  Shop Now
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-brand">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white text-center md:text-left">
          <div>
            <p className="uppercase tracking-[0.3em] font-bold text-xs mb-1">Made By Hand</p>
            <h3 className="text-2xl md:text-3xl font-extrabold">Every Pair, Hand-Finished With Love</h3>
          </div>
          <Link
            to="/products"
            className="bg-white text-brand font-bold uppercase text-sm tracking-wide px-8 py-3 rounded whitespace-nowrap"
          >
            Explore All
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl md:text-2xl font-extrabold text-ink">Bestsellers</h2>
          <Link to="/products" className="text-brand font-semibold text-sm uppercase tracking-wide hover:underline">
            View All
          </Link>
        </div>
        {loading ? (
          <div className="text-center text-muted py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {bestsellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-12 border-t border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl md:text-2xl font-extrabold text-ink">New Arrivals</h2>
          <Link to="/products" className="text-brand font-semibold text-sm uppercase tracking-wide hover:underline">
            View All
          </Link>
        </div>
        {loading ? (
          <div className="text-center text-muted py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
