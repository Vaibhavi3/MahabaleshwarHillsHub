import React, { useEffect, useState } from 'react';
import { FiTag, FiCopy } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api/axiosConfig';

const formatDiscount = (coupon) => {
  const { discount_type, discount_value, max_discount, min_order_value } = coupon;
  let text = discount_type === 'percent' ? `${discount_value}% off` : `₹${discount_value} off`;
  if (discount_type === 'percent' && max_discount) text += ` up to ₹${max_discount}`;
  if (min_order_value > 0) text += ` on orders above ₹${min_order_value}`;
  return text;
};

/**
 * Myntra/Nykaa/Ajio-style "Available Offers" list: surfaces real, live
 * coupons so a shopper can discover and apply a discount without already
 * knowing a code from somewhere else. With `onApply` it applies the coupon
 * directly (cart); without it, it just copies the code (product page, which
 * has no order total to validate against yet).
 */
const OffersList = ({ onApply, applyingCode, title = 'Available Offers' }) => {
  const [coupons, setCoupons] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getActiveCoupons()
      .then((res) => {
        if (!cancelled) setCoupons(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || coupons.length === 0) return null;

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code} - paste it at checkout`);
    } catch {
      toast.error(`Could not copy automatically - code is ${code}`);
    }
  };

  return (
    <div className="border border-dashed border-brand/40 bg-brand/5 rounded-lg p-4 mb-6">
      <p className="text-sm font-bold text-ink uppercase mb-3 flex items-center gap-2">
        <FiTag className="text-brand" /> {title}
      </p>
      <ul className="space-y-3">
        {coupons.map((c) => (
          <li key={c.code} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <p className="font-bold text-ink">{c.code}</p>
              <p className="text-muted">{formatDiscount(c)}</p>
              {c.description && <p className="text-xs text-muted mt-0.5">{c.description}</p>}
            </div>
            {onApply ? (
              <button
                type="button"
                onClick={() => onApply(c.code)}
                disabled={applyingCode === c.code}
                className="text-brand font-bold text-xs uppercase hover:underline shrink-0 disabled:opacity-50"
              >
                {applyingCode === c.code ? '...' : 'Apply'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleCopy(c.code)}
                className="text-brand font-bold text-xs uppercase hover:underline shrink-0 flex items-center gap-1"
              >
                <FiCopy size={12} /> Copy
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OffersList;
