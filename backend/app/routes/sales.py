from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_admin_user
from app.utils.sales import get_active_sales, _aware

router = APIRouter()


@router.get("/sales/active", response_model=list[schemas.SalePublicResponse])
def list_active_sales(db: Session = Depends(get_db)):
    """Public listing of currently-live sale campaigns, for the storefront's
    sale banner and product badges - only ever a real admin-scheduled
    campaign with a real end time, never a fabricated countdown."""
    return get_active_sales(db)


@router.get("/sales", response_model=list[schemas.SaleResponse])
def list_sales(db: Session = Depends(get_db), _admin: models.User = Depends(get_current_admin_user)):
    """List every sale, past/live/future (Admin only)."""
    return db.query(models.Sale).order_by(models.Sale.starts_at.desc()).all()


@router.post("/sales", response_model=schemas.SaleResponse)
def create_sale(
    sale: schemas.SaleCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Create a sale campaign (Admin only)."""
    if _aware(sale.ends_at) <= _aware(sale.starts_at):
        raise HTTPException(status_code=400, detail="End time must be after start time")

    db_sale = models.Sale(**sale.dict())
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale


@router.put("/sales/{sale_id}", response_model=schemas.SaleResponse)
def update_sale(
    sale_id: int,
    sale_update: schemas.SaleUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Update a sale campaign (Admin only) - e.g. end it early by setting
    is_active to false, or adjusting its window/discount."""
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    update_data = sale_update.dict(exclude_unset=True)
    new_starts_at = _aware(update_data.get("starts_at", db_sale.starts_at))
    new_ends_at = _aware(update_data.get("ends_at", db_sale.ends_at))
    if new_ends_at <= new_starts_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    for key, value in update_data.items():
        setattr(db_sale, key, value)

    db.commit()
    db.refresh(db_sale)
    return db_sale


@router.delete("/sales/{sale_id}")
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin_user),
):
    """Delete a sale campaign (Admin only)."""
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    db.delete(db_sale)
    db.commit()
    return {"detail": "Sale deleted"}
