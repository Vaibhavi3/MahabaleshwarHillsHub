"""
One-off: add the multibuy_discount_amount column to the existing `orders`
table, for the automatic "Mix & Match Socks" multi-buy discount
(backend/app/utils/multibuy.py).

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_multibuy_discount_column.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS multibuy_discount_amount FLOAT DEFAULT 0 NOT NULL",
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
