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
    category: str = Query(None)
):
    """Get all products with optional filtering"""
    query = db.query(models.Product)
    
    if category:
        query = query.filter(models.Product.category == category)
    
    return query.offset(skip).limit(limit).all()


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