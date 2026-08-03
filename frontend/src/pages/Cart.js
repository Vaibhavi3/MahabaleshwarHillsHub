import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { removeFromCart, updateCartItem, clearCart } from '../features/cartSlice';
import { getImageUrl } from '../api/axiosConfig';
import { FiTrash2 } from 'react-icons/fi';

const Cart = () => {
  const { items } = useSelector((state) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <Link to="/products" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 bg-white rounded-lg shadow p-4">
            <img
              src={getImageUrl(item.image_url) || 'https://via.placeholder.com/100'}
              alt={item.name}
              className="w-20 h-20 object-cover rounded"
            />
            <div className="flex-1">
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-purple-600 font-bold">₹{item.price}</p>
            </div>
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) =>
                dispatch(updateCartItem({ id: item.id, quantity: Math.max(1, parseInt(e.target.value) || 1) }))
              }
              className="border rounded px-3 py-1 w-16 text-center"
            />
            <span className="font-semibold w-24 text-right">₹{(item.price * item.quantity).toFixed(2)}</span>
            <button onClick={() => dispatch(removeFromCart(item.id))} className="text-red-600 hover:text-red-800">
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-md ml-auto">
        <div className="flex justify-between text-lg mb-4">
          <span>Subtotal</span>
          <span className="font-bold">₹{subtotal.toFixed(2)}</span>
        </div>
        <button onClick={() => navigate('/checkout')} className="btn-primary w-full mb-2">
          Proceed to Checkout
        </button>
        <button onClick={() => dispatch(clearCart())} className="btn-secondary w-full">
          Clear Cart
        </button>
      </div>
    </div>
  );
};

export default Cart;
