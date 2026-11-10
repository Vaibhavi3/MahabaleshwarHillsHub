"""
One-off: add "Hills Wallet" store-credit support - a new
`wallet_transactions` table, a `wallet_balance` column on `users`, a
`wallet_amount_used` column on `orders`, and a `refund_method` column on
`return_requests` so a cancellation or completed return can credit the
wallet instantly instead of (or alongside) a gateway refund.

Base.metadata.create_all() (run on every app startup) creates the new
`wallet_transactions` table automatically, but does not ALTER the existing
`users`/`orders`/`return_requests` tables to add columns - so this needs to
run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_wallet.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance FLOAT NOT NULL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS wallet_amount_used FLOAT NOT NULL DEFAULT 0",
    "ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS refund_method VARCHAR(20) NOT NULL DEFAULT 'original'",
    """
    CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id),
        amount FLOAT NOT NULL,
        reason VARCHAR(30) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_wallet_transactions_user_id ON wallet_transactions (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_wallet_transactions_order_id ON wallet_transactions (order_id)",
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
