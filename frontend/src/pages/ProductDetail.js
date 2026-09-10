import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../features/cartSlice';
import { toggleWishlist } from '../features/wishlistSlice';
import ProductCard from '../components/ProductCard';
import { FiHeart, FiTruck, FiShield, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

const BRAND = 'Ancles Home Socks';

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [variants, setVariants] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pincode, setPincode] = useState('');
  const [pincodeMsg, setPincodeMsg] = useState('');
  const dispatch = useDispatch();
  const wishlistItems = useSelector((state) => state.wishlist.items);
  const wishlisted = product ? wishlistItems.some((item) => item.id === product.id) : false;

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      try {
        const productResponse = await api.getProductById(id);
        setProduct(productResponse.data);

        const [reviewsResponse, variantsResponse, similarResponse] = await Promise.all([
          api.getProductReviews(id),
          api.getProductVariants(id),
          api.getSimilarProducts(id),
        ]);
        setReviews(reviewsResponse.data);
        setVariants(variantsResponse.data);
        setSimilar(similarResponse.data);
      } catch (error) {
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
    window.scrollTo({ top: 0 });
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      dispatch(
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          image_url: product.image_url,
          quantity: parseInt(quantity),
        })
      );
      toast.success('Added to bag');
    }
  };

  const handleWishlist = () => {
    if (!product) return;
    dispatch(
      toggleWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
      })
    );
    toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const handleCheckPincode = (e) => {
    e.preventDefault();
    if (/^\d{6}$/.test(pincode)) {
      setPincodeMsg('Delivery available - usually arrives in 4-6 business days.');
    } else {
      setPincodeMsg('Please enter a valid 6-digit pincode.');
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-muted">Loading...</div>;
  }

  if (!product) {
    return <div className="container mx-auto px-4 py-8 text-center text-muted">Product not found</div>;
  }

  const avgRating = product.rating || 0;
  const thumbs = [product, ...variants];

  return (
    <div className="container mx-auto px-4 py-8">
      <p className="text-xs text-muted uppercase tracking-wide mb-6">
        Home / {product.category} / <span className="text-ink">{product.name}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="flex gap-4">
          <div className="hidden sm:flex flex-col gap-3 shrink-0">
            {thumbs.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                to={`/products/${t.id}`}
                className={`w-16 h-16 rounded overflow-hidden border-2 bg-surface ${
                  t.id === product.id ? 'border-brand' : 'border-transparent hover:border-gray-300'
                }`}
              >
                <img
                  src={getImageUrl(t.image_url) || 'https://via.placeholder.com/64'}
                  alt={t.color}
                  className="w-full h-full object-contain"
                />
              </Link>
            ))}
          </div>
          <div className="flex-1 bg-surface rounded overflow-hidden aspect-square">
            <img
              src={getImageUrl(product.image_url) || 'https://via.placeholder.com/500'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div>
          <h4 className="font-extrabold text-lg text-ink">{BRAND}</h4>
          <h1 className="text-base text-muted mb-3">{product.name}</h1>

          {avgRating > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center gap-1 bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">
                {avgRating.toFixed(1)} ★
              </span>
              <span className="text-sm text-muted">{reviews.length} Reviews</span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-3xl font-extrabold text-ink">₹{product.price}</span>
          </div>
          <p className="text-xs text-muted mb-6">inclusive of all taxes</p>

          {variants.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-bold text-ink uppercase mb-2">
                Colour: <span className="font-normal normal-case text-muted">{product.color}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/products/${product.id}`}
                  title={product.color}
                  className="w-14 h-14 rounded-lg overflow-hidden border-2 border-brand ring-2 ring-brand-light bg-surface"
                >
                  <img
                    src={getImageUrl(product.image_url) || 'https://via.placeholder.com/60'}
                    alt={product.color}
                    className="w-full h-full object-contain"
                  />
                </Link>
                {variants.map((v) => (
                  <Link
                    key={v.id}
                    to={`/products/${v.id}`}
                    title={v.color}
                    className="w-14 h-14 rounded-lg overflow-hidden border-2 border-transparent hover:border-gray-300 bg-surface"
                  >
                    <img
                      src={getImageUrl(v.image_url) || 'https://via.placeholder.com/60'}
                      alt={v.color}
                      className="w-full h-full object-contain"
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6 flex items-center gap-6 text-sm text-ink">
            <span className="font-bold uppercase">Size: <span className="font-normal">{product.size || 'One Size'}</span></span>
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase">Qty:</span>
              <input
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 w-16"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <button onClick={handleAddToCart} className="btn-primary flex-1 py-3.5 text-base">
              Add to Bag
            </button>
            <button
              onClick={handleWishlist}
              className="btn-secondary flex-1 py-3.5 text-base flex items-center justify-center gap-2"
            >
              <FiHeart className={wishlisted ? 'text-brand fill-current' : ''} />
              {wishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>
          </div>

          <form onSubmit={handleCheckPincode} className="mb-8">
            <p className="text-sm font-bold text-ink uppercase mb-2">Check Delivery</p>
            <div className="flex gap-3">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter pincode"
                className="border border-gray-300 rounded px-4 py-2 text-sm w-40"
              />
              <button type="submit" className="text-brand font-bold text-sm uppercase hover:underline">
                Check
              </button>
            </div>
            {pincodeMsg && <p className="text-sm text-muted mt-2">{pincodeMsg}</p>}
          </form>

          <div className="border-t border-gray-200 pt-6 grid grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center gap-2 text-xs text-muted">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                <FiTruck size={18} className="text-brand" />
              </div>
              Free Shipping
            </div>
            <div className="flex flex-col items-center gap-2 text-xs text-muted">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                <FiRefreshCw size={18} className="text-brand" />
              </div>
              Easy Returns
            </div>
            <div className="flex flex-col items-center gap-2 text-xs text-muted">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                <FiShield size={18} className="text-brand" />
              </div>
              Secure Payment
            </div>
          </div>

          <div className="border-t border-gray-200 mt-8 pt-6">
            <p className="text-sm font-bold text-ink uppercase mb-2">Product Details</p>
            <p className="text-sm text-ink leading-relaxed mb-3">{product.description}</p>
            <ul className="text-sm text-muted space-y-1">
              <li>Material: {product.material || 'Soft Cotton Fur'}</li>
              <li>Stock: {product.stock} available</li>
            </ul>
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-16">
          <h2 className="text-xl font-extrabold text-ink mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 border-t border-gray-200 pt-8">
        <h2 className="text-xl font-extrabold text-ink mb-6">Ratings &amp; Reviews</h2>
        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border border-gray-200 rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="flex items-center gap-1 bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {review.rating} ★
                  </span>
                  <span className="text-sm font-semibold text-ink">{review.title}</span>
                </div>
                <p className="text-gray-700 text-sm">{review.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm">No reviews yet</p>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
