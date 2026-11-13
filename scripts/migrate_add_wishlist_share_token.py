"""
One-off: add wishlist sharing support - a wishlist_share_token column on
`users`. Matches Myntra/Nykaa/Ajio's "share your wishlist" so a shopper
can send a public, read-only link to family/friends (e.g. for gifting)
without handing out their account.

Base.metadata.create_all() (run on every app startup) does not ALTER an
existing table to add a column, so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS / CREATE UNIQUE INDEX IF
NOT EXISTS. No backfill needed: the token is only generated the first
time a shopper turns sharing on (see POST /api/wishlist/share), so every
existing user correctly starts with sharing off (NULL token).

Run with DATABASE_URL set:
    python migrate_add_wishlist_share_token.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS wishlist_share_token VARCHAR(64)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_wishlist_share_token ON users (wishlist_share_token)",
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
