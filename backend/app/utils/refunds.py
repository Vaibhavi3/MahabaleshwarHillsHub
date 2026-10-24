"""Issues a real refund through whichever gateway (Stripe or Razorpay) an
order was actually paid through, for self-service cancellations and
completed returns - matching Myntra/Nykaa/Ajio's "refund to original
payment method" flow.

This never fabricates a refund: if there's no captured Payment row, or
the gateway call itself fails, the order's payment_status reflects that
honestly (left as-is, or flipped to "refund_failed" for admin follow-up)
instead of claiming money moved that didn't.
"""
import logging
import os
from datetime import datetime, timezone

import razorpay
import stripe

from app import models

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
_razorpay_client = (
    razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
    else None
)


def issue_refund(db, order: "models.Order", amount: float, reason: str) -> dict:
    """Refund up to `amount` against this order's completed gateway
    payment, capped to whatever hasn't already been refunded on it.
    Commits the Payment row and the order's payment_status itself.

    Returns {"amount_refunded": <this call's actual amount>,
    "status": "none" | "partial" | "full" | "failed"}.
    """
    amount = round(amount, 2)
    if amount <= 0:
        return {"amount_refunded": 0.0, "status": "none"}

    payment = (
        db.query(models.Payment)
        .filter(models.Payment.order_id == order.id, models.Payment.status == "completed")
        .order_by(models.Payment.id.desc())
        .first()
    )
    if not payment:
        return {"amount_refunded": 0.0, "status": "none"}

    remaining = round(payment.amount - payment.refunded_amount, 2)
    if remaining <= 0:
        return {"amount_refunded": 0.0, "status": payment.refund_status}

    refund_amount = min(amount, remaining)

    try:
        if payment.payment_method == "stripe":
            gw_refund = stripe.Refund.create(
                payment_intent=payment.transaction_id,
                amount=int(round(refund_amount * 100)),
                reason="requested_by_customer",
            )
            refund_id = gw_refund.id
        elif payment.payment_method == "razorpay":
            if not _razorpay_client:
                raise RuntimeError("Razorpay is not configured")
            gw_refund = _razorpay_client.payment.refund(
                payment.transaction_id, {"amount": int(round(refund_amount * 100))}
            )
            refund_id = gw_refund["id"]
        else:
            raise RuntimeError(f"Unknown payment method '{payment.payment_method}'")
    except Exception:
        logger.exception("Refund failed for order %s (%s)", order.order_number, reason)
        payment.refund_status = "failed"
        order.payment_status = "refund_failed"
        db.commit()
        return {"amount_refunded": 0.0, "status": "failed"}

    payment.refunded_amount = round(payment.refunded_amount + refund_amount, 2)
    payment.refund_transaction_id = refund_id
    payment.refunded_at = datetime.now(timezone.utc)
    payment.refund_status = "full" if payment.refunded_amount >= payment.amount - 0.01 else "partial"
    order.payment_status = "refunded" if payment.refund_status == "full" else "partially_refunded"
    db.commit()
    return {"amount_refunded": refund_amount, "status": payment.refund_status}
