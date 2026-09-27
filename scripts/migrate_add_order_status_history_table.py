"""
One-off: create the `order_status_history` table used by the order
tracking timeline on the "Your Orders" page, and backfill one history
row per existing order so the timeline isn't empty for past orders.

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this table will exist on its own after the next backend deploy. This
script exists as a belt-and-suspenders way to create it immediately and
to backfill existing rows, following the same pattern as
migrate_add_stock_alerts_table.py.

The backfill inserts a single history row per order using that order's
*current* status and creation date, since the app has no record of when
earlier status changes happened for orders placed before this feature
shipped. New status changes going forward get their own real timestamped
row from the app.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS and only backfills
orders that don't already have a history row.

Run with DATABASE_URL set:
    python migrate_add_order_status_history_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
)
"""

INDEX_STATEMENT = (
    "CREATE INDEX IF NOT EXISTS ix_order_status_history_order_id "
    "ON order_status_history (order_id)"
)

BACKFILL_STATEMENT = """
INSERT INTO order_status_history (order_id, status, created_at)
SELECT o.id, o.status, o.created_at
FROM orders o
WHERE NOT EXISTS (
    SELECT 1 FROM order_status_history h WHERE h.order_id = o.id
)
"""


def main():
    with engine.begin() as conn:
        print("Running:", STATEMENT.strip())
        conn.execute(text(STATEMENT))
        print("Running:", INDEX_STATEMENT)
        conn.execute(text(INDEX_STATEMENT))
        print("Running:", BACKFILL_STATEMENT.strip())
        result = conn.execute(text(BACKFILL_STATEMENT))
        print(f"Backfilled {result.rowcount} order(s).")
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
