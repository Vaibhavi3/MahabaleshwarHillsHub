"""
One-off: add `price_at_add` and `price_drop_notified` columns to the
existing `wishlist_items` table, used by the wishlist price-drop alert
feature (see backend/app/routes/products.py's _notify_price_drop and
backend/app/routes/wishlist.py).

`price_at_add` snapshots a product's price at the moment it's wishlisted,
so the Wishlist page can show "Price Dropped" by comparing it to the
product's current price, and so existing rows need a one-time backfill
from the product's current price (their real snapshot moment already
passed, so "current price" is the closest honest value - it means an
item wishlisted long before this migration won't show a drop until the
price moves again from here, never a fabricated one).

Base.metadata.create_all() (run on every app startup) does not ALTER an
existing table to add new columns, so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS, and the backfill only
touches rows where price_at_add is still NULL.

Run with DATABASE_URL set:
    python migrate_add_wishlist_price_tracking.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS price_at_add DOUBLE PRECISION",
    "ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS price_drop_notified BOOLEAN NOT NULL DEFAULT FALSE",
]

BACKFILL_STATEMENT = """
UPDATE wishlist_items w
SET price_at_add = p.price
FROM products p
WHERE w.product_id = p.id
  AND w.price_at_add IS NULL
"""


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt.strip())
            conn.execute(text(stmt))
        print("Backfilling price_at_add for existing wishlist rows...")
        conn.execute(text(BACKFILL_STATEMENT))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
