"""
One-off: add real-refund tracking columns to the existing `payments` and
`return_requests` tables, used by order cancellation and completed
returns to issue (and record) an actual Stripe/Razorpay refund instead
of just restocking and walking away - matching Myntra/Nykaa/Ajio's
"refund to original payment method" flow.

Base.metadata.create_all() (run on every app startup) creates brand new
tables fine but does not ALTER existing tables to add columns, so this
needs to run once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_refund_columns.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_amount FLOAT NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) NOT NULL DEFAULT 'none'",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_transaction_id VARCHAR(100)",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ",
    "ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS refund_amount FLOAT NOT NULL DEFAULT 0",
    "ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) NOT NULL DEFAULT 'none'",
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
