from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user, get_current_admin_user
from app.routes.coupons import compute_discount
from app.utils.loyalty import earn_points_for_amount, max_redeemable_points, POINT_VALUE_INR, REFERRAL_REFERRER_BONUS_POINTS
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
        discount_amount = 0
        coupon_code = None
        coupon = None
        if order.coupon_code:
            coupon = db.query(models.Coupon).filter(models.Coupon.code.ilike(order.coupon_code.strip())).first()
            valid, message, discount_amount = compute_discount(coupon, subtotal_amount)
            if not valid:
                raise HTTPException(status_code=400, detail=message)
            coupon_code = coupon.code
            total_amount = round(subtotal_amount - discount_amount, 2)

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

        order_number = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        db_order = models.Order(
            user_id=current_user.id,
            order_number=order_number,
            total_amount=total_amount,
            subtotal_amount=subtotal_amount,
            coupon_code=coupon_code,
            discount_amount=discount_amount,
            points_redeemed=redeem_points,
            points_discount_amount=points_discount_amount,
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

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create order")

    db.refresh(db_order)
    return db_order


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

    order.status = "cancelled"
    order.cancellation_reason = reason
    db.add(models.OrderStatusHistory(order_id=order.id, status="cancelled"))

    db.commit()
    db.refresh(order)
    return order


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
            earned = earn_points_for_amount(order.total_amount)
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