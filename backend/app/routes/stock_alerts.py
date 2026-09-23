from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user, get_current_user_optional, get_current_admin_user

router = APIRouter()


@router.get("/products/{product_id}/notify-me", response_model=schemas.StockAlertStatus)
def get_notify_me_status(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_optional),
):
    """Whether the current user already has a pending back-in-stock alert
    for this product. Works for guests too so the page can render without
    forcing a login check first - it just always reports False for them."""
    if current_user is None:
        return schemas.StockAlertStatus(subscribed=False)

    alert = (
        db.query(models.StockAlert)
        .filter(
            models.StockAlert.product_id == product_id,
            models.StockAlert.user_id == current_user.id,
            models.StockAlert.notified.is_(False),
        )
        .first()
    )
    return schemas.StockAlertStatus(subscribed=alert is not None)


@router.post("/products/{product_id}/notify-me", response_model=schemas.StockAlertStatus)
def subscribe_notify_me(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ask to be emailed when an out-of-stock product is back in stock."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock > 0:
        raise HTTPException(status_code=400, detail="This product is already in stock")

    existing = (
        db.query(models.StockAlert)
        .filter(
            models.StockAlert.product_id == product_id,
            models.StockAlert.user_id == current_user.id,
            models.StockAlert.notified.is_(False),
        )
        .first()
    )
    if not existing:
        db.add(
            models.StockAlert(
                product_id=product_id,
                user_id=current_user.id,
                email=current_user.email,
            )
        )
        db.commit()

    return schemas.StockAlertStatus(subscribed=True)


@router.delete("/products/{product_id}/notify-me", response_model=schemas.StockAlertStatus)
def unsubscribe_notify_me(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Cancel a pending back-in-stock alert."""
    db.query(models.StockAlert).filter(
        models.StockAlert.product_id == product_id,
        models.StockAlert.user_id == current_user.id,
        models.StockAlert.notified.is_(False),
    ).delete()
    db.commit()
    return schemas.StockAlertStatus(subscribed=False)


@router.get("/stock-alerts/admin/pending-counts")
def get_pending_alert_counts(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """How many customers are waiting on a back-in-stock email, per product
    (admin only) - so restocking decisions aren't made blind, even on a
    deployment where SMTP_* isn't configured and no email actually goes out."""
    rows = (
        db.query(models.StockAlert.product_id, func.count(models.StockAlert.id))
        .filter(models.StockAlert.notified.is_(False))
        .group_by(models.StockAlert.product_id)
        .all()
    )
    return {str(product_id): count for product_id, count in rows}
