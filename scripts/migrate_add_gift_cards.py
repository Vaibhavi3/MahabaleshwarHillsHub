"""
One-off: add Gift Card support - a new `gift_cards` table, plus
gift_card_code / gift_card_amount columns on `orders` so a redeemed gift
card shows up on the order the same way a coupon or Hills Rewards points
redemption does.

Base.metadata.create_all() (run on every app startup) creates the new
`gift_cards` table automatically, but does not ALTER the existing `orders`
table to add columns - so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_gift_cards.py
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
    CREATE TABLE IF NOT EXISTS gift_cards (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE,
        initial_value FLOAT NOT NULL,
        balance FLOAT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
        purchaser_user_id INTEGER NOT NULL REFERENCES users(id),
        recipient_name VARCHAR(100) NOT NULL,
        recipient_email VARCHAR(150) NOT NULL,
        sender_name VARCHAR(100),
        message TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        activated_at TIMESTAMPTZ
    )
    """,
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_gift_cards_code ON gift_cards (code)",
    "CREATE INDEX IF NOT EXISTS ix_gift_cards_purchaser_user_id ON gift_cards (purchaser_user_id)",
    "CREATE INDEX IF NOT EXISTS ix_gift_cards_status ON gift_cards (status)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_code VARCHAR(20)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_amount FLOAT NOT NULL DEFAULT 0",
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
