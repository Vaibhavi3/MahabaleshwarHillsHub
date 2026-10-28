import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../features/cartSlice';
import { openCartDrawer } from '../features/uiSlice';
import { setWishlistItems, mapWishlistResponse } from '../features/wishlistSlice';
import { requireAuth } from '../utils/requireAuth';
import ProductCard from '../components/ProductCard';
import FrequentlyBoughtTogether from '../components/FrequentlyBoughtTogether';
import CompleteTheLook from '../components/CompleteTheLook';
import ZoomableImage from '../components/ZoomableImage';
import ReviewsSection from '../components/ReviewsSection';
import QnASection from '../components/QnASection';
import OffersList from '../components/OffersList';
import RecentlyViewed, { recordProductView } from '../components/RecentlyViewed';
import SizeGuideModal from '../components/SizeGuideModal';
import { FiHeart, FiTruck, FiShield, FiRefreshCw, FiBell, FiCheck, FiMaximize } from 'react-icons/fi';
import { parseProductSize } from '../utils/sizeGuide';
import toast from 'react-hot-toast';

const BRAND = 'Ancles Home Socks';

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [variants, setVariants] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [frequentlyBought, setFrequentlyBought] = useState([]);
  const [completeTheLook, setCompleteTheLook] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pincode, setPincode] = useState('');
  const [pincodeMsg, setPincodeMsg] = useState('');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const buyBoxObserverRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useSelector((state) => state.auth);
  const wishlistItems = useSelector((state) => state.wishlist.items);
  const wishlisted = product ? wishlistItems.some((item) => item.id === product.id) : false;

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      try {
        const productResponse = await api.getProductById(id);
        setProduct(productResponse.data);
        setActiveImage(0);
        recordProductView(productResponse.data.id, token);

        const [reviewsResponse, variantsResponse, similarResponse, fbtResponse, questionsResponse] = await Promise.all([
          api.getProductReviews(id),
          api.getProductVariants(id),
          api.getSimilarProducts(id),
          api.getFrequentlyBoughtTogether(id),
          api.getProductQuestions(id),
        ]);
        setReviews(reviewsResponse.data);
        setVariants(variantsResponse.data);
        setSimilar(similarResponse.data);
        setFrequentlyBought(fbtResponse.data);
        setQuestions(questionsResponse.data);

        // Kept outside the Promise.all above: this is a new endpoint, so
        // while the API deploy is still catching up to this frontend build
        // (e.g. a PR preview running against the live backend), a 404 here
        // should only skip this one section, not fail the whole product page.
        try {
          const lookResponse = await api.getCompleteTheLook(id);
          setCompleteTheLook(lookResponse.data);
        } catch {
          setCompleteTheLook([]);
        }

        if (productResponse.data.stock <= 0) {
          try {
            const statusResponse = await api.getStockAlertStatus(id);
            setNotifySubscribed(statusResponse.data.subscribed);
          } catch {
            setNotifySubscribed(false);
          }
        } else {
          setNotifySubscribed(false);
        }
      } catch (error) {
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Callback ref (not a plain ref + effect): the buy box only mounts once
  // loading finishes, on a later render than the one that sets `product`,
  // so an effect keyed on `product` would attach before the node exists.
  const buyBoxRef = useCallback((node) => {
    if (buyBoxObserverRef.current) {
      buyBoxObserverRef.current.disconnect();
      buyBoxObserverRef.current = null;
    }
    if (node) {
      const observer = new IntersectionObserver(
        ([entry]) => setShowStickyBar(!entry.isIntersecting),
        { rootMargin: '-64px 0px 0px 0px' }
      );
      observer.observe(node);
      buyBoxObserverRef.current = observer;
    }
  }, []);

  useEffect(() => () => buyBoxObserverRef.current && buyBoxObserverRef.current.disconnect(), []);

  const handleAddToCart = () => {
    if (product && product.stock > 0) {
      if (!requireAuth(token, navigate, location, 'Please login or register to add items to your bag')) return;
      dispatch(
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          image_url: product.image_url,
          stock: product.stock,
          category: product.category,
          quantity: parseInt(quantity),
        })
      );
      dispatch(openCartDrawer());
    }
  };

  const handleWishlist = async () => {
    if (!product) return;
    if (!requireAuth(token, navigate, location, 'Please login or register to save items to your wishlist')) return;
    try {
      const response = wishlisted
        ? await api.removeFromWishlistApi(product.id)
        : await api.addToWishlist(product.id);
      dispatch(setWishlistItems(mapWishlistResponse(response.data)));
      toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (error) {
      toast.error('Could not update wishlist. Please try again.');
    }
  };

  const handleNotifyMe = async () => {
    if (!product || notifyBusy) return;
    if (!requireAuth(token, navigate, location, "Please login to get notified when this item's back")) return;
    setNotifyBusy(true);
    try {
      if (notifySubscribed) {
        await api.unsubscribeStockAlert(product.id);
        setNotifySubscribed(false);
        toast.success("We won't notify you for this item");
      } else {
        await api.subscribeStockAlert(product.id);
        setNotifySubscribed(true);
        toast.success("We'll email you when it's back in stock");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Something went wrong, please try again');
    } finally {
      setNotifyBusy(false);
    }
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
    return (
      <div className="container mx-auto px-4 py-8 animate-pulse">
        <div className="h-3 bg-surface rounded w-1/3 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="flex gap-4 items-start">
            <div className="hidden sm:flex flex-col gap-3 shrink-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-16 h-16 rounded bg-surface" />
              ))}
            </div>
            <div className="flex-1 aspect-[3/4] bg-surface rounded" />
          </div>
          <div>
            <div className="h-5 bg-surface rounded w-1/3 mb-3" />
            <div className="h-4 bg-surface rounded w-2/3 mb-6" />
            <div className="h-8 bg-surface rounded w-1/4 mb-6" />
            <div className="h-11 bg-surface rounded w-full mb-3" />
            <div className="h-11 bg-surface rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="container mx-auto px-4 py-8 text-center text-muted">Product not found</div>;
  }

  const avgRating = product.rating || 0;
  const gallery = product.images && product.images.length > 0 ? product.images : [product.image_url];
  const shownImage = gallery[Math.min(activeImage, gallery.length - 1)];
  const discountPct =
    product.mrp && product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const sizeInfo = parseProductSize(product);
  const sizeDisplay =
    sizeInfo.kind === 'footwear' && sizeInfo.tokens.length > 0
      ? `${sizeInfo.tokens.join(', ')} (EU)`
      : sizeInfo.kind === 'kids' && sizeInfo.tokens.length > 0
      ? `${sizeInfo.tokens.join(', ')} yrs`
      : sizeInfo.kind === 'sock' && sizeInfo.tokens.length > 0
      ? `One Size (~${sizeInfo.tokens.join('cm, ~')}cm)`
      : product.size || 'One Size';

  return (
    <div className={`container mx-auto px-4 py-8 ${showStickyBar ? 'pb-24 md:pb-8' : ''}`}>
      <p className="text-xs text-muted uppercase tracking-wide mb-6">
        Home / {product.category} / <span className="text-ink">{product.name}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <div className="flex gap-4 items-start">
            {gallery.length > 1 && (
              <div className="hidden sm:flex flex-col gap-3 shrink-0 max-h-[640px] overflow-y-auto pr-1">
                {gallery.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    onMouseEnter={() => setActiveImage(i)}
                    aria-label={`View image ${i + 1}`}
                    className={`w-16 h-16 shrink-0 rounded overflow-hidden border-2 bg-surface ${
                      i === activeImage ? 'border-brand' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={getImageUrl(src)} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 bg-surface">
              <ZoomableImage src={getImageUrl(shownImage)} alt={product.name} />
            </div>
          </div>
          {gallery.length > 1 && (
            <div className="sm:hidden flex gap-2 overflow-x-auto mt-3 pb-1">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`w-16 h-16 shrink-0 rounded overflow-hidden border-2 bg-surface ${
                    i === activeImage ? 'border-brand' : 'border-transparent'
                  }`}
                >
                  <img src={getImageUrl(src)} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-extrabold text-lg text-ink">{BRAND}</h4>
          <h1 className="text-base text-muted mb-1">{product.name}</h1>
          {product.sku && <p className="text-xs text-muted mb-3">SKU: {product.sku}</p>}

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
            {discountPct > 0 && (
              <>
                <span className="text-lg text-muted line-through">MRP ₹{product.mrp}</span>
                <span className="text-lg font-bold text-orange-500">({discountPct}% OFF)</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted mb-1">inclusive of all taxes</p>
          {outOfStock ? (
            <p className="text-sm font-bold text-red-600 mb-6">Out of Stock</p>
          ) : lowStock ? (
            <p className="text-sm font-bold text-brand mb-6">Hurry! Only {product.stock} left</p>
          ) : (
            <div className="mb-6" />
          )}

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

          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink">
            <span className="font-bold uppercase">Size: <span className="font-normal">{sizeDisplay}</span></span>
            <button
              type="button"
              onClick={() => setSizeGuideOpen(true)}
              className="flex items-center gap-1 text-brand text-xs font-bold uppercase hover:underline"
            >
              <FiMaximize size={14} /> Size Guide
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase">Qty:</span>
              <input
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={outOfStock}
                className="border border-gray-300 rounded px-3 py-1.5 w-16 disabled:opacity-50"
              />
            </div>
          </div>

          <div ref={buyBoxRef} className={`flex flex-col sm:flex-row gap-3 ${outOfStock ? 'mb-2' : 'mb-8'}`}>
            {outOfStock ? (
              <button
                onClick={handleNotifyMe}
                disabled={notifyBusy}
                className={`flex-1 py-3.5 text-base flex items-center justify-center gap-2 rounded font-bold uppercase tracking-wide disabled:opacity-60 ${
                  notifySubscribed
                    ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600'
                    : 'btn-primary'
                }`}
              >
                {notifySubscribed ? <FiCheck /> : <FiBell />}
                {notifySubscribed ? "We'll Notify You" : 'Notify Me When Available'}
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                className="btn-primary flex-1 py-3.5 text-base"
              >
                Add to Bag
              </button>
            )}
            <button
              onClick={handleWishlist}
              className="btn-secondary flex-1 py-3.5 text-base flex items-center justify-center gap-2"
            >
              <FiHeart className={wishlisted ? 'text-brand fill-current' : ''} />
              {wishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>
          </div>
          {outOfStock && (
            <p className="text-xs text-muted mb-8">
              {notifySubscribed
                ? "You're on the list - we'll email you the moment it's restocked."
                : "This piece is handmade in small batches and currently sold out. We'll email you the moment more are ready."}
            </p>
          )}

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

          <OffersList />

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

      <CompleteTheLook items={completeTheLook} />

      {frequentlyBought.length > 0 && (
        <FrequentlyBoughtTogether baseProduct={product} items={frequentlyBought} />
      )}

      {similar.length > 0 && (
        <div className="mt-16">
          <h2 className="text-xl font-extrabold text-ink mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8 items-start">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      <RecentlyViewed excludeId={product.id} />

      <ReviewsSection productId={product.id} reviews={reviews} setReviews={setReviews} />

      <QnASection productId={product.id} questions={questions} setQuestions={setQuestions} />

      {sizeGuideOpen && <SizeGuideModal product={product} onClose={() => setSizeGuideOpen(false)} />}

      {showStickyBar && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(40,44,63,0.1)] px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink truncate">₹{product.price}</p>
            {outOfStock ? (
              <p className="text-xs font-bold text-red-600">Out of Stock</p>
            ) : lowStock ? (
              <p className="text-xs font-bold text-brand">Only {product.stock} left</p>
            ) : (
              <p className="text-xs text-muted">Free Shipping</p>
            )}
          </div>
          {outOfStock ? (
            <button
              onClick={handleNotifyMe}
              disabled={notifyBusy}
              className={`px-6 py-3 rounded font-bold uppercase tracking-wide flex items-center gap-2 disabled:opacity-60 ${
                notifySubscribed
                  ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600'
                  : 'btn-primary'
              }`}
            >
              {notifySubscribed ? <FiCheck /> : <FiBell />}
              {notifySubscribed ? 'Notified' : 'Notify Me'}
            </button>
          ) : (
            <button onClick={handleAddToCart} className="btn-primary px-8 py-3">
              Add to Bag
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
