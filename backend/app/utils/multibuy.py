"""
Automatic "Mix & Match Socks" multi-buy discount - inspired by Myntra's
auto-apply-on-cart buy-more offers. Unlike a Coupon, this needs no code:
it kicks in automatically once a shopper's cart holds enough eligible
items, mirroring how Myntra/Ajio surface a cart-level "buy more, save
more" deal on deep categories like socks.

Scoped to the "socks" category only - it's the one category with real
depth (hundreds of SKUs across sizes/colours), so "mix and match any 2+"
is an honest, deliverable promise. Slidders and (empty) Bags are excluded.

Pure and side-effect free so the exact same tiers can be mirrored in the
frontend for instant cart messaging, with this function staying the
single source of truth enforced at order creation time.
"""
from typing import Iterable, NamedTuple, Optional, Tuple

MULTIBUY_CATEGORY = "socks"

# (minimum eligible quantity, discount percent on those items' price).
# Sorted descending by threshold - the first tier a cart qualifies for wins.
MULTIBUY_TIERS: Tuple[Tuple[int, float], ...] = (
    (4, 15.0),
    (2, 10.0),
)


class MultibuyResult(NamedTuple):
    discount_amount: float
    discount_percent: float
    eligible_quantity: int
    eligible_subtotal: float
    next_tier_percent: Optional[float]
    items_until_next_tier: Optional[int]


def compute_multibuy_discount(cart_lines: Iterable[Tuple[str, float, int]]) -> MultibuyResult:
    """cart_lines: iterable of (category, unit_price, quantity) for each
    distinct cart line. Returns the automatic discount plus enough detail
    for "add N more to unlock X% off" messaging."""
    eligible_quantity = 0
    eligible_subtotal = 0.0
    for category, unit_price, quantity in cart_lines:
        if category == MULTIBUY_CATEGORY:
            eligible_quantity += quantity
            eligible_subtotal += unit_price * quantity

    for threshold, percent in MULTIBUY_TIERS:
        if eligible_quantity >= threshold:
            discount_amount = round(eligible_subtotal * (percent / 100), 2)
            return MultibuyResult(
                discount_amount=discount_amount,
                discount_percent=percent,
                eligible_quantity=eligible_quantity,
                eligible_subtotal=round(eligible_subtotal, 2),
                next_tier_percent=None,
                items_until_next_tier=None,
            )

    # No tier met yet - report the nearest (lowest-threshold) one for messaging.
    lowest_threshold, lowest_percent = MULTIBUY_TIERS[-1]
    return MultibuyResult(
        discount_amount=0.0,
        discount_percent=0.0,
        eligible_quantity=eligible_quantity,
        eligible_subtotal=round(eligible_subtotal, 2),
        next_tier_percent=lowest_percent,
        items_until_next_tier=max(0, lowest_threshold - eligible_quantity),
    )
