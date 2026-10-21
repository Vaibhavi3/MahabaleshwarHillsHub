"""
One-off: create the `support_tickets` table used by the Help Center
("Need Help?") self-service ticket flow, inspired by Myntra/Nykaa/Ajio's
support-ticket UX - and the "contact support" channel the order
cancellation and return-request flows already mention but which never
actually existed.

Base.metadata.create_all() (run on every app startup) already creates
this table automatically on a fresh database, so this script only matters
for an existing production database that needs it added without a
restart. Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_support_tickets_table.py
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
    CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id),
        category VARCHAR(30) NOT NULL,
        subject VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        admin_reply TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_support_tickets_user_id ON support_tickets (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_support_tickets_order_id ON support_tickets (order_id)",
    "CREATE INDEX IF NOT EXISTS ix_support_tickets_status ON support_tickets (status)",
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
