"""
One-off: create the `notifications` table backing the header's
notification bell (order status, price-drop, back-in-stock, return/support
and loyalty-points updates), matching the notification/updates inbox
Myntra, Nykaa and Ajio all show.

Base.metadata.create_all() (run on every app startup) already creates this
table automatically on a fresh database, so this script only matters for
an existing production database that needs it added without a restart.
Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_notifications_table.py
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
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type VARCHAR(30) NOT NULL,
        title VARCHAR(150) NOT NULL,
        body TEXT,
        link VARCHAR(255),
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications (is_read)",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt.strip())
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
