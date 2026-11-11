from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
import stripe
import razorpay
import os
import uuid
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = (
    razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
    else None
)


def _get_or_create_stripe_customer(db: Session, user: models.User) -> str:
    """Return the user's Stripe Customer id, creating one on first use."""
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
        metadata={"user_id": user.id},
    )
    user.stripe_customer_id = customer.id
    db.commit()
    return customer.id


def _mark_order_paid(db: Session, order: models.Order, payment_method: str, transaction_id: str, response_data: str):
    """Shared completion logic for both Stripe and Razorpay"""
    order.payment_status = "completed"
    order.status = "confirmed"

    existing = db.query(models.Payment).filter(models.Payment.transaction_id == transaction_id).first()
    if existing:
        return

    payment = models.Payment(
        order_id=order.id,
        amount=order.total_amount,
        payment_method=payment_method,
        transaction_id=transaction_id,
        status="completed",
        response_data=response_data
    )
    db.add(payment)
    db.commit()


@router.post("/payments/create-payment-intent")
def create_payment_intent(
    order_id: int,
    save_card: bool = False,
    payment_method_id: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create Stripe payment intent.

    - Plain call (no save_card/payment_method_id): unchanged, anonymous intent.
    - save_card=True: attaches a Stripe Customer and asks Stripe to keep the
      card on file for next time (setup_future_usage="off_session").
    - payment_method_id set: pay with a previously-saved card instead of
      collecting card details again.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    intent_kwargs = {
        "amount": int(order.total_amount * 100),
        "currency": "inr",
        "metadata": {"order_id": order_id},
    }

    if payment_method_id:
        if not current_user.stripe_customer_id:
            raise HTTPException(status_code=400, detail="No saved cards found")
        intent_kwargs["customer"] = current_user.stripe_customer_id
        intent_kwargs["payment_method"] = payment_method_id
    elif save_card:
        intent_kwargs["customer"] = _get_or_create_stripe_customer(db, current_user)
        intent_kwargs["setup_future_usage"] = "off_session"

    try:
        intent = stripe.PaymentIntent.create(**intent_kwargs)

        return {
            "client_secret": intent.client_secret,
            "publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY")
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payments/saved-cards")
def list_saved_cards(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List the current user's saved Stripe cards, for faster checkout next time."""
    if not current_user.stripe_customer_id:
        return []

    try:
        methods = stripe.PaymentMethod.list(customer=current_user.stripe_customer_id, type="card")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return [
        {
            "id": pm.id,
            "brand": pm.card.brand,
            "last4": pm.card.last4,
            "exp_month": pm.card.exp_month,
            "exp_year": pm.card.exp_year,
        }
        for pm in methods.data
    ]


@router.delete("/payments/saved-cards/{payment_method_id}")
def delete_saved_card(
    payment_method_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove a saved card. Only the card's own owner can remove it."""
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No saved cards found")

    try:
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        if pm.customer != current_user.stripe_customer_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        stripe.PaymentMethod.detach(payment_method_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"detail": "Card removed"}


@router.post("/payments/confirm")
def confirm_payment(
    order_id: int,
    payment_intent_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Confirm payment and update order"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        if intent.status == "succeeded":
            _mark_order_paid(db, order, "stripe", payment_intent_id, str(intent))
        else:
            order.payment_status = "failed"
            db.commit()
            raise HTTPException(status_code=400, detail="Payment not successful")

        db.refresh(order)
        return order
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payments/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe webhook - authoritative, signature-verified payment confirmation"""
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        order_id = intent.get("metadata", {}).get("order_id")
        if order_id:
            order = db.query(models.Order).filter(models.Order.id == int(order_id)).first()
            if order:
                _mark_order_paid(db, order, "stripe", intent["id"], str(intent))
            else:
                logger.warning(f"Stripe webhook: order {order_id} not found")

    return {"received": True}


@router.post("/payments/razorpay/create-order")
def create_razorpay_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a Razorpay order for checkout"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        razorpay_order = razorpay_client.order.create({
            "amount": int(order.total_amount * 100),
            "currency": "INR",
            "receipt": order.order_number,
            "notes": {"order_id": order_id}
        })

        return {
            "razorpay_order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            "key_id": RAZORPAY_KEY_ID
        }
    except razorpay.errors.BadRequestError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payments/razorpay/verify")
def verify_razorpay_payment(
    order_id: int,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Verify a Razorpay payment signature and mark the order paid"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature
        })
    except razorpay.errors.SignatureVerificationError:
        order.payment_status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    _mark_order_paid(db, order, "razorpay", razorpay_payment_id, razorpay_payment_id)
    db.refresh(order)
    return order


@router.get("/payments/{order_id}")
def get_payment_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get payment status for order"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payment = db.query(models.Payment).filter(models.Payment.order_id == order_id).first()
    if not payment:
        return {"status": "pending", "message": "No payment initiated yet"}
    
    return {
        "status": payment.status,
        "amount": payment.amount,
        "transaction_id": payment.transaction_id,
        "refunded_amount": payment.refunded_amount,
        "refund_status": payment.refund_status,
        "created_at": payment.created_at
    }