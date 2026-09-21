import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { FiShoppingBag, FiMenu, FiX, FiLogOut, FiHeart, FiUser, FiPackage } from 'react-icons/fi';
import { logout } from '../features/authSlice';
import { SOCK_SUBCATEGORIES } from '../constants/sockSubcategories';
import SearchBox from './SearchBox';

const NAV_LINKS = [
  { to: '/products?category=socks', label: 'Home Socks', subcategories: SOCK_SUBCATEGORIES },
  { to: '/products?category=slidders', label: 'Home Slidders' },
  { to: '/products?category=bags', label: 'Handmade Bags' },
  { to: '/products', label: 'New Arrivals' },
];

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const { items } = useSelector((state) => state.cart);
  const { items: wishlistItems } = useSelector((state) => state.wishlist);
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
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
            {NAV_LINKS.map((link) =>
              link.subcategories ? (
                <div key={link.label} className="relative group py-3 -my-3">
                  <Link to={link.to} className="nav-link whitespace-nowrap">
                    {link.label}
                  </Link>
                  <div className="hidden group-hover:block absolute top-full left-0 bg-white border border-gray-200 rounded shadow-lg py-2 min-w-[160px] z-50">
                    {link.subcategories.map((sub) => (
                      <Link
                        key={sub.slug}
                        to={`/products?category=socks&subcategory=${sub.slug}`}
                        className="block px-4 py-2 text-sm text-ink hover:bg-surface hover:text-brand whitespace-nowrap"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link key={link.label} to={link.to} className="nav-link whitespace-nowrap">
                  {link.label}
                </Link>
              )
            )}
          </nav>

          <SearchBox className="hidden md:flex flex-1 max-w-xl" />

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
              <FiPackage className="text-xl" />
              <span className="text-[11px] font-semibold uppercase mt-0.5">Orders</span>
            </Link>

            <Link to="/wishlist" className="relative flex flex-col items-center text-ink hover:text-brand transition-colors">
              <FiHeart className="text-xl" />
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-brand text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {wishlistItems.length}
                </span>
              )}
              <span className="text-[11px] font-semibold uppercase mt-0.5">Wishlist</span>
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

        <SearchBox className="md:hidden pb-3" />
      </div>

      {isOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <div key={link.label}>
                <Link to={link.to} className="nav-link" onClick={() => setIsOpen(false)}>
                  {link.label}
                </Link>
                {link.subcategories && (
                  <div className="flex flex-col gap-2 pl-4 mt-2">
                    {link.subcategories.map((sub) => (
                      <Link
                        key={sub.slug}
                        to={`/products?category=socks&subcategory=${sub.slug}`}
                        className="text-sm text-muted hover:text-brand"
                        onClick={() => setIsOpen(false)}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="border-t border-gray-200 pt-4 flex flex-col gap-3">
              {user ? (
                <>
                  <p className="text-sm text-muted">
                    Signed in as <span className="font-semibold text-ink">{user.username}</span>
                  </p>
                  <Link to="/orders" className="nav-link" onClick={() => setIsOpen(false)}>
                    Orders
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 text-sm font-semibold uppercase text-ink hover:text-brand w-fit"
                  >
                    <FiLogOut />
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="flex items-center gap-2 text-sm font-semibold uppercase text-ink hover:text-brand w-fit"
                  onClick={() => setIsOpen(false)}
                >
                  <FiUser />
                  Login / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
