import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import { FiSearch } from 'react-icons/fi';

// Debounced live search: shows a preview of matching products (with real
// price/stock data from the same /products/search endpoint the results
// page uses) so shoppers can jump straight to a product without a full
// page navigation, or fall through to the results page for a wider look.
const SearchBox = ({ className }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const response = await api.searchProducts(term);
        if (requestId === requestIdRef.current) {
          setSuggestions(response.data.slice(0, 5));
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToResults = (term) => {
    setOpen(false);
    navigate(`/products?q=${encodeURIComponent(term)}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) goToResults(query.trim());
  };

  const handleSelect = (productId) => {
    setOpen(false);
    setQuery('');
    navigate(`/products/${productId}`);
  };

  const trimmed = query.trim();
  const showDropdown = open && trimmed.length >= 2;

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center w-full bg-surface rounded px-4 py-2.5 gap-3">
          <FiSearch className="text-muted text-lg shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Search for socks, slidders, bags..."
            className="bg-transparent w-full text-sm outline-none placeholder:text-muted"
            autoComplete="off"
          />
        </div>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 md:left-auto md:right-0 md:w-96 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted">Searching&hellip;</p>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelect(product.id)}
                  className="flex items-center gap-3 w-full text-left px-4 py-2 hover:bg-surface"
                >
                  <img
                    src={getImageUrl(product.image_url) || 'https://via.placeholder.com/40'}
                    alt={product.name}
                    className="w-10 h-10 object-contain bg-surface rounded shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink truncate">{product.name}</span>
                    <span className="block text-xs text-muted">₹{product.price}</span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => goToResults(trimmed)}
                className="block w-full text-left px-4 py-2.5 text-sm font-bold uppercase text-brand border-t border-gray-100 hover:bg-surface"
              >
                View all results for &ldquo;{trimmed}&rdquo;
              </button>
            </>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">No products found for &ldquo;{trimmed}&rdquo;</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBox;
