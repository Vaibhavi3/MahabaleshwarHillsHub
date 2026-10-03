from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user

router = APIRouter()


def _get_wishlist_items(db: Session, user_id: int):
    return (
        db.query(models.WishlistItem)
        .options(joinedload(models.WishlistItem.product))
        .filter(models.WishlistItem.user_id == user_id)
        .order_by(models.WishlistItem.created_at.desc())
        .all()
    )


@router.get("/wishlist", response_model=list[schemas.WishlistItemResponse])
def get_wishlist(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The signed-in user's saved items, tied to their account - like
    Myntra/Nykaa/Ajio, so the wishlist follows them across devices and
    browsers instead of living only in this browser's local storage."""
    return _get_wishlist_items(db, current_user.id)


@router.post("/wishlist/sync", response_model=list[schemas.WishlistItemResponse])
def sync_wishlist(
    payload: schemas.WishlistSyncRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Merge a guest-era, browser-local wishlist into the account on login.
    Called once right after sign-in with whatever product ids were saved in
    this browser's local storage; adds any that aren't already on the
    account and silently skips ids that don't exist (deleted products) or
    are already saved. Always returns the full, merged, account-backed
    list so the frontend can replace its local copy with the source of
    truth. Registered ahead of the /wishlist/{product_id} routes below so
    "sync" is never captured as a product_id path param."""
    if payload.product_ids:
        existing_ids = {
            row[0]
            for row in db.query(models.WishlistItem.product_id).filter(
                models.WishlistItem.user_id == current_user.id
            )
        }
        valid_product_ids = {
            row[0]
            for row in db.query(models.Product.id).filter(models.Product.id.in_(payload.product_ids))
        }
        new_ids = valid_product_ids - existing_ids
        for product_id in new_ids:
            db.add(models.WishlistItem(user_id=current_user.id, product_id=product_id))
        if new_ids:
            db.commit()

    return _get_wishlist_items(db, current_user.id)


@router.post("/wishlist/{product_id}", response_model=list[schemas.WishlistItemResponse])
def add_to_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(models.WishlistItem)
        .filter(
            models.WishlistItem.user_id == current_user.id,
            models.WishlistItem.product_id == product_id,
        )
        .first()
    )
    if not existing:
        db.add(models.WishlistItem(user_id=current_user.id, product_id=product_id))
        db.commit()

    return _get_wishlist_items(db, current_user.id)


@router.delete("/wishlist/{product_id}", response_model=list[schemas.WishlistItemResponse])
def remove_from_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.WishlistItem).filter(
        models.WishlistItem.user_id == current_user.id,
        models.WishlistItem.product_id == product_id,
    ).delete()
    db.commit()

    return _get_wishlist_items(db, current_user.id)
