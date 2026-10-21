import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app import models, schemas
from app.database import get_db
from app.utils.auth import get_current_user, get_current_admin_user
from app.utils.email import send_email

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
