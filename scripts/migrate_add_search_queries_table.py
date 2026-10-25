"""
One-off: create the `search_queries` table used to power "Trending
Searches" on the header search panel, inspired by Myntra/Ajio/Nykaa's
search landing experience - real search terms shoppers have actually
submitted, aggregated and ranked by count, never a seeded/fabricated list.

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
this table will exist on its own after the next backend deploy. This
script exists as a belt-and-suspenders way to create it immediately,
following the same pattern as migrate_add_recently_viewed_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set, any time before or after this PR merges (the
app also self-creates the table on its next deploy either way):
    python migrate_add_search_queries_table.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

STATEMENT = """
CREATE TABLE IF NOT EXISTS search_queries (
    id SERIAL PRIMARY KEY,
    term VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_search_queries_term ON search_queries (term)",
    "CREATE INDEX IF NOT EXISTS ix_search_queries_user_id ON search_queries (user_id)",
]


def main():
    with engine.begin() as conn:
        print("Running:", STATEMENT.strip())
        conn.execute(text(STATEMENT))
        for stmt in INDEX_STATEMENTS:
            print("Running:", stmt)
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
