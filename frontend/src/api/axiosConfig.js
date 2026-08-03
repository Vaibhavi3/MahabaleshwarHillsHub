import axios from 'axios';
import store from '../store';
import { logout } from '../features/authSlice';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const ASSET_BASE_URL = API_URL.replace(/\/api\/?$/, '');

// Product image_url values from the API are backend-relative paths
// (e.g. /static/products/...) - resolve them against the backend origin,
// not whatever origin the frontend happens to be served from.
export const getImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${ASSET_BASE_URL}${path}`;
};

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Products
  getProducts: (skip = 0, limit = 10, category = null) => {
    return client.get('/products', { params: { skip, limit, category } });
  },
  getProductById: (id) => {
    return client.get(`/products/${id}`);
  },
  searchProducts: (query) => {
    return client.get('/products/search', { params: { q: query } });
  },
  getCategories: () => {
    return client.get('/categories');
  },
  createProduct: (product) => {
    return client.post('/products', product);
  },
  updateProduct: (id, product) => {
    return client.put(`/products/${id}`, product);
  },
  deleteProduct: (id) => {
    return client.delete(`/products/${id}`);
  },

  // Auth
  register: (userData) => {
    return client.post('/auth/register', userData);
  },
  login: (credentials) => {
    return client.post('/auth/login', credentials);
  },
  getCurrentUser: () => {
    return client.get('/auth/me');
  },

  // Cart
  getCart: () => {
    return client.get('/cart');
  },
  addToCart: (cartItem) => {
    return client.post('/cart/add', cartItem);
  },
  updateCartItem: (itemId, quantity) => {
    return client.put(`/cart/${itemId}`, { quantity });
  },
  removeFromCart: (itemId) => {
    return client.delete(`/cart/${itemId}`);
  },
  clearCart: () => {
    return client.delete('/cart');
  },

  // Orders
  createOrder: (orderData) => {
    return client.post('/orders', orderData);
  },
  getOrders: () => {
    return client.get('/orders');
  },
  getOrderById: (id) => {
    return client.get(`/orders/${id}`);
  },
  updateOrder: (id, orderUpdate) => {
    return client.put(`/orders/${id}`, orderUpdate);
  },
  getAllOrders: (skip = 0, limit = 100) => {
    return client.get('/orders/admin/all', { params: { skip, limit } });
  },

  // Reviews
  getProductReviews: (productId) => {
    return client.get(`/products/${productId}/reviews`);
  },
  createReview: (reviewData) => {
    return client.post('/reviews', reviewData);
  },

  // Payments - Stripe
  createPaymentIntent: (orderId) => {
    return client.post('/payments/create-payment-intent', null, { params: { order_id: orderId } });
  },
  confirmPayment: (orderId, paymentIntentId) => {
    return client.post('/payments/confirm', null, {
      params: { order_id: orderId, payment_intent_id: paymentIntentId },
    });
  },

  // Payments - Razorpay
  createRazorpayOrder: (orderId) => {
    return client.post('/payments/razorpay/create-order', null, { params: { order_id: orderId } });
  },
  verifyRazorpayPayment: (params) => {
    return client.post('/payments/razorpay/verify', null, { params });
  },

  getPaymentStatus: (orderId) => {
    return client.get(`/payments/${orderId}`);
  },
};

export default api;
