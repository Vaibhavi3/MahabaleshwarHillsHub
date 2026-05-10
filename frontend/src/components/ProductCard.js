import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { useDispatch } from 'react-redux';
import { addToCart } from '../features/cartSlice';
import toast from 'react-hot-toast';

const ProductCard = ({ product }) => {
  const dispatch = useDispatch();
  const [rating, setRating] = useState(0);

  useEffect(() => {
    setRating(product.rating || 0);
  }, [product]);

  const handleAddToCart = () => {
    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity: 1,
      })
    );
    toast.success('Added to cart!');
  };

  return (
    <div className="product-card bg-white rounded-lg overflow-hidden">
      <div className="aspect-square bg-gray-200 overflow-hidden">
        <img
          src={product.image_url || 'https://via.placeholder.com/300'}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {product.description}
        </p>
        <div className="flex justify-between items-center mb-3">
          <span className="text-2xl font-bold text-purple-600">₹{product.price}</span>
          <span className="text-yellow-500">★ {rating.toFixed(1)}</span>
        </div>
        <button
          onClick={handleAddToCart}
          className="w-full btn-primary text-sm"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
