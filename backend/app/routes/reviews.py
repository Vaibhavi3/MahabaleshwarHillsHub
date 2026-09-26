from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user, get_current_user_optional
from sqlalchemy import func

router = APIRouter()


def _reviewer_display_name(user: models.User) -> str:
    if not user:
        return "Customer"
    if user.first_name:
        last_initial = f" {user.last_name[0]}." if user.last_name else ""
        return f"{user.first_name}{last_initial}"
    return user.username or "Customer"


@router.get("/products/{product_id}/reviews", response_model=list[schemas.ReviewResponse])
def get_product_reviews(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_optional),
):
    """Get all reviews for a product, newest first, each annotated with a
    display name, a "Verified Purchase" flag (the reviewer has a completed
    order containing this product - the same honest definition Nykaa/
    Myntra/Ajio use for their "Verified Buyer" badge), and whether the
    current viewer has already marked it helpful."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews = (
        db.query(models.Review)
        .filter(models.Review.product_id == product_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )
    if not reviews:
        return []

    verified_user_ids = {
        row[0]
        for row in db.query(models.Order.user_id)
        .join(models.OrderItem, models.OrderItem.order_id == models.Order.id)
        .filter(
            models.OrderItem.product_id == product_id,
            models.Order.payment_status == "completed",
        )
        .distinct()
        .all()
    }

    voted_review_ids = set()
    if current_user:
        voted_review_ids = {
            row[0]
            for row in db.query(models.ReviewHelpfulVote.review_id)
            .filter(
                models.ReviewHelpfulVote.review_id.in_([r.id for r in reviews]),
                models.ReviewHelpfulVote.user_id == current_user.id,
            )
            .all()
        }

    for review in reviews:
        review.reviewer_name = _reviewer_display_name(review.user)
        review.verified_purchase = review.user_id in verified_user_ids
        review.voted_helpful = review.id in voted_review_ids

    return reviews


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
        comment=review.comment
    )
    db.add(db_review)
    
    avg_rating = db.query(func.avg(models.Review.rating)).filter(
        models.Review.product_id == review.product_id
    ).scalar()
    product.rating = float(avg_rating) if avg_rating else 0
    
    db.commit()
    db.refresh(db_review)
    return db_review


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
    return db_review


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
    current_user: models.User = Depends(get_current_user)
):
    """Toggle "Was this helpful?" on a review, one vote per user (mirrors
    the helpful-vote count Myntra/Nykaa/Ajio show under each review)."""
    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="Review not found")

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
    return schemas.ReviewHelpfulResponse(helpful_count=db_review.helpful_count, voted_helpful=voted)