from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user, get_current_user_optional
from sqlalchemy import func
from typing import Optional

router = APIRouter()


def _reviewer_name(user: models.User) -> str:
    """First name + last-initial, e.g. "Vaibhavi B." - never the full name
    or email, and never fabricated when a name is missing."""
    name = (user.first_name or user.username or "Customer").strip()
    if user.last_name:
        name = f"{name} {user.last_name.strip()[0]}."
    return name


def _has_verified_purchase(db: Session, user_id: int, product_id: int) -> bool:
    return (
        db.query(models.OrderItem)
        .join(models.Order, models.OrderItem.order_id == models.Order.id)
        .filter(
            models.Order.user_id == user_id,
            models.Order.payment_status == "completed",
            models.OrderItem.product_id == product_id,
        )
        .first()
        is not None
    )


def _to_response(review: models.Review, voted_review_ids: set) -> schemas.ReviewResponse:
    return schemas.ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        product_id=review.product_id,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        helpful_count=review.helpful_count or 0,
        verified_purchase=review.verified_purchase,
        reviewer_name=_reviewer_name(review.user),
        voted_helpful=review.id in voted_review_ids,
        created_at=review.created_at,
    )


@router.get("/products/{product_id}/reviews", response_model=list[schemas.ReviewResponse])
def get_product_reviews(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """Get all reviews for a product, newest first."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews = (
        db.query(models.Review)
        .filter(models.Review.product_id == product_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )

    voted_review_ids = set()
    if current_user and reviews:
        voted_review_ids = {
            row.review_id
            for row in db.query(models.ReviewHelpfulVote.review_id).filter(
                models.ReviewHelpfulVote.user_id == current_user.id,
                models.ReviewHelpfulVote.review_id.in_([r.id for r in reviews]),
            )
        }

    return [_to_response(r, voted_review_ids) for r in reviews]


@router.post("/reviews", response_model=schemas.ReviewResponse)
def create_review(
    review: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create product review"""
    product = db.query(models.Product).filter(models.Product.id == review.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing_review = db.query(models.Review).filter(
        models.Review.user_id == current_user.id,
        models.Review.product_id == review.product_id
    ).first()

    if existing_review:
        raise HTTPException(status_code=400, detail="You already reviewed this product")

    db_review = models.Review(
        user_id=current_user.id,
        product_id=review.product_id,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        verified_purchase=_has_verified_purchase(db, current_user.id, review.product_id),
    )
    db.add(db_review)

    avg_rating = db.query(func.avg(models.Review.rating)).filter(
        models.Review.product_id == review.product_id
    ).scalar()
    product.rating = float(avg_rating) if avg_rating else 0

    db.commit()
    db.refresh(db_review)
    return _to_response(db_review, set())


@router.put("/reviews/{review_id}", response_model=schemas.ReviewResponse)
def update_review(
    review_id: int,
    review_update: schemas.ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update own review"""
    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="Review not found")

    if db_review.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = review_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_review, key, value)

    product = db.query(models.Product).filter(models.Product.id == db_review.product_id).first()
    avg_rating = db.query(func.avg(models.Review.rating)).filter(
        models.Review.product_id == db_review.product_id
    ).scalar()
    product.rating = float(avg_rating) if avg_rating else 0

    db.commit()
    db.refresh(db_review)

    voted_review_ids = set()
    existing_vote = db.query(models.ReviewHelpfulVote).filter(
        models.ReviewHelpfulVote.review_id == db_review.id,
        models.ReviewHelpfulVote.user_id == current_user.id,
    ).first()
    if existing_vote:
        voted_review_ids.add(db_review.id)
    return _to_response(db_review, voted_review_ids)


@router.delete("/reviews/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete review"""
    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="Review not found")

    if db_review.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    product_id = db_review.product_id
    db.delete(db_review)

    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    avg_rating = db.query(func.avg(models.Review.rating)).filter(
        models.Review.product_id == product_id
    ).scalar()
    product.rating = float(avg_rating) if avg_rating else 0

    db.commit()
    return {"detail": "Review deleted successfully"}


@router.post("/reviews/{review_id}/helpful", response_model=schemas.ReviewHelpfulResponse)
def toggle_review_helpful(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark/unmark a review as helpful. Toggling again removes the vote.
    One vote per customer, backed by a real DB row - never a fabricated count."""
    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="Review not found")

    if db_review.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't mark your own review as helpful")

    existing_vote = db.query(models.ReviewHelpfulVote).filter(
        models.ReviewHelpfulVote.review_id == review_id,
        models.ReviewHelpfulVote.user_id == current_user.id,
    ).first()

    if existing_vote:
        db.delete(existing_vote)
        db_review.helpful_count = max(0, (db_review.helpful_count or 0) - 1)
        voted = False
    else:
        db.add(models.ReviewHelpfulVote(review_id=review_id, user_id=current_user.id))
        db_review.helpful_count = (db_review.helpful_count or 0) + 1
        voted = True

    db.commit()
    db.refresh(db_review)
    return schemas.ReviewHelpfulResponse(helpful_count=db_review.helpful_count, voted_helpful=voted)
