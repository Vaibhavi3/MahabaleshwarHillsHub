import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { FiShoppingCart, FiMenu, FiX, FiLogOut } from 'react-icons/fi';
import { logout } from '../features/authSlice';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const { items } = useSelector((state) => state.cart);
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold gradient-text">
          Mahabaleshwar Hills Hub
        </Link>

        <div className="hidden md:flex gap-8">
          <Link to="/" className="hover:text-purple-600 transition">
            Home
          </Link>
          <Link to="/products" className="hover:text-purple-600 transition">
            Products
          </Link>
          {user && (
            <Link to="/orders" className="hover:text-purple-600 transition">
              Orders
            </Link>
          )}
        </div>

        <div className="flex gap-4 items-center">
          <Link to="/cart" className="relative">
            <FiShoppingCart className="text-2xl" />
            {items.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {items.length}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex gap-4 items-center">
              <span className="text-sm">{user.username}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-600 hover:text-red-800"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          ) : (
            <Link to="/auth" className="btn-primary text-sm">
              Login
            </Link>
          )}

          <button
            className="md:hidden text-2xl"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div className="md:hidden bg-gray-50 border-t">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <Link to="/" className="hover:text-purple-600">
              Home
            </Link>
            <Link to="/products" className="hover:text-purple-600">
              Products
            </Link>
            {user && (
              <Link to="/orders" className="hover:text-purple-600">
                Orders
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
