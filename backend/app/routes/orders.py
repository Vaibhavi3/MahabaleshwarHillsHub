from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
import uuid

router = APIRouter()


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
    
    total_amount = 0
    for item in cart_items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        total_amount += product.price * item.quantity
    
    order_number = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    db_order = models.Order(
        user_id=current_user.id,
        order_number=order_number,
        total_amount=total_amount,
        shipping_address=order.shipping_address,
        payment_method=order.payment_method,
        notes=order.notes,
        status="pending",
        payment_status="pending"
    )
    db.add(db_order)
    db.flush()
    
    for item in cart_items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        order_item = models.OrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=product.price
        )
        db.add(order_item)
    
    db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).delete()
    
    db.commit()
    db.refresh(db_order)
    return db_order


@router.get("/orders", response_model=list[schemas.OrderResponse])
def get_user_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all orders of current user"""
    return db.query(models.Order).filter(models.Order.user_id == current_user.id).all()


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
    for key, value in update_data.items():
        setattr(order, key, value)
    
    db.commit()
    db.refresh(order)
    return order