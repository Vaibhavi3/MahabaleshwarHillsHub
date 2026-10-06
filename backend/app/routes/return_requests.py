from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user, get_current_admin_user

router = APIRouter()

# Matches the "7-day hassle-free returns" promise already shown on the
# homepage trust strip and product page badges (see frontend Home.js /
# ProductDetail.js) - not a new policy, just the self-service flow for it.
RETURN_WINDOW_DAYS = 7

ACTIVE_STATUSES = {"requested", "approved", "picked_up"}


def _delivered_at(order: models.Order):
    for entry in order.status_history:
        if entry.status == "delivered":
            return entry.created_at
    return None


def _aware(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


@router.post("/orders/{order_id}/items/{item_id}/return-request", response_model=schemas.ReturnRequestResponse)
def create_return_request(
    order_id: int,
    item_id: int,
    payload: schemas.ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order or order.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")

    item = db.query(models.OrderItem).filter(
        models.OrderItem.id == item_id, models.OrderItem.order_id == order.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")

    if order.status != "delivered":
        raise HTTPException(status_code=400, detail="Returns and exchanges can only be requested after delivery")

    delivered_at = _aware(_delivered_at(order))
    if delivered_at is None:
        raise HTTPException(
            status_code=400,
            detail="We can't verify this order's delivery date for a self-service request. Please contact support.",
        )

    if datetime.now(timezone.utc) - delivered_at > timedelta(days=RETURN_WINDOW_DAYS):
        raise HTTPException(
            status_code=400,
            detail=f"The {RETURN_WINDOW_DAYS}-day return window for this order has passed. Please contact support.",
        )

    existing = (
        db.query(models.ReturnRequest)
        .filter(models.ReturnRequest.order_item_id == item.id, models.ReturnRequest.status.in_(ACTIVE_STATUSES))
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="A request for this item is already in progress")

    exchange_product_id = None
    if payload.request_type == "exchange":
        if not payload.exchange_product_id:
            raise HTTPException(status_code=400, detail="Please choose a variant to exchange for")
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        variant = db.query(models.Product).filter(
            models.Product.id == payload.exchange_product_id,
            models.Product.name == (product.name if product else None),
        ).first()
        if not variant:
            raise HTTPException(status_code=400, detail="That variant isn't available for exchange")
        if variant.stock <= 0:
            raise HTTPException(status_code=400, detail="That variant is currently out of stock")
        exchange_product_id = variant.id

    request = models.ReturnRequest(
        order_item_id=item.id,
        user_id=current_user.id,
        request_type=payload.request_type,
        reason=payload.reason.strip(),
        comment=(payload.comment or "").strip() or None,
        exchange_product_id=exchange_product_id,
        status="requested",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/return-requests", response_model=list[schemas.ReturnRequestResponse])
def get_my_return_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.ReturnRequest)
        .filter(models.ReturnRequest.user_id == current_user.id)
        .order_by(models.ReturnRequest.created_at.desc())
        .all()
    )


@router.get("/return-requests/admin/all", response_model=list[schemas.ReturnRequestResponse])
def get_all_return_requests(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    return db.query(models.ReturnRequest).order_by(models.ReturnRequest.created_at.desc()).all()


@router.put("/return-requests/{request_id}", response_model=schemas.ReturnRequestResponse)
def update_return_request_status(
    request_id: int,
    payload: schemas.ReturnRequestStatusUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Admin moves a request through requested -> approved -> picked_up ->
    completed (or rejected at any point before completed). Stock is only
    ever adjusted once, on the transition into "completed", so re-saving
    the same status twice can't double-restock or double-deduct."""
    request = db.query(models.ReturnRequest).filter(models.ReturnRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Return request not found")

    if request.status == "completed":
        raise HTTPException(status_code=400, detail="This request is already completed")

    if payload.status == "completed" and request.status != "completed":
        item = request.order_item
        if request.request_type == "return":
            if item and item.product:
                item.product.stock += item.quantity
        else:
            if item and item.product:
                item.product.stock += item.quantity
            if request.exchange_product:
                if request.exchange_product.stock < item.quantity:
                    raise HTTPException(status_code=400, detail="Exchange variant no longer has enough stock")
                request.exchange_product.stock -= item.quantity

    request.status = payload.status
    db.commit()
    db.refresh(request)
    return request
