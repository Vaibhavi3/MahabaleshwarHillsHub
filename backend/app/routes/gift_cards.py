import logging
import secrets
import string
from datetime import datetime, timezone

import razorpay
import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
from app.utils.email import send_email
from app.routes.payments import RAZORPAY_KEY_ID, razorpay_client

logger = logging.getLogger(__name__)

router = APIRouter()

MIN_AMOUNT = 200
MAX_AMOUNT = 5000
CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code(db: Session) -> str:
    for _ in range(20):
        candidate = "HILLS-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        if not db.query(models.GiftCard).filter(models.GiftCard.code == candidate).first():
            return candidate
    raise RuntimeError("Could not generate a unique gift card code")


def _activate(db: Session, gift_card: models.GiftCard):
    """Shared completion logic once a gift card's purchase payment succeeds -
    this is the only place a spendable code is minted, so an unpaid card
    never becomes redeemable."""
    if gift_card.status == "active":
        return
    gift_card.code = _generate_code(db)
    gift_card.balance = gift_card.initial_value
    gift_card.status = "active"
    gift_card.activated_at = datetime.now(timezone.utc)
    db.commit()

    send_email(
        gift_card.recipient_email,
        "You've received a Mahabaleshwar Hills Hub Gift Card!",
        (
            f"Hi {gift_card.recipient_name},\n\n"
            f"{gift_card.sender_name or 'Someone'} sent you a ₹{gift_card.initial_value:.0f} "
            f"gift card for Mahabaleshwar Hills Hub.\n\n"
            + (f"Message: {gift_card.message}\n\n" if gift_card.message else "")
            + f"Your gift card code: {gift_card.code}\n\n"
            "Enter this code at checkout on mahabaleshwar-hills-hub-pi.vercel.app to use it - "
            "it covers part or all of your order, and any leftover balance stays on the card "
            "for next time."
        ),
    )


@router.post("/gift-cards", response_model=schemas.GiftCardResponse)
def purchase_gift_card(
    payload: schemas.GiftCardCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Start a gift card purchase. No code is issued yet - the card stays
    in pending_payment until the Stripe/Razorpay payment for it succeeds,
    mirroring how a regular order isn't confirmed until payment clears."""
    if payload.amount < MIN_AMOUNT or payload.amount > MAX_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Gift card amount must be between ₹{MIN_AMOUNT} and ₹{MAX_AMOUNT}")

    gift_card = models.GiftCard(
        initial_value=payload.amount,
        balance=0,
        status="pending_payment",
        purchaser_user_id=current_user.id,
        recipient_name=payload.recipient_name.strip(),
        recipient_email=payload.recipient_email,
        sender_name=(payload.sender_name or current_user.username).strip(),
        message=(payload.message or "").strip() or None,
    )
    db.add(gift_card)
    db.commit()
    db.refresh(gift_card)
    return gift_card


def _get_own_pending_card(db: Session, gift_card_id: int, current_user: models.User) -> models.GiftCard:
    gift_card = db.query(models.GiftCard).filter(models.GiftCard.id == gift_card_id).first()
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    if gift_card.purchaser_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if gift_card.status != "pending_payment":
        raise HTTPException(status_code=400, detail="This gift card has already been paid for")
    return gift_card


@router.post("/gift-cards/{gift_card_id}/stripe/create-intent")
def create_gift_card_payment_intent(
    gift_card_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create the Stripe payment intent for a pending gift card purchase."""
    gift_card = _get_own_pending_card(db, gift_card_id, current_user)
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(gift_card.initial_value * 100),
            currency="inr",
            metadata={"gift_card_id": gift_card_id},
        )
        return {"client_secret": intent.client_secret}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/gift-cards/{gift_card_id}/stripe/confirm", response_model=schemas.GiftCardResponse)
def confirm_gift_card_stripe_payment(
    gift_card_id: int,
    payment_intent_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    gift_card = _get_own_pending_card(db, gift_card_id, current_user)
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if intent.status != "succeeded":
            raise HTTPException(status_code=400, detail="Payment not successful")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _activate(db, gift_card)
    db.refresh(gift_card)
    return gift_card


@router.post("/gift-cards/{gift_card_id}/razorpay/create-order")
def create_gift_card_razorpay_order(
    gift_card_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")
    gift_card = _get_own_pending_card(db, gift_card_id, current_user)
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": int(gift_card.initial_value * 100),
            "currency": "INR",
            "receipt": f"GC-{gift_card.id}",
            "notes": {"gift_card_id": gift_card_id},
        })
        return {
            "razorpay_order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            "key_id": RAZORPAY_KEY_ID,
        }
    except razorpay.errors.BadRequestError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/gift-cards/{gift_card_id}/razorpay/verify", response_model=schemas.GiftCardResponse)
def verify_gift_card_razorpay_payment(
    gift_card_id: int,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")
    gift_card = _get_own_pending_card(db, gift_card_id, current_user)
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    _activate(db, gift_card)
    db.refresh(gift_card)
    return gift_card


@router.post("/gift-cards/validate", response_model=schemas.GiftCardValidateResponse)
def validate_gift_card(
    payload: schemas.GiftCardValidateRequest,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    """Preview a gift card's balance before applying it at checkout - does
    not spend anything, same role as /coupons/validate."""
    code = payload.code.strip().upper()
    gift_card = db.query(models.GiftCard).filter(models.GiftCard.code == code).first()
    if not gift_card or gift_card.status not in ("active", "redeemed"):
        return schemas.GiftCardValidateResponse(valid=False, message="Invalid gift card code")
    if gift_card.balance <= 0:
        return schemas.GiftCardValidateResponse(valid=False, message="This gift card has no balance left")
    return schemas.GiftCardValidateResponse(valid=True, message="Gift card applied", balance=gift_card.balance)


@router.get("/gift-cards/mine", response_model=list[schemas.GiftCardResponse])
def get_my_gift_cards(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Gift cards bought by the current user (sent to themselves or to a
    friend), so they can track codes and remaining balance - mirrors
    Myntra/Nykaa's "My Gift Cards" account section."""
    return (
        db.query(models.GiftCard)
        .filter(models.GiftCard.purchaser_user_id == current_user.id, models.GiftCard.status != "pending_payment")
        .order_by(models.GiftCard.created_at.desc())
        .all()
    )
