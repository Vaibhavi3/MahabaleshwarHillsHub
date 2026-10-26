import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getImageUrl } from '../api/axiosConfig';
import { FiSearch, FiClock, FiTrendingUp, FiX } from 'react-icons/fi';

const RECENT_SEARCHES_KEY = 'mhh_recent_searches';
const MAX_RECENT_SEARCHES = 6;

// Browser-local only, same as a guest's Recently Viewed rail - this is the
// shopper's own search history, never sent anywhere or used for trending.
const getRecentSearches = () => {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const addRecentSearch = (term) => {
  try {
    const next = [term, ...getRecentSearches().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(
      0,
      MAX_RECENT_SEARCHES
    );
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecentSearches();
  }
};

const removeRecentSearch = (term) => {
  try {
    const next = getRecentSearches().filter((t) => t !== term);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecentSearches();
  }
};

const clearRecentSearches = () => {
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
  return [];
};

// Debounced live search: shows a preview of matching products (with real
// price/stock data from the same /products/search endpoint the results
// page uses) so shoppers can jump straight to a product without a full
// page navigation, or fall through to the results page for a wider look.
const SearchBox = ({ className }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [trending, setTrending] = useState([]);
  const containerRef = useRef(null);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getTrendingSearches(8)
      .then((res) => setTrending(res.data))
      .catch(() => setTrending([]));
  }, []);

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
    setRecentSearches(addRecentSearch(term));
    setOpen(false);
    navigate(`/products?q=${encodeURIComponent(term)}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) goToResults(query.trim());
  };

  const handleSelect = (productId) => {
    if (trimmed) setRecentSearches(addRecentSearch(trimmed));
    setOpen(false);
    setQuery('');
    navigate(`/products/${productId}`);
  };

  const handleFocus = () => {
    setRecentSearches(getRecentSearches());
    setOpen(true);
  };

  const handleRemoveRecent = (e, term) => {
    e.stopPropagation();
    setRecentSearches(removeRecentSearch(term));
  };

  const handleClearRecent = () => setRecentSearches(clearRecentSearches());

  const trimmed = query.trim();
  const showDropdown = open && trimmed.length >= 2;
  const showDiscoveryPanel =
    open && trimmed.length === 0 && (recentSearches.length > 0 || trending.length > 0);

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center w-full bg-surface rounded px-4 py-2.5 gap-3">
          <FiSearch className="text-muted text-lg shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Search for socks, slidders, bags..."
            className="bg-transparent w-full text-sm outline-none placeholder:text-muted"
            autoComplete="off"
          />
        </div>
      </form>

      {showDiscoveryPanel && (
        <div className="absolute left-0 right-0 md:left-auto md:right-0 md:w-96 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-96 overflow-y-auto p-4 space-y-5">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1.5">
                  <FiClock size={13} /> Recent Searches
                </p>
                <button
                  type="button"
                  onClick={handleClearRecent}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Clear
                </button>
              </div>
              <ul className="space-y-1">
                {recentSearches.map((term) => (
                  <li key={term} className="flex items-center justify-between group">
                    <button
                      type="button"
                      onClick={() => goToResults(term)}
                      className="flex-1 text-left text-sm text-ink py-1 hover:text-brand truncate"
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveRecent(e, term)}
                      aria-label={`Remove "${term}" from recent searches`}
                      className="text-muted hover:text-ink p-1 opacity-60 group-hover:opacity-100"
                    >
                      <FiX size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {trending.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1.5 mb-2">
                <FiTrendingUp size={13} /> Trending Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {trending.map((t) => (
                  <button
                    key={t.term}
                    type="button"
                    onClick={() => goToResults(t.term)}
                    className="filter-chip filter-chip-inactive capitalize"
                  >
                    {t.term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
