"""
One-off: add SKU / parent SKU / MRP / image gallery columns to `products`.
Base.metadata.create_all() does not ALTER existing tables, so this needs to
run once by hand. Safe to re-run - uses IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_product_sku_gallery.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_sku VARCHAR(50)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp DOUBLE PRECISION",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_products_sku ON products (sku)",
    "CREATE INDEX IF NOT EXISTS ix_products_parent_sku ON products (parent_sku)",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt)
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
