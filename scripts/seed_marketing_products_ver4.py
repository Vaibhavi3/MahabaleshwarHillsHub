"""
Loads marketing_products_ver4_seed.json (produced by
add_marketing_products_ver4.py) into the products table. Safe to re-run -
upserts by name+color.

Run with DATABASE_URL etc. set:
    python seed_marketing_products_ver4.py
"""
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal  # noqa: E402
from app import models  # noqa: E402

SEED_FILE = Path(__file__).resolve().parent / "marketing_products_ver4_seed.json"


def main():
    records = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    db = SessionLocal()
    created, updated = 0, 0
    try:
        for r in records:
            existing = db.query(models.Product).filter(
                models.Product.name == r["name"],
                models.Product.color == r["color"],
            ).first()

            fields = dict(
                name=r["name"],
                description=r["description"],
                price=r["price"],
                stock=r["stock"],
                category=r["category"],
                image_url=r["image_url"],
                color=r["color"],
                size=r["size"],
                material=r["material"],
            )

            if existing:
                for key, value in fields.items():
                    setattr(existing, key, value)
                updated += 1
            else:
                db.add(models.Product(**fields))
                created += 1

        db.commit()
        print(f"Marketing products (ver4): {created} created, {updated} updated ({len(records)} total)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
