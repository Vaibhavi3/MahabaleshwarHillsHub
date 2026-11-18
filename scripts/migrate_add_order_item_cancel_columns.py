"""
One-off: add per-item cancellation columns to the existing `order_items`
table, used by the new "cancel just this item" flow on Your Orders
(inspired by Myntra/Nykaa/Ajio letting you cancel one line out of a
multi-item order instead of the whole order). Base.metadata.create_all()
(run on every app startup) creates brand new tables fine but does not
ALTER existing tables to add columns, so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_order_item_cancel_columns.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255)",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refund_amount FLOAT NOT NULL DEFAULT 0",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) NOT NULL DEFAULT 'none'",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt.strip())
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
