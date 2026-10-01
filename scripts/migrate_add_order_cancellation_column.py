"""
One-off: add the `cancellation_reason` column to the existing `orders`
table, used by the new customer self-service "Cancel Order" flow on the
Your Orders page (inspired by Myntra/Nykaa/Ajio's pre-shipment cancel
flow). Base.metadata.create_all() (run on every app startup) creates
brand new tables fine but does not ALTER existing tables to add columns,
so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_order_cancellation_column.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255)"


def main():
    with engine.begin() as conn:
        print("Running:", STATEMENT)
        conn.execute(text(STATEMENT))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
