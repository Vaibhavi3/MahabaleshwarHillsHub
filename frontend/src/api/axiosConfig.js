import axios from 'axios';
import store from '../store';
import { logout } from '../features/authSlice';
import { clearWishlist } from '../features/wishlistSlice';

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

// Review photos are served from the API, not /static - build the URL from
// the photo id the review response gives us.
export const getReviewPhotoUrl = (photoId) => `${API_URL}/reviews/photos/${photoId}`;

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
      store.dispatch(clearWishlist());
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Products
  getProducts: (skip = 0, limit = 10, category = null, subcategory = null) => {
    return client.get('/products', { params: { skip, limit, category, subcategory } });
  },
  getProductsCount: (category = null, subcategory = null) => {
    return client.get('/products/count', { params: { category, subcategory } });
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
  getProductVariants: (id) => {
    return client.get(`/products/${id}/variants`);
  },
  getSimilarProducts: (id, limit = 8) => {
    return client.get(`/products/${id}/similar`, { params: { limit } });
  },
  getFrequentlyBoughtTogether: (id, limit = 4) => {
    return client.get(`/products/${id}/frequently-bought-together`, { params: { limit } });
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
  cancelOrder: (id, reason) => {
    return client.post(`/orders/${id}/cancel`, { reason });
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
  voteReviewHelpful: (reviewId) => {
    return client.post(`/reviews/${reviewId}/helpful`);
  },
  uploadReviewPhotos: (reviewId, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return client.post(`/reviews/${reviewId}/photos`, formData);
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

  // Coupons
  validateCoupon: (code, orderTotal) => {
    return client.post('/coupons/validate', { code, order_total: orderTotal });
  },
  getActiveCoupons: () => {
    return client.get('/coupons/active');
  },
  getCoupons: () => {
    return client.get('/coupons');
  },
  createCoupon: (coupon) => {
    return client.post('/coupons', coupon);
  },
  updateCoupon: (id, coupon) => {
    return client.put(`/coupons/${id}`, coupon);
  },
  deleteCoupon: (id) => {
    return client.delete(`/coupons/${id}`);
  },

  // Recommendations
  getRecommendationsForYou: (limit = 8) => {
    return client.get('/recommendations/for-you', { params: { limit } });
  },

  // Stock alerts ("notify me" when back in stock)
  getStockAlertStatus: (productId) => {
    return client.get(`/products/${productId}/notify-me`);
  },
  subscribeStockAlert: (productId) => {
    return client.post(`/products/${productId}/notify-me`);
  },
  unsubscribeStockAlert: (productId) => {
    return client.delete(`/products/${productId}/notify-me`);
  },
  getStockAlertPendingCounts: () => {
    return client.get('/stock-alerts/admin/pending-counts');
  },

  // Wishlist (account-backed, syncs across devices once logged in)
  getWishlist: () => {
    return client.get('/wishlist');
  },
  addToWishlist: (productId) => {
    return client.post(`/wishlist/${productId}`);
  },
  removeFromWishlistApi: (productId) => {
    return client.delete(`/wishlist/${productId}`);
  },
  syncWishlist: (productIds) => {
    return client.post('/wishlist/sync', { product_ids: productIds });
  },

  // Recently viewed (account-backed when logged in, browser-local for guests)
  getRecentlyViewed: (limit = 8, exclude = null) => {
    return client.get('/recently-viewed', { params: { limit, exclude } });
  },
  recordRecentlyViewed: (productId) => {
    return client.post(`/recently-viewed/${productId}`);
  },

  // Addresses
  getAddresses: () => {
    return client.get('/addresses');
  },
  createAddress: (address) => {
    return client.post('/addresses', address);
  },
  updateAddress: (id, address) => {
    return client.put(`/addresses/${id}`, address);
  },
  deleteAddress: (id) => {
    return client.delete(`/addresses/${id}`);
  },
  setDefaultAddress: (id) => {
    return client.post(`/addresses/${id}/default`);
  },

  // Returns & exchanges (self-service, within the 7-day return window)
  createReturnRequest: (orderId, itemId, payload) => {
    return client.post(`/orders/${orderId}/items/${itemId}/return-request`, payload);
  },
  getMyReturnRequests: () => {
    return client.get('/return-requests');
  },
  getAdminReturnRequests: () => {
    return client.get('/return-requests/admin/all');
  },
  updateReturnRequestStatus: (id, status) => {
    return client.put(`/return-requests/${id}`, { status });
  },

  // CRM
  getCRMOverview: () => client.get('/crm/overview'),
  getCRMCustomers: (params) => client.get('/crm/customers', { params }),
  getCRMCustomer: (id) => client.get('/crm/customers/' + id),
  getCRMLeads: (params) => client.get('/crm/leads', { params }),
  createCRMLead: (lead) => client.post('/crm/leads', lead),
  updateCRMLead: (id, lead) => client.patch('/crm/leads/' + id, lead),
  getCRMActivities: (params) => client.get('/crm/activities', { params }),
  createCRMActivity: (activity) => client.post('/crm/activities', activity),
  updateCRMActivity: (id, activity) => client.patch('/crm/activities/' + id, activity),
};

export default api;
