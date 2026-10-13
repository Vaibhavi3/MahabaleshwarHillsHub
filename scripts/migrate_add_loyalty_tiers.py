"""
One-off: add the `lifetime_spend` column behind Hills Rewards tiers
(Bronze/Silver/Gold), modelled on Myntra Insider's spend-based tier ladder -
the more a shopper's lifetime delivered-order spend grows, the better their
points-earn rate.

Also backfills `lifetime_spend` for existing customers from their order
history, so a loyal customer with past delivered orders starts in the
correct tier instead of being reset to Bronze.

Safe to re-run - the ALTER is IF NOT EXISTS, and the backfill recomputes
the same deterministic sum each time (it only ever sums `points_credited`
delivered orders, which is exactly what the app itself keeps
`lifetime_spend` in sync with going forward).

Run with DATABASE_URL set, any time after deploying this change:
    python migrate_add_loyalty_tiers.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

ADD_COLUMN = "ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_spend FLOAT NOT NULL DEFAULT 0"

BACKFILL = """
UPDATE users
SET lifetime_spend = COALESCE(sub.total, 0)
FROM (
    SELECT user_id, SUM(total_amount) AS total
    FROM orders
    WHERE points_credited = true
    GROUP BY user_id
) AS sub
WHERE users.id = sub.user_id
"""


def main():
    with engine.begin() as conn:
        print("Running:", ADD_COLUMN.strip())
        conn.execute(text(ADD_COLUMN))
        print("Running: backfill lifetime_spend from delivered orders")
        conn.execute(text(BACKFILL))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
