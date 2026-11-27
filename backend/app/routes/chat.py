import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.utils.auth import get_current_user, get_current_admin_user
from app.utils.email import send_email
from app.utils.notifications import notify

router = APIRouter()


@router.get("/chat/messages", response_model=list[schemas.ChatMessageResponse])
def get_my_chat_messages(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The signed-in customer's own live-chat thread with the store,
    oldest first. Opening it marks every admin reply as read."""
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.user_id == current_user.id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )

    unread = [m for m in messages if m.sender == "admin" and not m.is_read_by_customer]
    for m in unread:
        m.is_read_by_customer = True
    if unread:
        db.commit()

    return messages


@router.get("/chat/unread-count", response_model=schemas.ChatUnreadCountResponse)
def get_my_chat_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Unread admin replies, for the floating chat button's own badge -
    so a customer sees a reply landed even without opening the header's
    notification bell."""
    count = (
        db.query(models.ChatMessage)
        .filter(
            models.ChatMessage.user_id == current_user.id,
            models.ChatMessage.sender == "admin",
            models.ChatMessage.is_read_by_customer.is_(False),
        )
        .count()
    )
    return schemas.ChatUnreadCountResponse(unread_count=count)


@router.post("/chat/messages", response_model=schemas.ChatMessageResponse, status_code=201)
def send_chat_message(
    payload: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send a message in the customer's own live-chat thread - the
    "Chat with us" entry point on Help and (pre-filled with an order
    number) on My Orders."""
    message = models.ChatMessage(
        user_id=current_user.id,
        sender="customer",
        body=payload.body.strip(),
        is_read_by_customer=True,
        is_read_by_admin=False,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    admin_email = os.getenv("ADMIN_EMAIL")
    if admin_email:
        send_email(
            admin_email,
            f"New chat message from {current_user.email}",
            f"{message.body}\n\nReply from the admin dashboard's Live Chat tab.",
        )

    return message


@router.get("/chat/admin/threads", response_model=list[schemas.ChatThreadSummary])
def get_chat_threads(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Every customer who has ever messaged the store, most recently
    active first, for the admin dashboard's Live Chat tab - the same
    "inbox of conversations" view Myntra/Nykaa/Ajio's support agents work
    from."""
    user_ids = [row[0] for row in db.query(models.ChatMessage.user_id).distinct()]
    threads = []
    for user_id in user_ids:
        messages = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.user_id == user_id)
            .order_by(models.ChatMessage.created_at.desc())
            .all()
        )
        if not messages:
            continue
        last = messages[0]
        unread_count = sum(1 for m in messages if m.sender == "customer" and not m.is_read_by_admin)
        threads.append(
            schemas.ChatThreadSummary(
                user_id=user_id,
                user_name=last.user_name,
                user_email=last.user_email,
                last_message=last.body,
                last_message_at=last.created_at,
                last_sender=last.sender,
                unread_count=unread_count,
            )
        )
    threads.sort(key=lambda t: t.last_message_at, reverse=True)
    return threads


@router.get("/chat/admin/{user_id}/messages", response_model=list[schemas.ChatMessageResponse])
def get_chat_thread(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """One customer's full chat thread, for the admin dashboard. Opening
    it marks every customer message as read."""
    customer = db.query(models.User).filter(models.User.id == user_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.user_id == user_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )

    unread = [m for m in messages if m.sender == "customer" and not m.is_read_by_admin]
    for m in unread:
        m.is_read_by_admin = True
    if unread:
        db.commit()

    return messages


@router.post("/chat/admin/{user_id}/messages", response_model=schemas.ChatMessageResponse, status_code=201)
def reply_to_chat_thread(
    user_id: int,
    payload: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Admin reply in a customer's thread. Notified in-app via the header
    bell (so it shows up even if the customer never opens the chat widget
    again) and emailed best-effort, matching the support-ticket reply
    pattern."""
    customer = db.query(models.User).filter(models.User.id == user_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    message = models.ChatMessage(
        user_id=user_id,
        sender="admin",
        body=payload.body.strip(),
        is_read_by_admin=True,
        is_read_by_customer=False,
    )
    db.add(message)

    preview = message.body if len(message.body) <= 140 else f"{message.body[:137]}..."
    notify(
        db,
        user_id,
        "chat_reply",
        "New message from Mahabaleshwar Hills Hub",
        body=preview,
        link="/help?chat=open",
    )

    db.commit()
    db.refresh(message)

    send_email(
        customer.email,
        "New message from Mahabaleshwar Hills Hub",
        (
            f"Hi {customer.first_name or customer.username},\n\n"
            f"{message.body}\n\n"
            "Reply at mahabaleshwar-hills-hub-pi.vercel.app/help\n\n"
            "- Mahabaleshwar Hills Hub"
        ),
    )

    return message
