import React from 'react';
import { Link } from 'react-router-dom';
import { FiFacebook, FiInstagram, FiTwitter } from 'react-icons/fi';

const COLUMNS = [
  {
    title: 'Online Shopping',
    links: [
      { label: 'Home Socks', to: '/products?category=socks' },
      { label: 'Home Slidders', to: '/products?category=slidders' },
      { label: 'Handmade Bags', to: '/products?category=bags' },
      { label: 'New Arrivals', to: '/products' },
    ],
  },
  {
    title: 'Customer Policies',
    links: [
      { label: 'Contact Us', to: '#' },
      { label: 'FAQ', to: '#' },
      { label: 'Shipping Info', to: '#' },
      { label: 'Returns & Exchange', to: '#' },
    ],
  },
  {
    title: 'Useful Links',
    links: [
      { label: 'Your Orders', to: '/orders' },
      { label: 'Your Bag', to: '/cart' },
      { label: 'Login / Register', to: '/auth' },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-bold text-xs uppercase tracking-wide text-muted mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-ink hover:text-brand transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wide text-muted mb-4">Follow Us</h4>
            <div className="flex gap-4">
              <FiFacebook className="text-xl cursor-pointer text-ink hover:text-brand transition-colors" />
              <FiInstagram className="text-xl cursor-pointer text-ink hover:text-brand transition-colors" />
              <FiTwitter className="text-xl cursor-pointer text-ink hover:text-brand transition-colors" />
            </div>
            <div className="mt-6">
              <span className="text-2xl font-extrabold gradient-text">MAHABALESHWAR</span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Hills Hub</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted">
          <p>&copy; 2026 Mahabaleshwar Hills Hub. All rights reserved.</p>
          <p>Handmade with care in Mahabaleshwar, Maharashtra</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
