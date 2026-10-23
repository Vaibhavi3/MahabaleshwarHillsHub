// Mirrors backend/app/utils/multibuy.py exactly, for instant cart/checkout
// messaging. This is display-only - the backend recomputes the same
// discount from the server-side cart at order creation and is the only
// thing that actually charges it, so nothing here needs to be trusted.
export const MULTIBUY_CATEGORY = 'socks';

// (minimum eligible quantity, discount percent), highest threshold first.
export const MULTIBUY_TIERS = [
  { minQuantity: 4, percent: 15 },
  { minQuantity: 2, percent: 10 },
];

export function computeMultibuyDiscount(items) {
  let eligibleQuantity = 0;
  let eligibleSubtotal = 0;
  items.forEach((item) => {
    if (item.category === MULTIBUY_CATEGORY) {
      eligibleQuantity += item.quantity;
      eligibleSubtotal += item.price * item.quantity;
    }
  });

  const tier = MULTIBUY_TIERS.find((t) => eligibleQuantity >= t.minQuantity);
  if (tier) {
    return {
      amount: Math.round(eligibleSubtotal * (tier.percent / 100) * 100) / 100,
      percent: tier.percent,
      eligibleQuantity,
      eligibleSubtotal,
      nextTier: null,
      itemsUntilNextTier: null,
    };
  }

  const lowestTier = MULTIBUY_TIERS[MULTIBUY_TIERS.length - 1];
  return {
    amount: 0,
    percent: 0,
    eligibleQuantity,
    eligibleSubtotal,
    nextTier: lowestTier.percent,
    itemsUntilNextTier: Math.max(0, lowestTier.minQuantity - eligibleQuantity),
  };
}
