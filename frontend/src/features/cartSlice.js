import { createSlice } from '@reduxjs/toolkit';

// The cart is account-backed (see backend/app/routes/cart.py), the same
// way the wishlist already is. Adds/updates/removes still happen here
// first for an instant, offline-tolerant UI (see cartSyncMiddleware,
// which mirrors them to the account in the background), and
// setCartItems replaces the whole list with the account's merged,
// server-side cart right after login.
export const mapCartResponse = (data) =>
  data.map((entry) => ({
    id: entry.product.id,
    name: entry.product.name,
    price: entry.product.price,
    mrp: entry.product.mrp,
    image_url: entry.product.image_url,
    stock: entry.product.stock,
    category: entry.product.category,
    quantity: entry.quantity,
  }));

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: JSON.parse(localStorage.getItem('cartItems')) || [],
    totalPrice: 0,
    couponCode: null,
    discountAmount: 0,
  },
  reducers: {
    applyCoupon: (state, action) => {
      state.couponCode = action.payload.couponCode;
      state.discountAmount = action.payload.discountAmount;
    },
    removeCoupon: (state) => {
      state.couponCode = null;
      state.discountAmount = 0;
    },
    addToCart: (state, action) => {
      const existingItem = state.items.find(
        (item) => item.id === action.payload.id
      );
      if (existingItem) {
        existingItem.quantity += action.payload.quantity || 1;
      } else {
        state.items.push({ ...action.payload, quantity: action.payload.quantity || 1 });
      }
      localStorage.setItem('cartItems', JSON.stringify(state.items));
      state.totalPrice = state.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      localStorage.setItem('cartItems', JSON.stringify(state.items));
      state.totalPrice = state.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
    },
    updateCartItem: (state, action) => {
      const item = state.items.find((item) => item.id === action.payload.id);
      if (item) {
        item.quantity = action.payload.quantity;
      }
      localStorage.setItem('cartItems', JSON.stringify(state.items));
      state.totalPrice = state.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
    },
    clearCart: (state) => {
      state.items = [];
      state.totalPrice = 0;
      state.couponCode = null;
      state.discountAmount = 0;
      localStorage.removeItem('cartItems');
    },
    setCartItems: (state, action) => {
      state.items = action.payload;
      localStorage.setItem('cartItems', JSON.stringify(state.items));
      state.totalPrice = state.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
    },
  },
});

export const { addToCart, removeFromCart, updateCartItem, clearCart, applyCoupon, removeCoupon, setCartItems } =
  cartSlice.actions;
export default cartSlice.reducer;
