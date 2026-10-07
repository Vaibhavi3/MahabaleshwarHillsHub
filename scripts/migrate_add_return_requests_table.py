"""
One-off: create the `return_requests` table used by the self-service
"Return or Exchange" flow on My Orders (inspired by Myntra/Nykaa/Ajio's
post-delivery return flow).

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this table will exist on its own after the next backend deploy. This
script exists as a belt-and-suspenders way to create it immediately,
following the same pattern as migrate_add_stock_alerts_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_return_requests_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS return_requests (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    request_type VARCHAR(20) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    comment TEXT,
    exchange_product_id INTEGER REFERENCES products(id),
    status VARCHAR(20) DEFAULT 'requested',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_return_requests_order_item_id ON return_requests (order_item_id)",
    "CREATE INDEX IF NOT EXISTS ix_return_requests_user_id ON return_requests (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_return_requests_status ON return_requests (status)",
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
