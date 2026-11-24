"""
One-off: add `last_activity_at` and `reminder_sent_at` columns to the
existing `carts` table, used by the cart-abandonment reminder feature
(see backend/app/routes/cart.py and scripts/send_cart_reminder_emails.py).

`last_activity_at` defaults to NOW() for already-existing rows (not
backfilled from `created_at`) so this migration can never, by itself,
make a long-standing cart look idle and trigger a flood of reminder
emails the moment it runs - every existing cart starts this feature
fresh, and only goes idle (and becomes reminder-eligible) from here.

Base.metadata.create_all() (run on every app startup) does not ALTER an
existing table to add new columns, so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_cart_reminder_columns.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE carts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now()",
    "ALTER TABLE carts ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt)
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
