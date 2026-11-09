"""
Optional: create a couple of starter curated collections ("edits") out of
products that already exist in the catalogue, so the new Collections
feature has something to show on day one instead of an empty homepage
section. Picks real, existing products grouped by their real category/
subcategory and rating - never invents a product, price, or review.

Safe to re-run - skips any collection whose slug already exists, and
skips a collection entirely if it would end up with no products (e.g. the
as-yet-empty Handmade Bags category).

Run with DATABASE_URL set, after migrate_add_collections_tables.py:
    python seed_starter_collections.py
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.orm import Session  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app import models  # noqa: E402

STARTER_COLLECTIONS = [
    {
        "title": "Cosy Socks Edit",
        "slug": "cosy-socks-edit",
        "description": "Our top-rated handmade socks, picked for the softest, warmest wear.",
        "category": "socks",
        "display_order": 0,
    },
    {
        "title": "Slidders You'll Live In",
        "slug": "slidders-you-will-live-in",
        "description": "Everyday handmade slidders our customers keep coming back for.",
        "category": "slidders",
        "display_order": 1,
    },
]

PRODUCTS_PER_COLLECTION = 8


def build_collection(db: Session, spec: dict) -> None:
    existing = db.query(models.Collection).filter(models.Collection.slug == spec["slug"]).first()
    if existing:
        print(f"Skipping '{spec['slug']}' - already exists.")
        return

    # One card per product family (parent SKU), highest-rated first - the
    # same "first variant represents the family" rule the product listing
    # page uses, so the edit doesn't show five colours of the same sock.
    candidates = (
        db.query(models.Product)
        .filter(models.Product.category == spec["category"])
        .order_by(models.Product.rating.desc(), models.Product.id)
        .all()
    )
    seen_families = set()
    picked = []
    for product in candidates:
        family = product.parent_sku or f"id-{product.id}"
        if family in seen_families:
            continue
        seen_families.add(family)
        picked.append(product)
        if len(picked) >= PRODUCTS_PER_COLLECTION:
            break

    if not picked:
        print(f"Skipping '{spec['slug']}' - no '{spec['category']}' products in the catalogue yet.")
        return

    collection = models.Collection(
        title=spec["title"],
        slug=spec["slug"],
        description=spec["description"],
        is_active=True,
        display_order=spec["display_order"],
    )
    db.add(collection)
    db.flush()

    for order, product in enumerate(picked):
        db.add(
            models.CollectionProduct(
                collection_id=collection.id,
                product_id=product.id,
                display_order=order,
            )
        )
    db.commit()
    print(f"Created '{spec['slug']}' with {len(picked)} products.")


def main():
    db = SessionLocal()
    try:
        for spec in STARTER_COLLECTIONS:
            build_collection(db, spec)
    finally:
        db.close()
    print("Done.")


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this script.")
    main()
