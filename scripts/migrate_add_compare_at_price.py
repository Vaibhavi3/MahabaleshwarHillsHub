"""
One-off: add the `compare_at_price` column to the existing `products`
table, used to show a struck-through MRP + "X% OFF" badge on the product
grid and PDP (matching Nykaa/Myntra/Ajio's pricing pattern - see
frontend's ProductCard/ProductDetail/QuickViewModal).

Base.metadata.create_all() (run on every app startup) does not ALTER an
existing table to add a new column, so this needs to run once by hand.

This store's original seed.py used to bake the real MRP into the
description text as "... (MRP Rs.1499)" instead of a structured column
(see scripts/products_seed.json's compare_at_price field). seed.py has
since been changed to set the new column directly, but products already
seeded in production only have that MRP sitting inertly in their
description text - so this migration also backfills compare_at_price by
parsing it back out of description for any row that still has it, and
strips the now-redundant "(MRP Rs...)" suffix from the description since
the UI shows it properly as a real price element instead. This recovers
real pricing data that was already in the catalog; it never invents an
MRP for a product that never had one.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS, and the backfill only
touches rows where compare_at_price is still NULL and description still
matches the pattern.

Run with DATABASE_URL set:
    python migrate_add_compare_at_price.py
"""
import os
import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = "ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price DOUBLE PRECISION"

MRP_SUFFIX_RE = re.compile(r"\s*\(MRP Rs\.(\d+(?:\.\d+)?)\)\s*$")


def backfill(conn):
    session = Session(bind=conn)
    rows = session.execute(
        text("SELECT id, price, description FROM products WHERE compare_at_price IS NULL")
    ).fetchall()

    updated = 0
    for row in rows:
        description = row.description or ""
        match = MRP_SUFFIX_RE.search(description)
        if not match:
            continue
        mrp = float(match.group(1))
        if mrp <= row.price:
            continue
        cleaned_description = MRP_SUFFIX_RE.sub("", description)
        session.execute(
            text(
                "UPDATE products SET compare_at_price = :mrp, description = :description WHERE id = :id"
            ),
            {"mrp": mrp, "description": cleaned_description, "id": row.id},
        )
        updated += 1

    session.commit()
    print(f"Backfilled compare_at_price for {updated} of {len(rows)} candidate product(s).")


def main():
    with engine.begin() as conn:
        print("Running:", STATEMENT)
        conn.execute(text(STATEMENT))
        print("Backfilling compare_at_price from existing description text...")
        backfill(conn)
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
