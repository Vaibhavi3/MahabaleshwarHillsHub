from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_admin_user
from sqlalchemy import or_, func

router = APIRouter()


@router.get("/products", response_model=list[schemas.ProductResponse])
def get_products(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=500),
    category: str = Query(None),
    subcategory: str = Query(None)
):
    """Get all products with optional filtering"""
    query = db.query(models.Product)

    if category:
        query = query.filter(models.Product.category == category)
    if subcategory:
        query = query.filter(models.Product.subcategory == subcategory)

    return query.offset(skip).limit(limit).all()


@router.get("/products/count")
def get_products_count(db: Session = Depends(get_db), category: str = Query(None), subcategory: str = Query(None)):
    """Get the total product count, optionally filtered by category/subcategory"""
    query = db.query(func.count(models.Product.id))
    if category:
        query = query.filter(models.Product.category == category)
    if subcategory:
        query = query.filter(models.Product.subcategory == subcategory)
    return {"total": query.scalar()}


@router.get("/products/search", response_model=list[schemas.ProductResponse])
def search_products(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """Search products by name or description"""
    search_term = f"%{q}%"
    return db.query(models.Product).filter(
        or_(
            models.Product.name.ilike(search_term),
            models.Product.description.ilike(search_term),
            models.Product.category.ilike(search_term)
        )
    ).all()


@router.get("/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get single product by ID"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/{product_id}/variants", response_model=list[schemas.ProductResponse])
def get_product_variants(product_id: int, db: Session = Depends(get_db)):
    """Other colour variants of the same product (same name, different id)"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return (
        db.query(models.Product)
        .filter(models.Product.name == product.name, models.Product.id != product_id)
        .all()
    )


@router.get("/products/{product_id}/similar", response_model=list[schemas.ProductResponse])
def get_similar_products(
    product_id: int,
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Other products in the same category, ranked by closest price"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return (
        db.query(models.Product)
        .filter(
            models.Product.category == product.category,
            models.Product.name != product.name,
        )
        .order_by(func.abs(models.Product.price - product.price))
        .limit(limit)
        .all()
    )


@router.get("/products/{product_id}/frequently-bought-together", response_model=list[schemas.ProductResponse])
def get_frequently_bought_together(
    product_id: int,
    limit: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """Item-item collaborative filtering: products most often bought in the
    same order as this one, ranked by co-purchase frequency. Falls back to
    same-category picks for products with no purchase history yet."""
    order_ids_subq = (
        db.query(models.OrderItem.order_id)
        .filter(models.OrderItem.product_id == product_id)
        .subquery()
    )

    co_purchased = (
        db.query(
            models.OrderItem.product_id,
            func.count(func.distinct(models.OrderItem.order_id)).label("co_count"),
        )
        .filter(
            models.OrderItem.order_id.in_(db.query(order_ids_subq.c.order_id)),
            models.OrderItem.product_id != product_id,
        )
        .group_by(models.OrderItem.product_id)
        .order_by(func.count(func.distinct(models.OrderItem.order_id)).desc())
        .limit(limit)
        .all()
    )

    product_ids = [row[0] for row in co_purchased]
    products = []
    if product_ids:
        rows_by_id = {p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(product_ids)).all()}
        products = [rows_by_id[pid] for pid in product_ids if pid in rows_by_id]

    if len(products) < limit:
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if product:
            exclude_ids = set(product_ids) | {product_id}
            fallback = (
                db.query(models.Product)
                .filter(models.Product.category == product.category, models.Product.id.notin_(exclude_ids))
                .order_by(models.Product.rating.desc())
                .limit(limit - len(products))
                .all()
            )
            products.extend(fallback)

    return products


@router.post("/products", response_model=schemas.ProductResponse)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user)
):
    """Create new product (Admin only)"""
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user)
):
    """Update product (Admin only)"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user)
):
    """Delete product (Admin only)"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()
    return {"detail": "Product deleted successfully"}


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Get all unique product categories"""
    categories = db.query(models.Product.category).distinct().all()
    return {"categories": [cat[0] for cat in categories if cat[0]]}