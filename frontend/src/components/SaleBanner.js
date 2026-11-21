import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FiClock } from 'react-icons/fi';
import { soonestEndingSale } from '../utils/sales';

const formatRemaining = (ms) => {
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const scopeLabel = (sale) => {
  if (sale.subcategory) return `on ${sale.subcategory.replace(/-/g, ' ')}`;
  if (sale.category) return `on ${sale.category}`;
  return 'storewide';
};

const discountLabel = (sale) =>
  sale.discount_type === 'percent' ? `${sale.discount_value}% OFF` : `₹${sale.discount_value} OFF`;

/**
 * Sitewide "Sale ends in..." banner, inspired by Nykaa's Pink Friday
 * countdown and Myntra's "Grab or Gone" flash windows - but only ever
 * shows a REAL admin-scheduled sale with a real end time (see
 * AdminDashboard's Sales tab / backend/app/routes/sales.py). Renders
 * nothing at all when no sale is currently live, so there's never a fake
 * sense of urgency.
 */
const SaleBanner = () => {
  const activeSales = useSelector((state) => state.sales.activeSales);
  const sale = useMemo(() => soonestEndingSale(activeSales), [activeSales]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sale) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sale]);

  if (!sale) return null;

  const remaining = formatRemaining(new Date(sale.ends_at).getTime() - now);
  if (!remaining) return null;

  return (
    <div className="bg-gradient-to-r from-brand-dark to-brand text-white text-center py-2 px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 flex-wrap">
      <span>
        {sale.name}: {discountLabel(sale)} {scopeLabel(sale)}
      </span>
      <span className="flex items-center gap-1 bg-black/15 rounded-full px-2.5 py-0.5">
        <FiClock size={13} /> Ends in {remaining}
      </span>
    </div>
  );
};

export default SaleBanner;
