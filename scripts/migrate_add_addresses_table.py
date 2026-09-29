"""
One-off: create the `addresses` table used by the saved Address Book /
checkout address picker feature (inspired by Myntra/Nykaa/Ajio's "Manage
Addresses" account section).

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this table will exist on its own after the next backend deploy. This
script exists as a belt-and-suspenders way to create it immediately,
following the same pattern as migrate_add_stock_alerts_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_addresses_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    label VARCHAR(20) DEFAULT 'Home',
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    country VARCHAR(50) DEFAULT 'India',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_addresses_user_id ON addresses (user_id)",
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
