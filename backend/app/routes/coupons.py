from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user, get_current_admin_user

router = APIRouter()


def compute_discount(coupon: models.Coupon, order_total: float) -> tuple[bool, str, float]:
    """Shared validation used by both the preview endpoint and order creation.
    Returns (is_valid, message, discount_amount)."""
    if not coupon:
        return False, "Invalid coupon code", 0

    if not coupon.is_active:
        return False, "This coupon is no longer active", 0

    if coupon.expires_at:
        expires_at = coupon.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return False, "This coupon has expired", 0

    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        return False, "This coupon has reached its usage limit", 0

    if order_total < coupon.min_order_value:
        return False, f"Minimum order value for this coupon is ₹{coupon.min_order_value:.0f}", 0

    if coupon.discount_type == "percent":
        discount = order_total * (coupon.discount_value / 100)
        if coupon.max_discount:
            discount = min(discount, coupon.max_discount)
    else:
        discount = coupon.discount_value

    discount = min(discount, order_total)
    return True, "Coupon applied", round(discount, 2)


@router.post("/coupons/validate", response_model=schemas.CouponValidateResponse)
def validate_coupon(
    payload: schemas.CouponValidateRequest,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    """Preview a coupon's discount for the current cart total (does not consume usage)."""
    coupon = db.query(models.Coupon).filter(models.Coupon.code.ilike(payload.code.strip())).first()
    valid, message, discount = compute_discount(coupon, payload.order_total)
    return schemas.CouponValidateResponse(
        valid=valid,
        message=message,
        discount_amount=discount,
        final_total=round(payload.order_total - discount, 2),
    )


@router.get("/coupons", response_model=list[schemas.CouponResponse])
def list_coupons(db: Session = Depends(get_db), _admin: models.User = Depends(get_current_admin_user)):
    """List all coupons (Admin only)"""
    return db.query(models.Coupon).order_by(models.Coupon.created_at.desc()).all()


@router.post("/coupons", response_model=schemas.CouponResponse)
def create_coupon(
    coupon: schemas.CouponCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Create a coupon (Admin only)"""
    existing = db.query(models.Coupon).filter(models.Coupon.code.ilike(coupon.code.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="A coupon with this code already exists")

    db_coupon = models.Coupon(**{**coupon.dict(), "code": coupon.code.strip().upper()})
    db.add(db_coupon)
    db.commit()
    db.refresh(db_coupon)
    return db_coupon


@router.put("/coupons/{coupon_id}", response_model=schemas.CouponResponse)
def update_coupon(
    coupon_id: int,
    coupon_update: schemas.CouponUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Update a coupon (Admin only)"""
    db_coupon = db.query(models.Coupon).filter(models.Coupon.id == coupon_id).first()
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    for key, value in coupon_update.dict(exclude_unset=True).items():
        setattr(db_coupon, key, value)

    db.commit()
    db.refresh(db_coupon)
    return db_coupon


@router.delete("/coupons/{coupon_id}")
def delete_coupon(
    coupon_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Delete a coupon (Admin only)"""
    db_coupon = db.query(models.Coupon).filter(models.Coupon.id == coupon_id).first()
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(db_coupon)
    db.commit()
    return {"detail": "Coupon deleted"}
