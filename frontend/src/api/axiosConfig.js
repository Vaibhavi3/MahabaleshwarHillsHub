import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  // Products
  getProducts: (skip = 0, limit = 10, category = null) => {
    return axios.get(`${API_URL}/products`, {
      params: { skip, limit, category },
    });
  },
  getProductById: (id) => {
    return axios.get(`${API_URL}/products/${id}`);
  },
  searchProducts: (query) => {
    return axios.get(`${API_URL}/products/search`, { params: { q: query } });
  },
  getCategories: () => {
    return axios.get(`${API_URL}/categories`);
  },

  // Auth
  register: (userData) => {
    return axios.post(`${API_URL}/auth/register`, userData);
  },
  login: (credentials) => {
    return axios.post(`${API_URL}/auth/login`, credentials);
  },
  getCurrentUser: () => {
    return axios.get(`${API_URL}/auth/me`, {
      headers: getAuthHeader(),
    });
  },

  // Cart
  getCart: () => {
    return axios.get(`${API_URL}/cart`, {
      headers: getAuthHeader(),
    });
  },
  addToCart: (cartItem) => {
    return axios.post(`${API_URL}/cart/add`, cartItem, {
      headers: getAuthHeader(),
    });
  },
  updateCartItem: (itemId, quantity) => {
    return axios.put(`${API_URL}/cart/${itemId}`, { quantity }, {
      headers: getAuthHeader(),
    });
  },
  removeFromCart: (itemId) => {
    return axios.delete(`${API_URL}/cart/${itemId}`, {
      headers: getAuthHeader(),
    });
  },
  clearCart: () => {
    return axios.delete(`${API_URL}/cart`, {
      headers: getAuthHeader(),
    });
  },

  // Orders
  createOrder: (orderData) => {
    return axios.post(`${API_URL}/orders`, orderData, {
      headers: getAuthHeader(),
    });
  },
  getOrders: () => {
    return axios.get(`${API_URL}/orders`, {
      headers: getAuthHeader(),
    });
  },
  getOrderById: (id) => {
    return axios.get(`${API_URL}/orders/${id}`, {
      headers: getAuthHeader(),
    });
  },

  // Reviews
  getProductReviews: (productId) => {
    return axios.get(`${API_URL}/products/${productId}/reviews`);
  },
  createReview: (reviewData) => {
    return axios.post(`${API_URL}/reviews`, reviewData, {
      headers: getAuthHeader(),
    });
  },

  // Payments
  createPaymentIntent: (orderId) => {
    return axios.post(`${API_URL}/payments/create-payment-intent`, { order_id: orderId }, {
      headers: getAuthHeader(),
    });
  },
  confirmPayment: (orderId, paymentIntentId) => {
    return axios.post(
      `${API_URL}/payments/confirm`,
      { order_id: orderId, payment_intent_id: paymentIntentId },
      {
        headers: getAuthHeader(),
      }
    );
  },
};

export default api;
