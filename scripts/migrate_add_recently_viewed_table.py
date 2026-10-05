"""
One-off: create the `recently_viewed` table used by the account-backed
"Recently Viewed" rail - Myntra keeps a dedicated recently-viewed section
on its homepage, and Ajio surfaces the same browsing history from its
wishlist page. Tied to the account, the same way wishlist_items is, so a
shopper's browsing history follows them across devices instead of living
only in one browser's local storage. Guests (not logged in) still see a
recently-viewed rail, but it's browser-local only via localStorage - this
table is for signed-in users only.

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this table will exist on its own after the next backend deploy. This
script exists as a belt-and-suspenders way to create it immediately,
following the same pattern as migrate_add_wishlist_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set, any time before or after this PR merges (the
app also self-creates the table on its next deploy either way):
    python migrate_add_recently_viewed_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS recently_viewed (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    viewed_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_recently_viewed_user_product UNIQUE (user_id, product_id)
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_recently_viewed_user_id ON recently_viewed (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_recently_viewed_product_id ON recently_viewed (product_id)",
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
