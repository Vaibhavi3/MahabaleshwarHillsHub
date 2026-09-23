"""
One-off: create the `stock_alerts` table used by the "Notify Me" back-in-
stock feature.

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this table will exist on its own after the next backend deploy. This
script exists as a belt-and-suspenders way to create it immediately,
following the same pattern as migrate_add_coupon_columns.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_stock_alerts_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS stock_alerts (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    email VARCHAR(150) NOT NULL,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    notified_at TIMESTAMPTZ
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_stock_alerts_product_id ON stock_alerts (product_id)",
    "CREATE INDEX IF NOT EXISTS ix_stock_alerts_user_id ON stock_alerts (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_stock_alerts_notified ON stock_alerts (notified)",
]


def main():
    with engine.begin() as conn:
        print("Running:", STATEMENT.strip())
        conn.execute(text(STATEMENT))
        for stmt in INDEX_STATEMENTS:
            print("Running:", stmt)
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
