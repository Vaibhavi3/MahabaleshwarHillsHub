import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useDispatch } from 'react-redux';
import { addToCart } from '../features/cartSlice';
import toast from 'react-hot-toast';

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        const productResponse = await api.getProductById(id);
        setProduct(productResponse.data);

        const reviewsResponse = await api.getProductReviews(id);
        setReviews(reviewsResponse.data);
      } catch (error) {
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
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
      toast.success('Added to cart!');
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (!product) {
    return <div className="container mx-auto px-4 py-8 text-center">Product not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <img
            src={product.image_url || 'https://via.placeholder.com/400'}
            alt={product.name}
            className="w-full rounded-lg"
          />
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
          <p className="text-gray-600 mb-4">{product.description}</p>
          <div className="flex items-center gap-4 mb-6">
            <span className="text-4xl font-bold text-purple-600">₹{product.price}</span>
            <span className="text-2xl text-yellow-500">★ {product.rating?.toFixed(1) || 'N/A'}</span>
            <span className="text-gray-600">Stock: {product.stock}</span>
          </div>
          <div className="mb-6">
            <label className="block mb-2">Quantity:</label>
            <input
              type="number"
              min="1"
              max={product.stock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="border rounded px-4 py-2 w-20"
            />
          </div>
          <button
            onClick={handleAddToCart}
            className="btn-primary w-full md:w-auto text-lg py-3 px-8"
          >
            Add to Cart
          </button>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Reviews</h2>
        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold">★ {review.rating}/5</span>
                  <span className="text-sm text-gray-600">{review.title}</span>
                </div>
                <p className="text-gray-700">{review.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No reviews yet</p>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
