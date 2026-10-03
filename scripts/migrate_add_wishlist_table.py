"""
One-off: create the `wishlist_items` table used by the account-backed
wishlist (previously the heart icon only saved to this browser's local
storage; now it's tied to the account like Myntra/Nykaa/Ajio, so it
follows the shopper across devices and survives clearing browser data).

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this table will exist on its own after the next backend deploy. This
script exists as a belt-and-suspenders way to create it immediately,
following the same pattern as migrate_add_stock_alerts_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_wishlist_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS wishlist_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_wishlist_items_user_id ON wishlist_items (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_wishlist_items_product_id ON wishlist_items (product_id)",
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
