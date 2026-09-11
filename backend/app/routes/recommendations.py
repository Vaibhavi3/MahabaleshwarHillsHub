from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user_optional

router = APIRouter()


@router.get("/recommendations/for-you", response_model=list[schemas.ProductResponse])
def get_recommendations_for_you(
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """Personalized picks. Logged-in users with order history get products
    from their most-ordered categories (excluding what they already bought),
    ranked by rating. Everyone else (guests, or logged-in users with no
    orders yet) gets the site's best-selling products - a real popularity
    signal from order history, not a placeholder."""
    if current_user:
        category_rows = (
            db.query(models.Product.category, func.count(models.OrderItem.id).label("cnt"))
            .join(models.OrderItem, models.OrderItem.product_id == models.Product.id)
            .join(models.Order, models.Order.id == models.OrderItem.order_id)
            .filter(models.Order.user_id == current_user.id)
            .group_by(models.Product.category)
            .order_by(func.count(models.OrderItem.id).desc())
            .all()
        )
        preferred_categories = [row[0] for row in category_rows]

        if preferred_categories:
            purchased_ids_subq = (
                db.query(models.OrderItem.product_id)
                .join(models.Order, models.Order.id == models.OrderItem.order_id)
                .filter(models.Order.user_id == current_user.id)
            )
            recs = (
                db.query(models.Product)
                .filter(
                    models.Product.category.in_(preferred_categories),
                    models.Product.id.notin_(purchased_ids_subq),
                )
                .order_by(models.Product.rating.desc())
                .limit(limit)
                .all()
            )
            if recs:
                return recs

    # Trending fallback: best-sellers by total units ordered, then rating.
    bestseller_rows = (
        db.query(models.OrderItem.product_id, func.sum(models.OrderItem.quantity).label("units"))
        .group_by(models.OrderItem.product_id)
        .order_by(func.sum(models.OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    product_ids = [row[0] for row in bestseller_rows]
    if product_ids:
        rows_by_id = {p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(product_ids)).all()}
        trending = [rows_by_id[pid] for pid in product_ids if pid in rows_by_id]
        if len(trending) >= limit:
            return trending
        exclude_ids = set(product_ids)
    else:
        trending = []
        exclude_ids = set()

    fallback = (
        db.query(models.Product)
        .filter(models.Product.id.notin_(exclude_ids))
        .order_by(models.Product.rating.desc(), models.Product.created_at.desc())
        .limit(limit - len(trending))
        .all()
    )
    return trending + fallback
