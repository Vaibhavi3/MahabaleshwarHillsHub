"""
One-off: create the `collections` and `collection_products` tables used by
curated "edits" (e.g. "Cosy Socks Edit") on the homepage - admin-picked
groupings of real catalogue products, inspired by Myntra/Ajio/Nykaa's
curated edit/trend landing pages.

Base.metadata.create_all() (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
these will exist on their own after the next backend deploy. This script
exists as a belt-and-suspenders way to create them immediately, following
the same pattern as migrate_add_wishlist_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_collections_tables.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        slug VARCHAR(120) NOT NULL UNIQUE,
        description TEXT,
        banner_image_url VARCHAR(500),
        is_active BOOLEAN NOT NULL DEFAULT true,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS collection_products (
        id SERIAL PRIMARY KEY,
        collection_id INTEGER NOT NULL REFERENCES collections(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_collection_product UNIQUE (collection_id, product_id)
    )
    """,
]

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_collections_slug ON collections (slug)",
    "CREATE INDEX IF NOT EXISTS ix_collection_products_collection_id ON collection_products (collection_id)",
    "CREATE INDEX IF NOT EXISTS ix_collection_products_product_id ON collection_products (product_id)",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt.strip())
            conn.execute(text(stmt))
        for stmt in INDEX_STATEMENTS:
            print("Running:", stmt)
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
