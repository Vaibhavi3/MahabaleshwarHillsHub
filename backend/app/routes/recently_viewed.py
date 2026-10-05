from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/recently-viewed", response_model=list[schemas.RecentlyViewedResponse])
def get_recently_viewed(
    limit: int = Query(8, ge=1, le=50),
    exclude: int = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The signed-in user's product browsing history, most recent first -
    the account-backed half of the "Recently Viewed" rail (guests get a
    browser-local version instead, see the frontend RecentlyViewed
    component)."""
    query = (
        db.query(models.RecentlyViewed)
        .options(joinedload(models.RecentlyViewed.product))
        .filter(models.RecentlyViewed.user_id == current_user.id)
    )
    if exclude is not None:
        query = query.filter(models.RecentlyViewed.product_id != exclude)

    return query.order_by(models.RecentlyViewed.viewed_at.desc()).limit(limit).all()


@router.post("/recently-viewed/{product_id}", status_code=204)
def record_recently_viewed(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Record (or bump the timestamp on) a product view for the signed-in
    user. Called in the background from the product page, so failures are
    silent to the shopper - this is a browsing-history log, not an action
    they took."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(models.RecentlyViewed)
        .filter(
            models.RecentlyViewed.user_id == current_user.id,
            models.RecentlyViewed.product_id == product_id,
        )
        .first()
    )
    if existing:
        existing.viewed_at = func.now()
    else:
        db.add(models.RecentlyViewed(user_id=current_user.id, product_id=product_id))
    db.commit()
