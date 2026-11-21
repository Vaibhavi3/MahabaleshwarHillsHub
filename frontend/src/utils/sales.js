// Mirrors backend/app/utils/sales.py exactly, for instant banner/price
// display. This is display-only - the backend recomputes the same
// discount from the server-side cart at order creation and is the only
// thing that actually charges it, so nothing here needs to be trusted.
// A "sale" is an admin-scheduled campaign (storewide or scoped to one
// category/subcategory) with a real start/end time - never a fabricated
// countdown - applied automatically with no coupon code needed.

function discountAmount(sale, unitPrice) {
  let amount = sale.discount_type === 'percent' ? (unitPrice * sale.discount_value) / 100 : sale.discount_value;
  if (sale.discount_type === 'percent' && sale.max_discount) {
    amount = Math.min(amount, sale.max_discount);
  }
  return Math.min(amount, unitPrice);
}

export function bestSaleForProduct(sales, product) {
  if (!sales || !sales.length || !product) return null;
  const applicable = sales.filter(
    (sale) =>
      (!sale.category || sale.category === product.category) &&
      (!sale.subcategory || sale.subcategory === product.subcategory)
  );
  if (!applicable.length) return null;
  return applicable.reduce((best, sale) =>
    discountAmount(sale, product.price) > discountAmount(best, product.price) ? sale : best
  );
}

export function salePrice(product, sale) {
  if (!product) return 0;
  if (!sale) return product.price;
  return Math.round((product.price - discountAmount(sale, product.price)) * 100) / 100;
}

// Soonest-ending currently-live sale, for a single sitewide countdown banner.
export function soonestEndingSale(sales) {
  if (!sales || !sales.length) return null;
  return sales.reduce((soonest, sale) =>
    new Date(sale.ends_at) < new Date(soonest.ends_at) ? sale : soonest
  );
}
