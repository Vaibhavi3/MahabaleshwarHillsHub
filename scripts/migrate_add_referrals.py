"""
One-off: add "Invite & Earn" referral support - a referral_code column on
`users`, and a new `referrals` ledger table. Matches Ajio's Invite & Earn
pattern (a new shopper gets a signup bonus for using a friend's code, the
friend earns a bonus once that shopper's first order is delivered),
adapted to this store's own Hills Rewards points.

Base.metadata.create_all() (run on every app startup) creates the new
`referrals` table automatically, but does not ALTER the existing `users`
table to add a column, and existing users need a referral_code backfilled
so they can use Invite & Earn too - so this needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS,
and only backfills users whose referral_code is still NULL.

Run with DATABASE_URL set:
    python migrate_add_referrals.py
"""
import os
import secrets
import string
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)",
    """
    CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reward_points INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        completed_at TIMESTAMPTZ
    )
    """,
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_referral_code ON users (referral_code)",
    "CREATE INDEX IF NOT EXISTS ix_referrals_referrer_id ON referrals (referrer_id)",
    "CREATE INDEX IF NOT EXISTS ix_referrals_status ON referrals (status)",
]

CODE_ALPHABET = string.ascii_uppercase + string.digits


def backfill_referral_codes(conn):
    """Existing users registered before this migration have no
    referral_code yet - give each one a random code so Invite & Earn
    works for them too, without waiting for them to re-register."""
    existing_codes = {
        row[0] for row in conn.execute(text("SELECT referral_code FROM users WHERE referral_code IS NOT NULL"))
    }
    rows = conn.execute(text("SELECT id FROM users WHERE referral_code IS NULL")).fetchall()
    for (user_id,) in rows:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
            if code not in existing_codes:
                existing_codes.add(code)
                break
        conn.execute(text("UPDATE users SET referral_code = :code WHERE id = :id"), {"code": code, "id": user_id})
    print(f"Backfilled referral codes for {len(rows)} existing user(s).")


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt.strip())
            conn.execute(text(stmt))
        backfill_referral_codes(conn)
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
