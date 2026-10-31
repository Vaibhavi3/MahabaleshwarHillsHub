"""
One-off: add the `is_gift` and `gift_message` columns to the existing
`orders` table, used by the new checkout "Gift Options" flow (free gift
wrap + an optional personal note), inspired by Myntra's "Giftings &
Personalizations" step at checkout. Base.metadata.create_all() (run on
every app startup) creates brand new tables fine but does not ALTER
existing tables to add columns, so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_gift_options_columns.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message VARCHAR(300)",
]


def main():
    with engine.begin() as conn:
        for statement in STATEMENTS:
            print("Running:", statement)
            conn.execute(text(statement))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
