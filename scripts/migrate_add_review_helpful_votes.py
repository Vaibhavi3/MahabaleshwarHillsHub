"""
One-off: add the `verified_purchase` column to the existing `reviews`
table, and create the `review_helpful_votes` table used by the "mark this
review helpful" feature on product pages.

Base.metadata.create_all() (run on every app startup) creates the new
`review_helpful_votes` table automatically, but it does not ALTER the
existing `reviews` table to add the new column, so that part needs to run
once by hand.

Safe to re-run - uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_review_helpful_votes.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN DEFAULT FALSE",
    """
    CREATE TABLE IF NOT EXISTS review_helpful_votes (
        id SERIAL PRIMARY KEY,
        review_id INTEGER NOT NULL REFERENCES reviews(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_review_helpful_vote UNIQUE (review_id, user_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_review_helpful_votes_review_id ON review_helpful_votes (review_id)",
    "CREATE INDEX IF NOT EXISTS ix_review_helpful_votes_user_id ON review_helpful_votes (user_id)",
]

BACKFILL_STATEMENT = """
UPDATE reviews r
SET verified_purchase = TRUE
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.product_id = r.product_id
  AND o.user_id = r.user_id
  AND o.payment_status = 'completed'
  AND r.verified_purchase IS DISTINCT FROM TRUE
"""


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print("Running:", stmt.strip())
            conn.execute(text(stmt))
        print("Backfilling verified_purchase for existing reviews...")
        conn.execute(text(BACKFILL_STATEMENT))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
