"""
One-off: add the "Hills Rewards" loyalty points columns to the existing
`users` and `orders` tables, and create the `loyalty_transactions` ledger
table. Earn points on delivered orders, redeem them for a rupee discount
at checkout - the pattern behind Nykaa Cash/Myntra Insider/Ajio Rewardz.

Base.metadata.create_all() (run on every app startup) creates the new
`loyalty_transactions` table automatically, but does not ALTER the
existing `users`/`orders` tables to add columns, so this needs to run
once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_loyalty_points.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_discount_amount FLOAT NOT NULL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_credited BOOLEAN NOT NULL DEFAULT false",
    """
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id),
        points INTEGER NOT NULL,
        reason VARCHAR(30) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_loyalty_transactions_user_id ON loyalty_transactions (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_loyalty_transactions_order_id ON loyalty_transactions (order_id)",
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
