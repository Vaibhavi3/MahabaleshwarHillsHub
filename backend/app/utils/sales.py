"""
Admin-scheduled "Sale" campaigns - inspired by Nykaa's Pink Friday countdown
banner, Myntra's "Grab or Gone" flash windows, and Ajio's sitewide sale
banners. Unlike a Coupon, a Sale needs no code: it applies automatically to
every matching product while it's live, and it always has a real admin-set
end time, so the countdown shown to shoppers is never fabricated.

Pure and side-effect free so the exact same scoping/discount math can be
mirrored in the frontend (frontend/src/utils/sales.js) for instant display,
with this module staying the single source of truth enforced at order
creation time - exactly the same split as utils/multibuy.py.
"""
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app import models


def _aware(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def get_active_sales(db: Session, now: Optional[datetime] = None) -> List["models.Sale"]:
    """Every Sale that is admin-enabled and currently within its real
    start/end window - the only sales ever shown to shoppers or applied
    at checkout."""
    now = now or datetime.now(timezone.utc)
    candidates = db.query(models.Sale).filter(models.Sale.is_active.is_(True)).all()
    live = []
    for sale in candidates:
        starts_at = _aware(sale.starts_at)
        ends_at = _aware(sale.ends_at)
        if starts_at and starts_at > now:
            continue
        if ends_at and ends_at < now:
            continue
        live.append(sale)
    return live


def _discount_amount(sale: "models.Sale", unit_price: float) -> float:
    if sale.discount_type == "percent":
        amount = unit_price * (sale.discount_value / 100)
        if sale.max_discount:
            amount = min(amount, sale.max_discount)
    else:
        amount = sale.discount_value
    return min(amount, unit_price)


def best_sale_for_product(sales: List["models.Sale"], product: "models.Product") -> Optional["models.Sale"]:
    """Of the live sales whose scope (storewide / category / subcategory)
    covers this product, pick the one that gives the shopper the deepest
    discount."""
    applicable = [
        sale
        for sale in sales
        if (sale.category is None or sale.category == product.category)
        and (sale.subcategory is None or sale.subcategory == product.subcategory)
    ]
    if not applicable:
        return None
    return max(applicable, key=lambda sale: _discount_amount(sale, product.price))


def sale_unit_price(product: "models.Product", sale: Optional["models.Sale"]) -> float:
    if not sale:
        return product.price
    return round(product.price - _discount_amount(sale, product.price), 2)


def effective_unit_price(sales: List["models.Sale"], product: "models.Product") -> float:
    """The price actually charged for one unit of this product right now,
    accounting for the best currently-live sale (if any)."""
    sale = best_sale_for_product(sales, product)
    return sale_unit_price(product, sale)
