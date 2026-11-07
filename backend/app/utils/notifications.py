from typing import Optional

from sqlalchemy.orm import Session

from app import models


def notify(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> models.Notification:
    """Add an in-app notification row for the header bell's feed.

    Only adds to the session - the caller commits as part of whatever
    transaction is already saving the event this notification is about,
    so a notification can never be recorded for a change that itself
    failed to save.
    """
    notification = models.Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notification)
    return notification
