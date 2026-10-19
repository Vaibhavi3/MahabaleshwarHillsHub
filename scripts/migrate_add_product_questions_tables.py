"""
One-off: create the `product_questions` and `product_answers` tables used
by the new Customer Questions & Answers feature on the product detail
page (inspired by Myntra/Nykaa/Ajio's pre-purchase Q&A - distinct from
star reviews).

In practice `Base.metadata.create_all()` (run on every app startup, see
backend/app/main.py) already creates brand new tables automatically, so
these tables will exist on their own after the next backend deploy. This
script exists as a belt-and-suspenders way to create them immediately,
following the same pattern as migrate_add_review_photos_table.py.

Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set, any time before or after this PR merges
(it only adds new tables, so it is safe to run early):
    python migrate_add_product_questions_tables.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from app.database import engine  # noqa: E402

QUESTIONS_STATEMENT = """
CREATE TABLE IF NOT EXISTS product_questions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
)
"""

ANSWERS_STATEMENT = """
CREATE TABLE IF NOT EXISTS product_answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES product_questions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    answer TEXT NOT NULL,
    is_seller BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
)
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_product_questions_product_id ON product_questions (product_id)",
    "CREATE INDEX IF NOT EXISTS ix_product_answers_question_id ON product_answers (question_id)",
]


def main():
    with engine.begin() as conn:
        print("Running:", QUESTIONS_STATEMENT.strip())
        conn.execute(text(QUESTIONS_STATEMENT))
        print("Running:", ANSWERS_STATEMENT.strip())
        conn.execute(text(ANSWERS_STATEMENT))
        for stmt in INDEX_STATEMENTS:
            print("Running:", stmt)
            conn.execute(text(stmt))
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this migration.")
    main()
