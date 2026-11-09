"""
One-off: add the `fit` column to the existing `reviews` table, used for
optional "runs small / true to size / runs large" fit feedback on a
review, inspired by Myntra/Nykaa/Ajio's "size & fit" review insight.

Base.metadata.create_all() (run on every app startup) does not ALTER
existing tables to add columns, so this needs to run once by hand,
following the same pattern as migrate_add_coupon_columns.py.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_review_fit_column.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS fit VARCHAR(20)"


def main():
    with engine.begin() as conn:
        print("Running:", STATEMENT)
        conn.execute(text(STATEMENT))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
