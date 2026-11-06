import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';
import cartReducer from './features/cartSlice';
import productReducer from './features/productSlice';
import wishlistReducer from './features/wishlistSlice';
import uiReducer from './features/uiSlice';
import cartSyncMiddleware from './store/cartSyncMiddleware';

const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    products: productReducer,
    wishlist: wishlistReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(cartSyncMiddleware),
});

export default store;
