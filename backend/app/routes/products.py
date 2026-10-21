from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_admin_user
from app.utils.email import send_email
from sqlalchemy import or_, func

router = APIRouter()


@router.get("/products", response_model=list[schemas.ProductResponse])
def get_products(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=500),
    category: str = Query(None),
    subcategory: str = Query(None)
):
    """Get all products with optional filtering"""
    query = db.query(models.Product)

    if category:
        query = query.filter(models.Product.category == category)
    if subcategory:
        query = query.filter(models.Product.subcategory == subcategory)

    return query.offset(skip).limit(limit).all()


@router.get("/products/count")
def get_products_count(db: Session = Depends(get_db), category: str = Query(None), subcategory: str = Query(None)):
    """Get the total product count, optionally filtered by category/subcategory"""
    query = db.query(func.count(models.Product.id))
    if category:
        query = query.filter(models.Product.category == category)
    if subcategory:
        query = query.filter(models.Product.subcategory == subcategory)
    return {"total": query.scalar()}


@router.get("/products/search", response_model=list[schemas.ProductResponse])
def search_products(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """Search products by name or description"""
    search_term = f"%{q}%"
    return db.query(models.Product).filter(
        or_(
            models.Product.name.ilike(search_term),
            models.Product.description.ilike(search_term),
            models.Product.category.ilike(search_term)
        )
    ).all()


@router.get("/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get single product by ID"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/{product_id}/variants", response_model=list[schemas.ProductResponse])
def get_product_variants(product_id: int, db: Session = Depends(get_db)):
    """Other colour variants of the same product (same name, different id)"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return (
        db.query(models.Product)
        .filter(models.Product.name == product.name, models.Product.id != product_id)
        .all()
    )


@router.get("/products/{product_id}/similar", response_model=list[schemas.ProductResponse])
def get_similar_products(
    product_id: int,
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Other products in the same category, ranked by closest price"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return (
        db.query(models.Product)
        .filter(
            models.Product.category == product.category,
            models.Product.name != product.name,
        )
        .order_by(func.abs(models.Product.price - product.price))
        .limit(limit)
        .all()
    )


@router.get("/products/{product_id}/frequently-bought-together", response_model=list[schemas.ProductResponse])
def get_frequently_bought_together(
    product_id: int,
    limit: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """Item-item collaborative filtering: products most often bought in the
    same order as this one, ranked by co-purchase frequency. Falls back to
    same-category picks for products with no purchase history yet."""
    order_ids_subq = (
        db.query(models.OrderItem.order_id)
        .filter(models.OrderItem.product_id == product_id)
        .subquery()
    )

    co_purchased = (
        db.query(
            models.OrderItem.product_id,
            func.count(func.distinct(models.OrderItem.order_id)).label("co_count"),
        )
        .filter(
            models.OrderItem.order_id.in_(db.query(order_ids_subq.c.order_id)),
            models.OrderItem.product_id != product_id,
        )
        .group_by(models.OrderItem.product_id)
        .order_by(func.count(func.distinct(models.OrderItem.order_id)).desc())
        .limit(limit)
        .all()
    )

    product_ids = [row[0] for row in co_purchased]
    products = []
    if product_ids:
        rows_by_id = {p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(product_ids)).all()}
        products = [rows_by_id[pid] for pid in product_ids if pid in rows_by_id]

    if len(products) < limit:
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if product:
            exclude_ids = set(product_ids) | {product_id}
            fallback = (
                db.query(models.Product)
                .filter(models.Product.category == product.category, models.Product.id.notin_(exclude_ids))
                .order_by(models.Product.rating.desc())
                .limit(limit - len(products))
                .all()
            )
            products.extend(fallback)

    return products


@router.get("/products/{product_id}/complete-the-look", response_model=list[schemas.ProductResponse])
def get_complete_the_look(
    product_id: int,
    limit: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db)
):
    """Cross-category styling pick, inspired by Myntra's "Complete the Look"
    / My Stylist: /similar and frequently-bought-together both stay inside
    this product's own category, so a sock shopper never sees anything but
    more socks. This rounds out a small handmade gift set with the store's
    best-rated, in-stock pieces from the OTHER categories instead - e.g. a
    pair of socks surfaces a top slipper and a bag to complete a cozy set."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    other_categories = [
        row[0]
        for row in (
            db.query(models.Product.category)
            .filter(models.Product.category != product.category, models.Product.stock > 0)
            .distinct()
            .all()
        )
    ]
    if not other_categories:
        return []

    per_category = max(1, limit // len(other_categories))
    picks = []
    seen_ids = set()
    for category in other_categories:
        rows = (
            db.query(models.Product)
            .filter(models.Product.category == category, models.Product.stock > 0)
            .order_by(models.Product.rating.desc(), models.Product.created_at.desc())
            .limit(per_category + 2)
            .all()
        )
        added = 0
        for p in rows:
            if p.id in seen_ids:
                continue
            picks.append(p)
            seen_ids.add(p.id)
            added += 1
            if added >= per_category:
                break

    if len(picks) < limit:
        leftovers = (
            db.query(models.Product)
            .filter(
                models.Product.category.in_(other_categories),
                models.Product.stock > 0,
                models.Product.id.notin_(seen_ids),
            )
            .order_by(models.Product.rating.desc())
            .limit(limit - len(picks))
            .all()
        )
        picks.extend(leftovers)

    return picks[:limit]


@router.post("/products", response_model=schemas.ProductResponse)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user)
):
    """Create new product (Admin only)"""
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user)
):
    """Update product (Admin only)"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    was_out_of_stock = db_product.stock <= 0
    old_price = db_product.price

    update_data = product_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)

    if was_out_of_stock and db_product.stock > 0:
        _notify_back_in_stock(db, db_product)

    if "price" in update_data and db_product.price < old_price:
        _notify_price_drop(db, db_product)

    return db_product


def _notify_back_in_stock(db: Session, product: models.Product) -> None:
    """Email everyone with a pending "notify me" alert for this product,
    then mark them notified. Silently no-ops per-recipient if SMTP isn't
    configured (send_email logs and returns False) - the alerts still get
    marked so we don't keep retrying a permanently unconfigured mailer."""
    pending_alerts = (
        db.query(models.StockAlert)
        .filter(
            models.StockAlert.product_id == product.id,
            models.StockAlert.notified.is_(False),
        )
        .all()
    )
    if not pending_alerts:
        return

    for alert in pending_alerts:
        send_email(
            alert.email,
            f"Back in stock: {product.name}",
            (
                f"Good news - {product.name} is back in stock at Mahabaleshwar Hills Hub.\n\n"
                f"It's handmade in small batches, so it may sell out again.\n\n"
                f"https://mahabaleshwar-hills-hub-pi.vercel.app/products/{product.id}"
            ),
        )
        alert.notified = True
        alert.notified_at = func.now()

    db.commit()


def _notify_price_drop(db: Session, product: models.Product) -> None:
    """Email everyone who wishlisted this product while its price was
    higher than it is now, then mark them notified so the same drop
    doesn't re-email on a later unrelated edit. Mirrors
    _notify_back_in_stock above - same best-effort send_email, same
    one-time-per-event guard pattern as stock_alerts.notified."""
    dropped_for = (
        db.query(models.WishlistItem)
        .filter(
            models.WishlistItem.product_id == product.id,
            models.WishlistItem.price_drop_notified.is_(False),
            models.WishlistItem.price_at_add.isnot(None),
            models.WishlistItem.price_at_add > product.price,
        )
        .all()
    )
    if not dropped_for:
        return

    for item in dropped_for:
        user = db.query(models.User).filter(models.User.id == item.user_id).first()
        if user:
            send_email(
                user.email,
                f"Price drop: {product.name}",
                (
                    f"Good news - an item on your wishlist just got cheaper.\n\n"
                    f"{product.name} is now ₹{product.price:.0f} "
                    f"(was ₹{item.price_at_add:.0f}) at Mahabaleshwar Hills Hub.\n\n"
                    f"https://mahabaleshwar-hills-hub-pi.vercel.app/products/{product.id}"
                ),
            )
        item.price_drop_notified = True

    db.commit()


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user)
):
    """Delete product (Admin only)"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()
    return {"detail": "Product deleted successfully"}


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Get all unique product categories"""
    categories = db.query(models.Product.category).distinct().all()
    return {"categories": [cat[0] for cat in categories if cat[0]]}


@router.get("/categories/menu")
def get_category_menu(db: Session = Depends(get_db)):
    """Aggregated category/subcategory data for the header mega menu: a
    product count and one representative thumbnail per category and per
    subcategory, picked from an in-stock product where possible (falling
    back to any product so a sold-out category still gets a thumbnail).
    One query for the whole header, rather than the per-category N+1
    requests Home.js makes for its own category tiles."""
    rows = (
        db.query(
            models.Product.category,
            models.Product.subcategory,
            models.Product.image_url,
            models.Product.stock,
            models.Product.rating,
        )
        .filter(models.Product.category.isnot(None))
        .all()
    )

    def best_thumbnail(candidates):
        in_stock = [r for r in candidates if r.stock and r.stock > 0]
        pool = in_stock or candidates
        if not pool:
            return None
        return max(pool, key=lambda r: (r.rating or 0)).image_url

    categories = {}
    for row in rows:
        entry = categories.setdefault(
            row.category, {"rows": [], "subcategories": {}}
        )
        entry["rows"].append(row)
        if row.subcategory:
            entry["subcategories"].setdefault(row.subcategory, []).append(row)

    result = {}
    for category, data in categories.items():
        result[category] = {
            "product_count": len(data["rows"]),
            "image_url": best_thumbnail(data["rows"]),
            "subcategories": {
                sub: {
                    "product_count": len(sub_rows),
                    "image_url": best_thumbnail(sub_rows),
                }
                for sub, sub_rows in data["subcategories"].items()
            },
        }

    return {"categories": result}