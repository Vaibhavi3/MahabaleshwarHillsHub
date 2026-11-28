"""
One-off: create the `saved_for_later_items` table used by the account-backed
"Save for Later" bag feature (inspired by Myntra/Amazon's "Save for later"
section on the bag page - a shopper can set an item aside without losing it
from their cart, and move it back in one tap, from any device).

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so this
table will exist on its own after the next backend deploy. This script
exists as a belt-and-suspenders way to create it immediately, following the
same pattern as migrate_add_wishlist_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set, any time before or after this PR merges (it only
adds a new table, so it can't break the running app either way):
    python migrate_add_saved_for_later_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS saved_for_later_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_saved_for_later_user_product UNIQUE (user_id, product_id)
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_saved_for_later_items_user_id ON saved_for_later_items (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_saved_for_later_items_product_id ON saved_for_later_items (product_id)",
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
