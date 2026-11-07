from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user

router = APIRouter()


def _get_saved_items(db: Session, user_id: int):
    return (
        db.query(models.SavedForLaterItem)
        .options(joinedload(models.SavedForLaterItem.product))
        .filter(models.SavedForLaterItem.user_id == user_id)
        .order_by(models.SavedForLaterItem.created_at.desc())
        .all()
    )


@router.get("/saved-for-later", response_model=list[schemas.SavedForLaterItemResponse])
def get_saved_for_later(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The signed-in user's "Saved for Later" bag items - tied to their
    account like Myntra/Amazon, so items set aside on one device are still
    there on another."""
    return _get_saved_items(db, current_user.id)


@router.post("/saved-for-later/{product_id}", response_model=list[schemas.SavedForLaterItemResponse])
def save_for_later(
    product_id: int,
    payload: schemas.SaveForLaterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Move an item out of the bag into the account-backed "Saved for
    Later" list, keeping its quantity (capped to current stock) so it can
    be restored exactly later."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(models.SavedForLaterItem)
        .filter(
            models.SavedForLaterItem.user_id == current_user.id,
            models.SavedForLaterItem.product_id == product_id,
        )
        .first()
    )
    requested_quantity = payload.quantity + (existing.quantity if existing else 0)
    quantity = max(1, min(requested_quantity, product.stock) if product.stock else requested_quantity)

    if existing:
        existing.quantity = quantity
    else:
        db.add(
            models.SavedForLaterItem(
                user_id=current_user.id,
                product_id=product_id,
                quantity=quantity,
            )
        )
    db.commit()

    return _get_saved_items(db, current_user.id)


@router.delete("/saved-for-later/{product_id}", response_model=list[schemas.SavedForLaterItemResponse])
def remove_saved_for_later(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Remove an item from "Saved for Later" - used both for an outright
    delete and, from the frontend, right before re-adding it to the bag
    when the shopper taps "Move to Bag"."""
    db.query(models.SavedForLaterItem).filter(
        models.SavedForLaterItem.user_id == current_user.id,
        models.SavedForLaterItem.product_id == product_id,
    ).delete()
    db.commit()

    return _get_saved_items(db, current_user.id)
