import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { FiShoppingBag, FiMenu, FiX, FiLogOut, FiHeart, FiUser, FiSearch } from 'react-icons/fi';
import { logout } from '../features/authSlice';

const NAV_LINKS = [
  { to: '/products?category=socks', label: 'Home Socks' },
  { to: '/products?category=slidders', label: 'Home Slidders' },
  { to: '/products?category=bags', label: 'Handmade Bags' },
  { to: '/products', label: 'New Arrivals' },
];

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { user } = useSelector((state) => state.auth);
  const { items } = useSelector((state) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="bg-white sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-8 py-3">
          <Link to="/" className="flex flex-col items-start leading-none shrink-0">
            <span className="text-2xl md:text-3xl font-extrabold tracking-tight gradient-text">
              MAHABALESHWAR
            </span>
            <span className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Hills Hub
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 shrink-0">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="nav-link whitespace-nowrap">
                {link.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl">
            <div className="flex items-center w-full bg-surface rounded px-4 py-2.5 gap-3">
              <FiSearch className="text-muted text-lg shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for socks, slidders, bags..."
                className="bg-transparent w-full text-sm outline-none placeholder:text-muted"
              />
            </div>
          </form>

          <div className="flex items-center gap-5 ml-auto shrink-0">
            {user ? (
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex flex-col items-center text-ink">
                  <FiUser className="text-xl" />
                  <span className="text-[11px] font-semibold uppercase mt-0.5">{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex flex-col items-center text-ink hover:text-brand transition-colors"
                >
                  <FiLogOut className="text-xl" />
                  <span className="text-[11px] font-semibold uppercase mt-0.5">Logout</span>
                </button>
              </div>
            ) : (
              <Link to="/auth" className="hidden sm:flex flex-col items-center text-ink hover:text-brand transition-colors">
                <FiUser className="text-xl" />
                <span className="text-[11px] font-semibold uppercase mt-0.5">Login</span>
              </Link>
            )}

            <Link to="/orders" className="hidden sm:flex flex-col items-center text-ink hover:text-brand transition-colors">
              <FiHeart className="text-xl" />
              <span className="text-[11px] font-semibold uppercase mt-0.5">Orders</span>
            </Link>

            <Link to="/cart" className="relative flex flex-col items-center text-ink hover:text-brand transition-colors">
              <FiShoppingBag className="text-xl" />
              {items.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-brand text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {items.length}
                </span>
              )}
              <span className="text-[11px] font-semibold uppercase mt-0.5">Bag</span>
            </Link>

            <button
              className="lg:hidden text-2xl text-ink"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="md:hidden pb-3">
          <div className="flex items-center w-full bg-surface rounded px-4 py-2.5 gap-3">
            <FiSearch className="text-muted text-lg shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for socks, slidders, bags..."
              className="bg-transparent w-full text-sm outline-none placeholder:text-muted"
            />
          </div>
        </form>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="nav-link" onClick={() => setIsOpen(false)}>
                {link.label}
              </Link>
            ))}
            {user && (
              <Link to="/orders" className="nav-link" onClick={() => setIsOpen(false)}>
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
