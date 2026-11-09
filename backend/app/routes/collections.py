import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_admin_user

router = APIRouter()


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "collection"


def _unique_slug(db: Session, title: str, exclude_id: int | None = None) -> str:
    base = _slugify(title)
    slug = base
    n = 2
    while True:
        query = db.query(models.Collection).filter(models.Collection.slug == slug)
        if exclude_id is not None:
            query = query.filter(models.Collection.id != exclude_id)
        if not query.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def _cover_image(collection: models.Collection) -> str | None:
    if collection.banner_image_url:
        return collection.banner_image_url
    for item in collection.items:
        if item.product and item.product.image_url:
            return item.product.image_url
    return None


def _to_response(collection: models.Collection) -> schemas.CollectionResponse:
    return schemas.CollectionResponse(
        id=collection.id,
        title=collection.title,
        slug=collection.slug,
        description=collection.description,
        banner_image_url=collection.banner_image_url,
        is_active=collection.is_active,
        display_order=collection.display_order,
        product_count=len(collection.items),
        cover_image=_cover_image(collection),
        created_at=collection.created_at,
    )


@router.get("/collections", response_model=list[schemas.CollectionResponse])
def list_collections(db: Session = Depends(get_db)):
    """Active, non-empty curated collections for homepage merchandising,
    ordered the way the store owner arranged them."""
    collections = (
        db.query(models.Collection)
        .options(joinedload(models.Collection.items).joinedload(models.CollectionProduct.product))
        .filter(models.Collection.is_active.is_(True))
        .order_by(models.Collection.display_order, models.Collection.id)
        .all()
    )
    return [_to_response(c) for c in collections if c.items]


@router.get("/collections/{slug}", response_model=schemas.CollectionDetailResponse)
def get_collection(slug: str, db: Session = Depends(get_db)):
    collection = (
        db.query(models.Collection)
        .options(joinedload(models.Collection.items).joinedload(models.CollectionProduct.product))
        .filter(models.Collection.slug == slug, models.Collection.is_active.is_(True))
        .first()
    )
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    products = [item.product for item in collection.items if item.product]
    base = _to_response(collection)
    return schemas.CollectionDetailResponse(**base.model_dump(), products=products)


@router.get("/admin/collections", response_model=list[schemas.CollectionResponse])
def admin_list_collections(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    collections = (
        db.query(models.Collection)
        .options(joinedload(models.Collection.items).joinedload(models.CollectionProduct.product))
        .order_by(models.Collection.display_order, models.Collection.id)
        .all()
    )
    return [_to_response(c) for c in collections]


@router.get("/admin/collections/{collection_id}", response_model=schemas.CollectionDetailResponse)
def admin_get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    collection = (
        db.query(models.Collection)
        .options(joinedload(models.Collection.items).joinedload(models.CollectionProduct.product))
        .filter(models.Collection.id == collection_id)
        .first()
    )
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    products = [item.product for item in collection.items if item.product]
    base = _to_response(collection)
    return schemas.CollectionDetailResponse(**base.model_dump(), products=products)


@router.post("/admin/collections", response_model=schemas.CollectionResponse)
def admin_create_collection(
    payload: schemas.CollectionCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    slug = _unique_slug(db, payload.slug or payload.title)
    collection = models.Collection(
        title=payload.title,
        slug=slug,
        description=payload.description,
        banner_image_url=payload.banner_image_url,
        is_active=payload.is_active,
        display_order=payload.display_order,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return _to_response(collection)


@router.put("/admin/collections/{collection_id}", response_model=schemas.CollectionResponse)
def admin_update_collection(
    collection_id: int,
    payload: schemas.CollectionUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    data = payload.model_dump(exclude_unset=True)
    if "title" in data and "slug" not in data:
        data["slug"] = _unique_slug(db, data["title"], exclude_id=collection_id)
    elif "slug" in data and data["slug"]:
        data["slug"] = _unique_slug(db, data["slug"], exclude_id=collection_id)

    for key, value in data.items():
        setattr(collection, key, value)

    db.commit()
    db.refresh(collection)
    return _to_response(collection)


@router.delete("/admin/collections/{collection_id}")
def admin_delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(collection)
    db.commit()
    return {"detail": "Collection deleted"}


@router.post("/admin/collections/{collection_id}/products", response_model=schemas.CollectionResponse)
def admin_add_product(
    collection_id: int,
    payload: schemas.CollectionProductAdd,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    product = db.query(models.Product).filter(models.Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(models.CollectionProduct)
        .filter(
            models.CollectionProduct.collection_id == collection_id,
            models.CollectionProduct.product_id == payload.product_id,
        )
        .first()
    )
    if not existing:
        db.add(
            models.CollectionProduct(
                collection_id=collection_id,
                product_id=payload.product_id,
                display_order=payload.display_order,
            )
        )
        db.commit()

    db.refresh(collection)
    return _to_response(collection)


@router.delete("/admin/collections/{collection_id}/products/{product_id}", response_model=schemas.CollectionResponse)
def admin_remove_product(
    collection_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    db.query(models.CollectionProduct).filter(
        models.CollectionProduct.collection_id == collection_id,
        models.CollectionProduct.product_id == product_id,
    ).delete()
    db.commit()
    db.refresh(collection)
    return _to_response(collection)
