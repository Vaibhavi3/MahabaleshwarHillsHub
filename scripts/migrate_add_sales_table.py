"""
One-off: create the `sales` table used by admin-scheduled "Sale" campaigns
(flat/percent discount automatically applied storewide or to one
category/subcategory for a real admin-set time window) - inspired by
Nykaa's Pink Friday countdown banner, Myntra's "Grab or Gone" flash
windows, and Ajio's sitewide sale banners. Distinct from the existing
`coupons` table, which always requires the shopper to enter a code.

Base.metadata.create_all() (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this will exist on its own after the next backend deploy. This script
exists as a belt-and-suspenders way to create it immediately, following
the same pattern as migrate_add_collections_tables.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_sales_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50),
        subcategory VARCHAR(50),
        discount_type VARCHAR(10) NOT NULL DEFAULT 'percent',
        discount_value FLOAT NOT NULL,
        max_discount FLOAT,
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
]

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_sales_category ON sales (category)",
    "CREATE INDEX IF NOT EXISTS ix_sales_is_active ON sales (is_active)",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt.strip())
            conn.execute(text(stmt))
        for stmt in INDEX_STATEMENTS:
            print("Running:", stmt)
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
