from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.utils.auth import get_current_user

router = APIRouter()

# The bell only ever needs a recent feed, not full history - caps the
# query instead of growing unbounded for a long-standing account.
MAX_NOTIFICATIONS = 50


@router.get("/notifications", response_model=list[schemas.NotificationResponse])
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The signed-in customer's own notification feed - order status,
    price-drop and back-in-stock alerts, return/support updates and
    loyalty points, newest first. Matches the notification/updates inbox
    Myntra, Nykaa and Ajio all show behind a bell icon in their header."""
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(MAX_NOTIFICATIONS)
        .all()
    )


@router.get("/notifications/unread-count", response_model=schemas.UnreadNotificationCountResponse)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Powers the badge on the header bell without fetching the full feed."""
    count = (
        db.query(func.count(models.Notification.id))
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read.is_(False))
        .scalar()
    )
    return schemas.UnreadNotificationCountResponse(unread_count=count or 0)


@router.post("/notifications/{notification_id}/read", response_model=schemas.NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/notifications/read-all", response_model=schemas.UnreadNotificationCountResponse)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()
    return schemas.UnreadNotificationCountResponse(unread_count=0)
