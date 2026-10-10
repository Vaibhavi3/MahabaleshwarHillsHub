import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getImageUrl } from '../api/axiosConfig';
import { addToCart } from '../features/cartSlice';
import { requireAuth } from '../utils/requireAuth';
import toast from 'react-hot-toast';

/**
 * Myntra/Amazon-style "Frequently Bought Together" bundle picker: each item
 * gets its own checkbox, in-stock items are pre-selected, and a single
 * action adds every checked item to the bag with one combined, honestly
 * summed total (no invented bundle discount - just the real prices added
 * up). Replaces the old plain grid, which only let a shopper view these
 * products one at a time instead of buying the combo in one step.
 */
const FrequentlyBoughtTogether = ({ baseProduct, items }) => {
  const combinedItems = [baseProduct, ...items];
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(combinedItems.filter((p) => p.stock > 0).map((p) => p.id))
  );
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    setSelectedIds(new Set(combinedItems.filter((p) => p.stock > 0).map((p) => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProduct.id]);

  const toggle = (id) => {
    if (id === baseProduct.id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = combinedItems.filter((p) => selectedIds.has(p.id));
  const totalPrice = selectedItems.reduce((sum, p) => sum + p.price, 0);

  const handleAddBundle = () => {
    if (selectedItems.length === 0) return;
    if (!requireAuth(token, navigate, location, 'Please login or register to add items to your bag')) return;
    selectedItems.forEach((p) => {
      dispatch(
        addToCart({
          id: p.id,
          name: p.name,
          price: p.price,
          image_url: p.image_url,
          stock: p.stock,
          quantity: 1,
        })
      );
    });
    toast.success(`Added ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} to bag`);
  };

  return (
    <div className="mt-16">
      <h2 className="text-xl font-extrabold text-ink mb-1">Frequently Bought Together</h2>
      <p className="text-sm text-muted mb-6">Based on what other customers purchased alongside this</p>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 lg:items-center bg-surface/60 border border-gray-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center gap-3">
          {combinedItems.map((p, idx) => (
            <React.Fragment key={p.id}>
              {idx > 0 && <span className="text-2xl text-muted font-light shrink-0">+</span>}
              <Link to={`/products/${p.id}`} className="flex flex-col items-center gap-1 w-20 shrink-0">
                <div
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 bg-white flex items-center justify-center ${
                    selectedIds.has(p.id) ? 'border-brand' : 'border-gray-200 opacity-50'
                  }`}
                >
                  <img
                    src={getImageUrl(p.image_url) || 'https://via.placeholder.com/80'}
                    alt={p.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <span className="text-[11px] text-muted truncate w-full text-center">₹{p.price}</span>
              </Link>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 w-full">
          <div className="space-y-2.5 mb-4">
            {combinedItems.map((p) => {
              const outOfStock = p.stock <= 0;
              const isBase = p.id === baseProduct.id;
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-2 text-sm ${outOfStock ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    disabled={isBase || outOfStock}
                    onChange={() => toggle(p.id)}
                    className="accent-brand w-4 h-4 shrink-0 disabled:opacity-60"
                  />
                  <span className={outOfStock ? 'text-muted' : 'text-ink'}>
                    {isBase && <span className="font-bold">This item: </span>}
                    {p.name} &ndash; ₹{p.price}
                    {outOfStock && <span className="text-red-600 font-semibold"> (Out of stock)</span>}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
            <div>
              <p className="text-xs text-muted">Total for {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}</p>
              <p className="text-xl font-extrabold text-ink">₹{totalPrice}</p>
            </div>
            <button
              onClick={handleAddBundle}
              disabled={selectedItems.length === 0}
              className="btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              Add {selectedItems.length} to Bag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrequentlyBoughtTogether;
