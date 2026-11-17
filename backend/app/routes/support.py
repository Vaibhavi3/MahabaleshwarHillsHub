import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app import models, schemas
from app.database import get_db
from app.utils.auth import get_current_user, get_current_admin_user
from app.utils.email import send_email
from app.utils.notifications import notify

router = APIRouter()

STATUSES = {"open", "in_progress", "resolved"}

CATEGORY_LABELS = {
    "order": "Order related",
    "payment": "Payment related",
    "product": "Product related",
    "account": "Account related",
    "other": "Something else",
}


@router.post("/support/tickets", response_model=schemas.SupportTicketResponse, status_code=201)
def create_ticket(
    payload: schemas.SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Raise a Help Center ticket - the self-service "Need Help?" flow
    used by Myntra/Nykaa/Ajio, and the "contact support" channel the
    order-cancellation and return-request flows already point to."""
    order = None
    if payload.order_id is not None:
        order = (
            db.query(models.Order)
            .filter(models.Order.id == payload.order_id, models.Order.user_id == current_user.id)
            .first()
        )
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

    ticket = models.SupportTicket(
        user_id=current_user.id,
        order_id=order.id if order else None,
        category=payload.category,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        status="open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    admin_email = os.getenv("ADMIN_EMAIL")
    if admin_email:
        order_line = f"\nOrder: {order.order_number}" if order else ""
        send_email(
            admin_email,
            f"New support ticket: {ticket.subject}",
            (
                f"{CATEGORY_LABELS.get(ticket.category, ticket.category)} query from "
                f"{current_user.email}{order_line}\n\n{ticket.message}\n\n"
                "Reply from the admin dashboard's Support tab."
            ),
        )

    return ticket


@router.get("/support/tickets", response_model=list[schemas.SupportTicketResponse])
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The signed-in customer's own tickets, newest first."""
    return (
        db.query(models.SupportTicket)
        .filter(models.SupportTicket.user_id == current_user.id)
        .order_by(models.SupportTicket.created_at.desc())
        .all()
    )


@router.get("/support/tickets/admin/all", response_model=list[schemas.SupportTicketResponse])
def get_all_tickets(
    status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """All tickets, for the admin dashboard's Support tab. Open ones first
    so nothing waiting on a reply gets buried."""
    query = db.query(models.SupportTicket)
    if status:
        if status not in STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        query = query.filter(models.SupportTicket.status == status)
    status_order = {"open": 0, "in_progress": 1, "resolved": 2}
    tickets = query.order_by(models.SupportTicket.created_at.desc()).all()
    tickets.sort(key=lambda t: status_order.get(t.status, 3))
    return tickets


@router.put("/support/tickets/{ticket_id}", response_model=schemas.SupportTicketResponse)
def update_ticket(
    ticket_id: int,
    payload: schemas.SupportTicketAdminUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """Admin reply and/or status change. Emails the customer (best-effort)
    whenever a reply is added or the ticket is marked resolved."""
    ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    replied = bool(updates.get("admin_reply"))
    for key, value in updates.items():
        setattr(ticket, key, value)
    if updates.get("status") == "resolved" and ticket.resolved_at is None:
        ticket.resolved_at = func.now()

    if replied or updates.get("status"):
        notify(
            db,
            ticket.user_id,
            "support_ticket",
            f"Update on your query: {ticket.subject}",
            body=ticket.admin_reply if replied else None,
            link="/help",
        )

    db.commit()
    db.refresh(ticket)

    if (replied or updates.get("status")) and ticket.user_email:
        send_email(
            ticket.user_email,
            f"Update on your query: {ticket.subject}",
            (
                f"Hi {ticket.user_name or 'there'},\n\n"
                + (f"{ticket.admin_reply}\n\n" if ticket.admin_reply else "")
                + f"Status: {ticket.status.replace('_', ' ')}\n\n"
                "- Mahabaleshwar Hills Hub"
            ),
        )

    return ticket


def _authorize_ticket_access(db: Session, ticket_id: int, current_user: models.User) -> models.SupportTicket:
    ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return ticket


def _thread(ticket: models.SupportTicket) -> list[schemas.SupportTicketMessageResponse]:
    """The full conversation for a ticket: the original customer message
    and first admin_reply (both stored directly on the ticket row from
    before this thread existed) followed by every real follow-up message,
    oldest first - never a fabricated turn."""
    thread: list[schemas.SupportTicketMessageResponse] = [
        schemas.SupportTicketMessageResponse(
            id=0,
            ticket_id=ticket.id,
            sender_type="customer",
            message=ticket.message,
            created_at=ticket.created_at,
        )
    ]
    if ticket.admin_reply:
        thread.append(
            schemas.SupportTicketMessageResponse(
                id=-1,
                ticket_id=ticket.id,
                sender_type="admin",
                message=ticket.admin_reply,
                created_at=ticket.updated_at or ticket.created_at,
            )
        )
    thread.extend(schemas.SupportTicketMessageResponse.model_validate(m) for m in ticket.messages)
    return thread


@router.get("/support/tickets/unread-count", response_model=schemas.UnreadNotificationCountResponse)
def get_support_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Powers the floating chat widget's badge - unread replies on the
    signed-in customer's own tickets, via the same in-app notification
    already raised whenever a ticket gets a reply or status change."""
    count = (
        db.query(func.count(models.Notification.id))
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.type == "support_ticket",
            models.Notification.is_read.is_(False),
        )
        .scalar()
    )
    return schemas.UnreadNotificationCountResponse(unread_count=count or 0)


@router.get("/support/tickets/{ticket_id}/messages", response_model=list[schemas.SupportTicketMessageResponse])
def get_ticket_thread(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The full conversation for one ticket - the ticket owner or an
    admin only. Viewing it also clears the "new reply" badge for this
    customer, the same way opening the notification bell would."""
    ticket = _authorize_ticket_access(db, ticket_id, current_user)

    if not current_user.is_admin:
        db.query(models.Notification).filter(
            models.Notification.user_id == current_user.id,
            models.Notification.type == "support_ticket",
            models.Notification.is_read.is_(False),
        ).update({"is_read": True})
        db.commit()

    return _thread(ticket)


@router.post("/support/tickets/{ticket_id}/messages", response_model=list[schemas.SupportTicketMessageResponse])
def add_customer_message(
    ticket_id: int,
    payload: schemas.SupportTicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Continue the conversation on your own ticket - the "chat with us"
    follow-up Myntra/Nykaa/Ajio support lets you send instead of only
    ever getting the single reply this ticket started with. Reopens a
    resolved ticket, since the customer is clearly still waiting on
    something."""
    ticket = db.query(models.SupportTicket).filter(
        models.SupportTicket.id == ticket_id, models.SupportTicket.user_id == current_user.id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    db.add(models.SupportTicketMessage(ticket_id=ticket.id, sender_type="customer", message=payload.message.strip()))
    if ticket.status == "resolved":
        ticket.status = "open"
    db.commit()
    db.refresh(ticket)

    admin_email = os.getenv("ADMIN_EMAIL")
    if admin_email:
        send_email(
            admin_email,
            f"New message on ticket: {ticket.subject}",
            f"{current_user.email} replied on their ticket \"{ticket.subject}\":\n\n{payload.message.strip()}\n\nReply from the admin dashboard's Support tab.",
        )

    return _thread(ticket)


@router.post("/support/tickets/{ticket_id}/admin-messages", response_model=list[schemas.SupportTicketMessageResponse])
def add_admin_message(
    ticket_id: int,
    payload: schemas.SupportTicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """Admin sends another message in the thread, without forcing the
    ticket to "resolved" the way the single admin_reply field above
    always did - that forced close-out is exactly why no back-and-forth
    was possible before."""
    ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    message = payload.message.strip()
    db.add(models.SupportTicketMessage(ticket_id=ticket.id, sender_type="admin", message=message))
    if ticket.status == "open":
        ticket.status = "in_progress"
    notify(db, ticket.user_id, "support_ticket", f"New reply on your query: {ticket.subject}", body=message, link="/help")
    db.commit()
    db.refresh(ticket)

    if ticket.user_email:
        send_email(
            ticket.user_email,
            f"New reply on your query: {ticket.subject}",
            f"Hi {ticket.user_name or 'there'},\n\n{message}\n\n- Mahabaleshwar Hills Hub",
        )

    return _thread(ticket)
