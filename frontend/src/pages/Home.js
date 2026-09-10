import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';
import { FiTruck, FiRefreshCw, FiShield, FiHeart } from 'react-icons/fi';

const CATEGORIES = [
  { slug: 'socks', label: 'Home Socks' },
  { slug: 'slidders', label: 'Home Slidders' },
  { slug: 'bags', label: 'Handmade Bags' },
];

const TRUST_BADGES = [
  { icon: FiTruck, label: 'Free Shipping', detail: 'On every order, pan-India' },
  { icon: FiHeart, label: '100% Handmade', detail: 'Crafted by local artisans' },
  { icon: FiShield, label: 'Secure Payments', detail: 'Cards & UPI, fully encrypted' },
  { icon: FiRefreshCw, label: 'Easy Returns', detail: '7-day hassle-free returns' },
];

const FEATURES = [
  {
    title: 'Ultra-Soft Plush Comfort',
    detail: 'Every pair is knit from ultra-soft plush yarn, designed to keep your feet cozy through the coldest months.',
  },
  {
    title: 'Anti-Slip, All-Day Safety',
    detail: 'Grippy anti-slip soles on every sock and slidder, so comfort never comes at the cost of stability.',
  },
  {
    title: 'Hand-Finished Craftsmanship',
    detail: 'Hand-finished by artisans in Mahabaleshwar - no two batches are quite the same, and that’s the charm.',
  },
];

const Home = () => {
  const [bestsellers, setBestsellers] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [categoryThumbs, setCategoryThumbs] = useState({});
  const [loading, setLoading] = useState(true);
  const [catalogSize, setCatalogSize] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [bestsellersRes, newArrivalsRes, countRes, ...categoryResponses] = await Promise.all([
          api.getProducts(0, 8),
          api.getProducts(8, 8),
          api.getProductsCount(),
          ...CATEGORIES.map((cat) => api.getProducts(0, 1, cat.slug)),
        ]);
        setBestsellers(bestsellersRes.data);
        setNewArrivals(newArrivalsRes.data);
        setCatalogSize(countRes.data.total);

        const thumbs = {};
        CATEGORIES.forEach((cat, i) => {
          const thumb = categoryResponses[i]?.data?.[0]?.image_url;
          if (thumb) thumbs[cat.slug] = thumb;
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

  const visibleCategories = loading ? CATEGORIES : CATEGORIES.filter((cat) => categoryThumbs[cat.slug]);

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
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs md:text-sm font-semibold uppercase tracking-wide text-gray-300">
            {catalogSize > 0 && <span>{catalogSize}+ Handmade Designs</span>}
            <span className="hidden sm:inline text-gray-500">•</span>
            <span>Pan-India Delivery</span>
            <span className="hidden sm:inline text-gray-500">•</span>
            <span>Secure Checkout</span>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-100">
        <div className="container mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {TRUST_BADGES.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex flex-col items-center text-center gap-2">
              <div className="w-11 h-11 rounded-full bg-brand/10 flex items-center justify-center">
                <Icon className="text-brand" size={20} />
              </div>
              <p className="font-bold text-sm text-ink">{label}</p>
              <p className="text-xs text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-xl md:text-2xl font-extrabold mb-8 text-ink">Shop by Category</h2>
        <div className={`grid grid-cols-1 gap-6 ${visibleCategories.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {visibleCategories.map((cat) => (
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

      <section className="bg-surface">
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-xl md:text-2xl font-extrabold mb-8 text-ink text-center">Why You&rsquo;ll Love It</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-lg p-6 text-center shadow-sm">
                <h3 className="font-extrabold text-ink mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-brand to-brand-dark">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white text-center md:text-left">
          <div className="flex items-center gap-4">
            <FiHeart className="hidden sm:block shrink-0" size={32} />
            <div>
              <p className="uppercase tracking-[0.3em] font-bold text-xs mb-1">Made By Hand</p>
              <h3 className="text-2xl md:text-3xl font-extrabold">Every Pair, Hand-Finished With Love</h3>
            </div>
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
