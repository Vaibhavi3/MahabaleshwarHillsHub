"""
One-off: add the coupon-related columns to the existing `orders` table.
Base.metadata.create_all() (run on every app startup) creates brand new
tables fine (e.g. the new `coupons` table) but does not ALTER existing
tables to add columns, so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_coupon_columns.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount FLOAT",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount FLOAT DEFAULT 0",
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
