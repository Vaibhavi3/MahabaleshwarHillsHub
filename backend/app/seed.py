"""
Loads scripts/products_seed.json into the products table and ensures an
admin user exists (from ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_USERNAME env vars).

Run once per environment (safe to re-run - upserts by SKU+color, skips if
the admin user already exists):
    python -m app.seed
"""
import json
import os
from pathlib import Path

from app.database import SessionLocal, engine, Base
from app import models
from app.utils.auth import get_password_hash

SEED_FILE = Path(__file__).resolve().parents[2] / "scripts" / "products_seed.json"

FEATURED_SKUS = {"1160", "10001", "10005", "1345"}


def seed_products(db):
    if not SEED_FILE.exists():
        print(f"No seed file at {SEED_FILE}, skipping product seed.")
        return

    records = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    created, updated = 0, 0

    for r in records:
        existing = db.query(models.Product).filter(
            models.Product.name == r["name"],
            models.Product.color == r["color"],
        ).first()

        description = f"{r['material']} - {r['size']}" if r.get("size") else r["material"]
        if r.get("compare_at_price") and r["compare_at_price"] > r["price"]:
            description += f" (MRP Rs.{r['compare_at_price']})"

        fields = dict(
            name=r["name"],
            description=description,
            price=r["price"],
            stock=r["stock"],
            category=r["category"],
            image_url=r["image_url"],
            color=r["color"],
            size=r.get("size"),
            material=r.get("material"),
            is_featured=r["sku"] in FEATURED_SKUS,
        )

        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
            updated += 1
        else:
            db.add(models.Product(**fields))
            created += 1

    db.commit()
    print(f"Products: {created} created, {updated} updated ({len(records)} total in seed file)")


def seed_admin(db):
    email = os.environ["ADMIN_EMAIL"]
    password = os.environ["ADMIN_PASSWORD"]
    username = os.getenv("ADMIN_USERNAME", "admin")

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        if not existing.is_admin:
            existing.is_admin = True
            db.commit()
        print(f"Admin user already exists: {email}")
        return

    admin = models.User(
        username=username,
        email=email,
        hashed_password=get_password_hash(password),
        is_admin=True,
        is_active=True,
    )
    db.add(admin)
    db.flush()
    db.add(models.Cart(user_id=admin.id))
    db.commit()
    print(f"Created admin user: {email}")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_products(db)
        seed_admin(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
