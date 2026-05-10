from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
from sqlalchemy import func

router = APIRouter()


@router.get("/products/{product_id}/reviews", response_model=list[schemas.ReviewResponse])
def get_product_reviews(
    product_id: int,
    db: Session = Depends(get_db)
):
    """Get all reviews for a product"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return db.query(models.Review).filter(models.Review.product_id == product_id).all()


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