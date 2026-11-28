import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';
import cartReducer from './features/cartSlice';
import productReducer from './features/productSlice';
import wishlistReducer from './features/wishlistSlice';
import savedForLaterReducer from './features/savedForLaterSlice';
import uiReducer from './features/uiSlice';
import cartSyncMiddleware from './store/cartSyncMiddleware';

const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    products: productReducer,
    wishlist: wishlistReducer,
    savedForLater: savedForLaterReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(cartSyncMiddleware),
});

export default store;
