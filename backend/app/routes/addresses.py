from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user

router = APIRouter()


def _get_owned_address(db: Session, address_id: int, user_id: int) -> models.Address:
    address = (
        db.query(models.Address)
        .filter(models.Address.id == address_id, models.Address.user_id == user_id)
        .first()
    )
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    return address


@router.get("/addresses", response_model=list[schemas.AddressResponse])
def list_addresses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The current user's saved address book - default address first, then
    most recently added, so checkout can preselect a sensible option."""
    return (
        db.query(models.Address)
        .filter(models.Address.user_id == current_user.id)
        .order_by(models.Address.is_default.desc(), models.Address.created_at.desc())
        .all()
    )


@router.post("/addresses", response_model=schemas.AddressResponse, status_code=201)
def create_address(
    address_in: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    is_first_address = (
        db.query(models.Address).filter(models.Address.user_id == current_user.id).count() == 0
    )
    make_default = address_in.is_default or is_first_address

    if make_default:
        db.query(models.Address).filter(
            models.Address.user_id == current_user.id, models.Address.is_default.is_(True)
        ).update({"is_default": False})

    address = models.Address(
        user_id=current_user.id,
        **address_in.model_dump(exclude={"is_default"}),
        is_default=make_default,
    )
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.put("/addresses/{address_id}", response_model=schemas.AddressResponse)
def update_address(
    address_id: int,
    address_in: schemas.AddressUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    address = _get_owned_address(db, address_id, current_user.id)
    update_data = address_in.model_dump(exclude_unset=True)

    if update_data.get("is_default"):
        db.query(models.Address).filter(
            models.Address.user_id == current_user.id,
            models.Address.id != address_id,
            models.Address.is_default.is_(True),
        ).update({"is_default": False})

    for field, value in update_data.items():
        setattr(address, field, value)

    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", status_code=204)
def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    address = _get_owned_address(db, address_id, current_user.id)
    was_default = address.is_default
    db.delete(address)
    db.commit()

    if was_default:
        next_address = (
            db.query(models.Address)
            .filter(models.Address.user_id == current_user.id)
            .order_by(models.Address.created_at.desc())
            .first()
        )
        if next_address:
            next_address.is_default = True
            db.commit()


@router.post("/addresses/{address_id}/default", response_model=schemas.AddressResponse)
def set_default_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    address = _get_owned_address(db, address_id, current_user.id)
    db.query(models.Address).filter(
        models.Address.user_id == current_user.id, models.Address.id != address_id
    ).update({"is_default": False})
    address.is_default = True
    db.commit()
    db.refresh(address)
    return address
