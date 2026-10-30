from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user, get_current_admin_user
from app.routes.coupons import compute_discount
from app.utils.multibuy import compute_multibuy_discount
from app.utils.invoice import generate_invoice_pdf
from app.utils.refunds import issue_refund
from app.utils.loyalty import (
    earn_points_for_amount,
    max_redeemable_points,
    get_tier_for_spend,
    POINT_VALUE_INR,
    REFERRAL_REFERRER_BONUS_POINTS,
)
from datetime import datetime, timezone
import uuid

router = APIRouter()

# Statuses from which a customer may still self-cancel. Once an order has
# shipped it's already in the courier's hands, so cancellation has to go
# through support instead (matches Myntra/Nykaa/Ajio's "cancel before
# shipped" rule).
CANCELLABLE_STATUSES = {"pending", "confirmed"}


@router.post("/orders", response_model=schemas.OrderResponse)
def create_order(
    order: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create new order from cart"""
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart_items = db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    try:
        products_by_id = {}
        total_amount = 0
        for item in cart_items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            if item.quantity > product.stock:
                raise HTTPException(status_code=400, detail=f"'{product.name}' only has {product.stock} in stock")
            products_by_id[item.product_id] = product
            total_amount += product.price * item.quantity

        subtotal_amount = total_amount

        # Automatic "Mix & Match Socks" multi-buy discount - no code needed,
        # applies as soon as the cart holds enough eligible items. Computed
        # here from the authoritative server-side cart, never trusted from
        # the client, then layered under the coupon discount below.
        multibuy = compute_multibuy_discount(
            (products_by_id[item.product_id].category, products_by_id[item.product_id].price, item.quantity)
            for item in cart_items
        )
        multibuy_discount_amount = multibuy.discount_amount
        total_amount = round(total_amount - multibuy_discount_amount, 2)

        discount_amount = 0
        coupon_code = None
        coupon = None
        if order.coupon_code:
            coupon = db.query(models.Coupon).filter(models.Coupon.code.ilike(order.coupon_code.strip())).first()
            valid, message, discount_amount = compute_discount(coupon, total_amount)
            if not valid:
                raise HTTPException(status_code=400, detail=message)
            coupon_code = coupon.code
            total_amount = round(total_amount - discount_amount, 2)

        redeem_points = order.redeem_points or 0
        points_discount_amount = 0.0
        if redeem_points > 0:
            max_redeemable = max_redeemable_points(current_user.loyalty_points, total_amount)
            if redeem_points > max_redeemable:
                raise HTTPException(
                    status_code=400,
                    detail=f"You can redeem at most {max_redeemable} Hills Rewards points (₹{max_redeemable * POINT_VALUE_INR}) on this order",
                )
            points_discount_amount = round(redeem_points * POINT_VALUE_INR, 2)
            total_amount = round(total_amount - points_discount_amount, 2)

        gift_card = None
        gift_card_amount = 0.0
        if order.gift_card_code:
            gift_card = (
                db.query(models.GiftCard)
                .filter(models.GiftCard.code == order.gift_card_code.strip().upper())
                .first()
            )
            if not gift_card or gift_card.status not in ("active", "redeemed") or gift_card.balance <= 0:
                raise HTTPException(status_code=400, detail="Invalid or empty gift card code")
            # Same invariant as Hills Rewards points: never let a discount
            # take the payable total below Re 1, since Stripe/Razorpay
            # can't charge a Rs 0 order - any leftover balance just stays
            # on the card for next time, matching Nykaa/Ajio's own rule.
            gift_card_amount = round(min(gift_card.balance, max(total_amount - 1, 0)), 2)
            if gift_card_amount <= 0:
                raise HTTPException(status_code=400, detail="This gift card can't be applied to this order")
            total_amount = round(total_amount - gift_card_amount, 2)

        # "Send as a Gift" - free gift note, matching Myntra's checkout
        # gifting option. Only trust the recipient name/message when the
        # gift toggle itself is on, so a stray message on a non-gift order
        # can never end up on a packing slip.
        is_gift = bool(order.is_gift)
        gift_recipient_name = None
        gift_message = None
        if is_gift:
            gift_message = (order.gift_message or "").strip()
            if not gift_message:
                raise HTTPException(status_code=400, detail="Please add a short gift message, or turn off 'Send as a Gift'")
            if len(gift_message) > 300:
                raise HTTPException(status_code=400, detail="Gift message must be 300 characters or less")
            gift_recipient_name = (order.gift_recipient_name or "").strip()[:100] or None

        order_number = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        db_order = models.Order(
            user_id=current_user.id,
            order_number=order_number,
            total_amount=total_amount,
            subtotal_amount=subtotal_amount,
            coupon_code=coupon_code,
            discount_amount=discount_amount,
            multibuy_discount_amount=multibuy_discount_amount,
            points_redeemed=redeem_points,
            points_discount_amount=points_discount_amount,
            gift_card_code=gift_card.code if gift_card else None,
            gift_card_amount=gift_card_amount,
            is_gift=is_gift,
            gift_recipient_name=gift_recipient_name,
            gift_message=gift_message,
            shipping_address=order.shipping_address,
            payment_method=order.payment_method,
            notes=order.notes,
            status="pending",
            payment_status="pending"
        )
        db.add(db_order)
        db.flush()
        db.add(models.OrderStatusHistory(order_id=db_order.id, status="pending"))

        for item in cart_items:
            product = products_by_id[item.product_id]
            order_item = models.OrderItem(
                order_id=db_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=product.price
            )
            db.add(order_item)
            product.stock -= item.quantity

        db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).delete()

        if coupon:
            coupon.used_count += 1

        if redeem_points > 0:
            current_user.loyalty_points -= redeem_points
            db.add(models.LoyaltyTransaction(
                user_id=current_user.id,
                order_id=db_order.id,
                points=-redeem_points,
                reason="order_redeemed",
            ))

        if gift_card:
            gift_card.balance = round(gift_card.balance - gift_card_amount, 2)
            if gift_card.balance <= 0:
                gift_card.status = "redeemed"

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create order")

    db.refresh(db_order)
    return db_order


@router.post("/orders/track", response_model=schemas.OrderTrackingResponse)
def track_order(
    payload: schemas.OrderTrackingRequest,
    db: Session = Depends(get_db),
):
    """Public order tracking, matching Myntra/Nykaa/Ajio's "Track Order" by
    order number + email - no login needed, so a tracking link in an order
    email still works from a different device or after a session expires.
    Requires both the order number and the email on the account to match,
    and returns the same generic error either way so this can't be used to
    enumerate order numbers or confirm an email is registered."""
    order_number = payload.order_number.strip().upper()
    order = db.query(models.Order).filter(models.Order.order_number == order_number).first()

    not_found = HTTPException(
        status_code=404,
        detail="No order found matching that order number and email. Please double-check and try again.",
    )
    if not order or not order.user or order.user.email.strip().lower() != payload.email.strip().lower():
        raise not_found

    return order


@router.post("/orders/{order_id}/cancel", response_model=schemas.OrderResponse)
def cancel_order(
    order_id: int,
    payload: schemas.OrderCancelRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Customer self-service cancellation, matching Myntra/Nykaa/Ajio's
    "Cancel Order" flow on My Orders: only allowed while the order hasn't
    shipped yet. Restocks every item so inventory stays accurate."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if order.status not in CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="This order has already shipped and can no longer be cancelled here. Please contact support.",
        )

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Please select a reason for cancelling")

    for item in order.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if product:
            product.stock += item.quantity

    if order.points_redeemed > 0:
        current_user.loyalty_points += order.points_redeemed
        db.add(models.LoyaltyTransaction(
            user_id=current_user.id,
            order_id=order.id,
            points=order.points_redeemed,
            reason="order_redeemed_refund",
        ))

    if order.gift_card_amount > 0 and order.gift_card_code:
        gift_card = db.query(models.GiftCard).filter(models.GiftCard.code == order.gift_card_code).first()
        if gift_card:
            gift_card.balance = round(gift_card.balance + order.gift_card_amount, 2)
            gift_card.status = "active"

    order.status = "cancelled"
    order.cancellation_reason = reason
    db.add(models.OrderStatusHistory(order_id=order.id, status="cancelled"))

    db.commit()

    # Refund whatever was actually charged via Stripe/Razorpay - the
    # loyalty-point and gift-card amounts above are this store's own
    # ledgers and get restored directly, but real money only comes back
    # through the gateway it was paid through.
    if order.payment_status == "completed":
        issue_refund(db, order, order.total_amount, "order_cancelled")

    db.refresh(order)
    return order


@router.get("/orders/{order_id}/reorder", response_model=schemas.ReorderResponse)
def reorder(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """"Buy It Again" - resolve a past order's items against today's catalog
    so the frontend can drop them straight into the bag, matching
    Flipkart/Myntra/Nykaa's one-tap reorder on My Orders. Read-only: the
    bag itself lives client-side (see cartSlice), so this just tells the
    frontend what's still biddable. A discontinued product or one that's
    now out of stock is reported back as skipped rather than silently
    failing, and quantity is capped at whatever stock remains today - the
    same stock-aware rule manual add-to-cart already enforces."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    available = []
    skipped = []

    for item in order.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            skipped.append(schemas.ReorderSkippedItem(
                product_id=item.product_id,
                product_name=item.product_name or f"Product #{item.product_id}",
                reason="No longer available",
            ))
            continue

        if product.stock <= 0:
            skipped.append(schemas.ReorderSkippedItem(
                product_id=product.id,
                product_name=product.name,
                reason="Out of stock",
            ))
            continue

        quantity = min(item.quantity, product.stock)
        available.append(schemas.ReorderAvailableItem(
            product_id=product.id,
            name=product.name,
            price=product.price,
            image_url=product.image_url,
            stock=product.stock,
            quantity=quantity,
            category=product.category,
        ))
        if quantity < item.quantity:
            skipped.append(schemas.ReorderSkippedItem(
                product_id=product.id,
                product_name=product.name,
                reason=f"Only {quantity} of {item.quantity} added - limited stock left",
            ))

    return schemas.ReorderResponse(available=available, skipped=skipped)


@router.get("/orders", response_model=list[schemas.OrderResponse])
def get_user_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all orders of current user"""
    return db.query(models.Order).filter(models.Order.user_id == current_user.id).all()


@router.get("/orders/admin/all", response_model=list[schemas.OrderResponse])
def get_all_orders(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100
):
    """Get all orders across all users (Admin only)"""
    return (
        db.query(models.Order)
        .order_by(models.Order.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/orders/{order_id}", response_model=schemas.OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get specific order"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return order


@router.get("/orders/{order_id}/invoice")
def download_invoice(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Download a PDF receipt for an order, matching Myntra/Ajio/Nykaa's
    "Download Invoice" on order details. Built entirely from this order's
    own stored data - no tax/GST line, no invented delivery date."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    pdf_bytes = generate_invoice_pdf(order)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-{order.order_number}.pdf"'},
    )


@router.put("/orders/{order_id}", response_model=schemas.OrderResponse)
def update_order(
    order_id: int,
    order_update: schemas.OrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update order (Admin only)"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = order_update.dict(exclude_unset=True)
    new_status = update_data.get("status")
    status_changed = new_status is not None and new_status != order.status

    for key, value in update_data.items():
        setattr(order, key, value)

    if status_changed:
        db.add(models.OrderStatusHistory(order_id=order.id, status=new_status))

        # Credit Hills Rewards points the first time an order reaches
        # "delivered" - guarded by points_credited so re-saving the order,
        # or toggling status back and forth, never double-credits.
        if new_status == "delivered" and not order.points_credited:
            # This order's own value counts toward the tier that decides
            # its bonus, same as Myntra Insider crediting the order that
            # pushes a shopper into their next tier at the new rate.
            order.user.lifetime_spend = (order.user.lifetime_spend or 0) + order.total_amount
            tier = get_tier_for_spend(order.user.lifetime_spend)
            earned = earn_points_for_amount(order.total_amount, tier["earn_multiplier"])
            order.points_earned = earned
            order.points_credited = True
            if earned > 0:
                order.user.loyalty_points += earned
                db.add(models.LoyaltyTransaction(
                    user_id=order.user_id,
                    order_id=order.id,
                    points=earned,
                    reason="order_earned",
                ))

            # "Invite & Earn": the referrer's bonus is tied to the referred
            # friend's FIRST delivered order (like Ajio's "referrer earns
            # after the new user's qualifying order" rule), not every
            # order, so a repeat customer doesn't keep paying out the
            # same referrer.
            referral = (
                db.query(models.Referral)
                .filter(models.Referral.referred_user_id == order.user_id, models.Referral.status == "pending")
                .first()
            )
            if referral:
                earlier_delivered = (
                    db.query(models.Order)
                    .filter(
                        models.Order.user_id == order.user_id,
                        models.Order.status == "delivered",
                        models.Order.id != order.id,
                    )
                    .first()
                )
                if not earlier_delivered:
                    referral.status = "completed"
                    referral.completed_at = datetime.now(timezone.utc)
                    referral.reward_points = REFERRAL_REFERRER_BONUS_POINTS
                    if referral.referrer:
                        referral.referrer.loyalty_points += REFERRAL_REFERRER_BONUS_POINTS
                        db.add(models.LoyaltyTransaction(
                            user_id=referral.referrer_id,
                            points=REFERRAL_REFERRER_BONUS_POINTS,
                            reason="referral_bonus",
                        ))

    db.commit()
    db.refresh(order)
    return order