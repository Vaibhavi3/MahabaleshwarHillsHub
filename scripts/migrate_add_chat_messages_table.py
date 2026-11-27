"""
One-off: create the `chat_messages` table used by the "Chat with us"
live-chat flow, inspired by Myntra's 24x7 in-app live chat and AJIO's
chat support launched from the Order Details Page - a faster,
synchronous alternative to the existing (async) support-ticket flow.

Base.metadata.create_all() (run on every app startup) already creates
this table automatically on a fresh database, so this script only matters
for an existing production database that needs it added without a
restart. Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_chat_messages_table.py
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
    CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        sender VARCHAR(10) NOT NULL,
        body TEXT NOT NULL,
        is_read_by_admin BOOLEAN NOT NULL DEFAULT false,
        is_read_by_customer BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_chat_messages_user_id ON chat_messages (user_id)",
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
