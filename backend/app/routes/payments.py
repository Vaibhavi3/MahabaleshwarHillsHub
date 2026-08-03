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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create Stripe payment intent"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(order.total_amount * 100),
            currency="inr",
            metadata={"order_id": order_id}
        )
        
        return {
            "client_secret": intent.client_secret,
            "publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY")
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
        "created_at": payment.created_at
    }