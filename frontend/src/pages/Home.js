import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { slug: 'socks', label: 'Home Socks', blurb: 'Soft, cozy, handmade comfort for every day' },
  { slug: 'slidders', label: 'Home Slidders', blurb: 'Doctor-soft slip-ons for around the house' },
  { slug: 'bags', label: 'Handmade Bags', blurb: 'Crochet & cane bags, woven by hand' },
];

const Home = () => {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.getProducts(0, 8);
        setFeatured(response.data);
      } catch (error) {
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <section className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Mahabaleshwar Hills Hub</h1>
          <p className="text-lg md:text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Handmade socks, slidders &amp; bags crafted by Mahabaleshwar artisans - cozy, colourful, made to last.
          </p>
          <Link
            to="/products"
            className="inline-block bg-white text-purple-700 font-semibold px-8 py-3 rounded-lg hover:bg-purple-50 transition"
          >
            Shop Now
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Shop by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              to={`/products?category=${cat.slug}`}
              className="block bg-white rounded-lg shadow-md p-8 text-center hover:shadow-xl transition"
            >
              <h3 className="text-xl font-semibold mb-2">{cat.label}</h3>
              <p className="text-gray-600 text-sm">{cat.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Featured Products</h2>
        {loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
