from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user

router = APIRouter()


def _get_or_create_cart(db: Session, user_id: int) -> models.Cart:
    cart = db.query(models.Cart).filter(models.Cart.user_id == user_id).first()
    if not cart:
        cart = models.Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _get_cart(db: Session, user_id: int) -> models.Cart:
    """The account's cart, with each item's product eager-loaded so the
    response can embed full product details (price, stock, image) - the
    same shape the account-backed wishlist already returns."""
    cart = _get_or_create_cart(db, user_id)
    db.query(models.CartItem).options(joinedload(models.CartItem.product)).filter(
        models.CartItem.cart_id == cart.id
    ).all()
    db.refresh(cart)
    return cart


@router.get("/cart", response_model=schemas.CartResponse)
def get_cart(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """The signed-in user's cart, tied to their account - like Myntra/
    Nykaa/Ajio, so the bag follows them across devices and browsers
    instead of living only in this browser's local storage."""
    return _get_cart(db, current_user.id)


@router.post("/cart/sync", response_model=schemas.CartResponse)
def sync_cart(
    payload: schemas.CartSyncRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Merge a guest-era, browser-local cart into the account on login.
    Called once right after sign-in with whatever product ids/quantities
    were sitting in this browser's local storage; for a product not yet
    on the account cart it's added, for one already there the larger of
    the two quantities wins (never summed, so logging in on a second
    device can't silently double a quantity), both capped at real stock.
    Always returns the full, merged, account-backed cart so the frontend
    can replace its local copy with the source of truth."""
    cart = _get_or_create_cart(db, current_user.id)

    if payload.items:
        requested = {item.product_id: item.quantity for item in payload.items}
        products = {
            p.id: p
            for p in db.query(models.Product).filter(models.Product.id.in_(requested.keys()))
        }
        existing_items = {
            ci.product_id: ci
            for ci in db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id)
        }

        for product_id, quantity in requested.items():
            product = products.get(product_id)
            if not product or product.stock <= 0:
                continue
            existing = existing_items.get(product_id)
            if existing:
                existing.quantity = min(max(existing.quantity, quantity), product.stock)
            else:
                db.add(
                    models.CartItem(
                        cart_id=cart.id,
                        product_id=product_id,
                        quantity=min(quantity, product.stock),
                    )
                )
        db.commit()

    return _get_cart(db, current_user.id)


@router.post("/cart/add", response_model=schemas.CartResponse)
def add_to_cart(
    item: schemas.CartItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add item to cart"""
    cart = _get_or_create_cart(db, current_user.id)

    product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    cart_item = db.query(models.CartItem).filter(
        models.CartItem.cart_id == cart.id,
        models.CartItem.product_id == item.product_id
    ).first()

    requested_quantity = (cart_item.quantity if cart_item else 0) + item.quantity
    if requested_quantity > product.stock:
        raise HTTPException(status_code=400, detail=f"Only {product.stock} in stock")

    if cart_item:
        cart_item.quantity += item.quantity
    else:
        cart_item = models.CartItem(
            cart_id=cart.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(cart_item)

    db.commit()
    return _get_cart(db, current_user.id)


@router.put("/cart/product/{product_id}", response_model=schemas.CartResponse)
def update_cart_item_by_product(
    product_id: int,
    item_update: schemas.CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Set a product's quantity in the account cart, creating the line if
    it doesn't exist yet - keyed by product id (not the cart item's own
    id) since that's all the browser-local cart ever knows about a line."""
    cart = _get_or_create_cart(db, current_user.id)

    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if item_update.quantity > product.stock:
        raise HTTPException(status_code=400, detail=f"Only {product.stock} in stock")

    cart_item = db.query(models.CartItem).filter(
        models.CartItem.cart_id == cart.id,
        models.CartItem.product_id == product_id
    ).first()

    if cart_item:
        cart_item.quantity = item_update.quantity
    else:
        db.add(models.CartItem(cart_id=cart.id, product_id=product_id, quantity=item_update.quantity))

    db.commit()
    return _get_cart(db, current_user.id)


@router.delete("/cart/product/{product_id}", response_model=schemas.CartResponse)
def remove_from_cart_by_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove a product from the account cart by product id."""
    cart = _get_or_create_cart(db, current_user.id)

    db.query(models.CartItem).filter(
        models.CartItem.cart_id == cart.id,
        models.CartItem.product_id == product_id
    ).delete()
    db.commit()
    return _get_cart(db, current_user.id)


@router.delete("/cart", response_model=dict)
def clear_cart(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Clear entire cart"""
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if cart:
        db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).delete()
        db.commit()

    return {"detail": "Cart cleared successfully"}
