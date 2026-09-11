import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import ProductCard from '../components/ProductCard';
import { FiFilter, FiX, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { SOCK_SUBCATEGORIES } from '../constants/sockSubcategories';

const CATEGORY_LABELS = {
  socks: 'Home Socks',
  slidders: 'Home Slidders',
  bags: 'Handmade Bags',
};

const PRICE_BUCKETS = [
  { key: 'under-500', label: 'Under ₹500', test: (p) => p < 500 },
  { key: '500-1000', label: '₹500 - ₹1000', test: (p) => p >= 500 && p <= 1000 },
  { key: '1000-1500', label: '₹1000 - ₹1500', test: (p) => p > 1000 && p <= 1500 },
  { key: 'above-1500', label: 'Above ₹1500', test: (p) => p > 1500 },
];

const SORT_OPTIONS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'rating', label: 'Customer Rating' },
  { key: 'newest', label: "What's New" },
];

const primaryColor = (colorStr) => (colorStr || '').split(/[,&/]/)[0].trim();

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState(searchParams.get('subcategory') || '');
  const [selectedPriceBuckets, setSelectedPriceBuckets] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [sortBy, setSortBy] = useState('recommended');
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const searchQuery = searchParams.get('q') || '';

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') || '');
    setSelectedSubcategory(searchParams.get('subcategory') || '');
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let productsResponse;
        if (searchQuery) {
          productsResponse = await api.searchProducts(searchQuery);
        } else {
          productsResponse = await api.getProducts(0, 500, selectedCategory || null, selectedSubcategory || null);
        }
        setAllProducts(productsResponse.data);

        const categoriesResponse = await api.getCategories();
        setCategories(categoriesResponse.data.categories);
      } catch (error) {
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCategory, selectedSubcategory, searchQuery]);

  const handleCategoryChange = (slug) => {
    setSelectedCategory(slug);
    setSelectedSubcategory('');
    const params = {};
    if (slug) params.category = slug;
    setSearchParams(params);
  };

  const handleSubcategoryChange = (slug) => {
    const next = selectedSubcategory === slug ? '' : slug;
    setSelectedSubcategory(next);
    const params = { category: 'socks' };
    if (next) params.subcategory = next;
    setSearchParams(params);
  };

  const togglePriceBucket = (key) => {
    setSelectedPriceBuckets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleColor = (color) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const availableColors = useMemo(() => {
    const set = new Set();
    allProducts.forEach((p) => {
      const c = primaryColor(p.color);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    if (selectedPriceBuckets.length > 0) {
      const buckets = PRICE_BUCKETS.filter((b) => selectedPriceBuckets.includes(b.key));
      list = list.filter((p) => buckets.some((b) => b.test(p.price)));
    }

    if (selectedColors.length > 0) {
      list = list.filter((p) => selectedColors.includes(primaryColor(p.color)));
    }

    switch (sortBy) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
        list.sort((a, b) => b.id - a.id);
        break;
      default:
        break;
    }

    return list;
  }, [allProducts, selectedPriceBuckets, selectedColors, sortBy]);

  const clearFilters = () => {
    setSelectedPriceBuckets([]);
    setSelectedColors([]);
  };

  const activeFilterCount = selectedPriceBuckets.length + selectedColors.length;

  const FilterPanel = () => (
    <div className="space-y-8">
      <div>
        <h3 className="font-bold text-ink uppercase text-sm mb-3 tracking-wide">Category</h3>
        <div className="space-y-2">
          <button
            onClick={() => handleCategoryChange('')}
            className={`block text-sm w-full text-left ${
              !selectedCategory ? 'text-brand font-bold' : 'text-ink hover:text-brand'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`block text-sm w-full text-left ${
                selectedCategory === cat ? 'text-brand font-bold' : 'text-ink hover:text-brand'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {selectedCategory === 'socks' && (
        <div>
          <h3 className="font-bold text-ink uppercase text-sm mb-3 tracking-wide">Sock Type</h3>
          <div className="space-y-2">
            {SOCK_SUBCATEGORIES.map((sub) => (
              <button
                key={sub.slug}
                onClick={() => handleSubcategoryChange(sub.slug)}
                className={`block text-sm w-full text-left ${
                  selectedSubcategory === sub.slug ? 'text-brand font-bold' : 'text-ink hover:text-brand'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-bold text-ink uppercase text-sm mb-3 tracking-wide">Price</h3>
        <div className="space-y-2">
          {PRICE_BUCKETS.map((bucket) => (
            <label key={bucket.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPriceBuckets.includes(bucket.key)}
                onChange={() => togglePriceBucket(bucket.key)}
                className="accent-brand w-4 h-4"
              />
              <span className="text-ink">{bucket.label}</span>
            </label>
          ))}
        </div>
      </div>

      {availableColors.length > 0 && (
        <div>
          <h3 className="font-bold text-ink uppercase text-sm mb-3 tracking-wide">Colour</h3>
          <div className="flex flex-wrap gap-2">
            {availableColors.map((color) => (
              <button
                key={color}
                onClick={() => toggleColor(color)}
                className={`filter-chip ${
                  selectedColors.includes(color) ? 'filter-chip-active' : 'filter-chip-inactive'
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <button onClick={clearFilters} className="text-brand text-sm font-semibold uppercase hover:underline">
          Clear Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">
          Home {selectedCategory && `/ ${CATEGORY_LABELS[selectedCategory] || selectedCategory}`}
          {selectedSubcategory && ` / ${SOCK_SUBCATEGORIES.find((s) => s.slug === selectedSubcategory)?.label || selectedSubcategory}`}
        </p>
        <h1 className="text-2xl font-extrabold text-ink">
          {searchQuery
            ? `Results for "${searchQuery}"`
            : selectedSubcategory
            ? SOCK_SUBCATEGORIES.find((s) => s.slug === selectedSubcategory)?.label || selectedSubcategory
            : selectedCategory
            ? CATEGORY_LABELS[selectedCategory] || selectedCategory
            : 'All Products'}
        </h1>
      </div>

      <div className="flex items-center justify-between border-y border-gray-200 py-3 mb-6">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="lg:hidden flex items-center gap-2 text-sm font-bold uppercase text-ink"
        >
          <FiFilter /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
        <span className="hidden lg:block text-sm text-muted font-semibold">
          {filteredProducts.length} Items
        </span>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-transparent text-sm font-bold uppercase text-ink pr-6 cursor-pointer outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
          <FiChevronDown className="absolute right-0 top-1 pointer-events-none text-ink" />
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden lg:block w-56 shrink-0">
          <FilterPanel />
        </aside>

        <div className="flex-1">
          {loading ? (
            <div className="text-center text-muted py-16">Loading...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center text-muted py-16">No products found</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 items-start">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-extrabold text-lg">Filters</h2>
              <button onClick={() => setMobileFiltersOpen(false)}>
                <FiX size={22} />
              </button>
            </div>
            <FilterPanel />
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="btn-primary w-full mt-8"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
