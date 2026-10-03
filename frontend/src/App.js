import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from './api/axiosConfig';
import { logout, setUser } from './features/authSlice';
import { setWishlistItems, clearWishlist, mapWishlistResponse } from './features/wishlistSlice';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Addresses from './pages/Addresses';
import Auth from './pages/Auth';
import AdminDashboard from './pages/AdminDashboard';
import CRM from './pages/CRM';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const dispatch = useDispatch();
  const { token, user } = useSelector((state) => state.auth);
  const wishlistItems = useSelector((state) => state.wishlist.items);

  useEffect(() => {
    if (!token || user) return;
    api.getCurrentUser()
      .then((response) => dispatch(setUser({ user: response.data, token })))
      .catch(() => {
        dispatch(logout());
        dispatch(clearWishlist());
      });
  }, [dispatch, token, user]);

  useEffect(() => {
    if (!token) return;
    // Right after login (or on app load with a saved session), pull the
    // account's wishlist and fold in anything saved to this browser's
    // local storage before login - so a shopper's pre-login picks aren't
    // lost, and from then on the wishlist follows their account.
    const localIds = wishlistItems.map((item) => item.id);
    api.syncWishlist(localIds)
      .then((response) => dispatch(setWishlistItems(mapWishlistResponse(response.data))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/addresses"
            element={
              <ProtectedRoute>
                <Addresses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm"
            element={
              <ProtectedRoute>
                <CRM />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
