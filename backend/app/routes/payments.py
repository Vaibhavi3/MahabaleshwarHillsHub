from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
import stripe
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


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
            order.payment_status = "completed"
            order.status = "confirmed"
            
            payment = models.Payment(
                order_id=order_id,
                amount=order.total_amount,
                payment_method="stripe",
                transaction_id=payment_intent_id,
                status="completed",
                response_data=str(intent)
            )
            db.add(payment)
        else:
            order.payment_status = "failed"
            raise HTTPException(status_code=400, detail="Payment not successful")
        
        db.commit()
        db.refresh(order)
        return order
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


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