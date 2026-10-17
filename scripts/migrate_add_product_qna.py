"""
One-off: create the `product_questions` and `product_answers` tables used
by the product Q&A feature ("Customer Questions & Answers" on the product
detail page, inspired by Nykaa's product Q&A).

Base.metadata.create_all() (run on every app startup) already creates
these tables automatically on a fresh database, so this script only
matters for an existing production database that needs them added
without a restart. Safe to re-run - uses CREATE TABLE IF NOT EXISTS.

Run with DATABASE_URL set:
    python migrate_add_product_qna.py
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
    CREATE TABLE IF NOT EXISTS product_questions (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        question TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_product_questions_product_id ON product_questions (product_id)",
    """
    CREATE TABLE IF NOT EXISTS product_answers (
        id SERIAL PRIMARY KEY,
        question_id INTEGER NOT NULL REFERENCES product_questions(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        answer TEXT NOT NULL,
        is_seller_answer BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_product_answers_question_id ON product_answers (question_id)",
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
