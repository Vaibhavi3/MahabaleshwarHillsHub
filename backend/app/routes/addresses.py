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


def _clear_other_defaults(db: Session, user_id: int, except_id: int = None):
    query = db.query(models.Address).filter(
        models.Address.user_id == user_id, models.Address.is_default.is_(True)
    )
    if except_id is not None:
        query = query.filter(models.Address.id != except_id)
    query.update({"is_default": False})


@router.get("/addresses", response_model=list[schemas.AddressResponse])
def get_addresses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The current customer's saved addresses, default first."""
    return (
        db.query(models.Address)
        .filter(models.Address.user_id == current_user.id)
        .order_by(models.Address.is_default.desc(), models.Address.id.desc())
        .all()
    )


@router.post("/addresses", response_model=schemas.AddressResponse, status_code=201)
def create_address(
    address: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save a new address. The very first address a customer saves always
    becomes their default, whatever is_default was sent as."""
    is_first = (
        db.query(models.Address).filter(models.Address.user_id == current_user.id).first()
        is None
    )
    make_default = address.is_default or is_first

    if make_default:
        _clear_other_defaults(db, current_user.id)

    new_address = models.Address(
        user_id=current_user.id,
        **address.model_dump(exclude={"is_default"}),
        is_default=make_default,
    )
    db.add(new_address)
    db.commit()
    db.refresh(new_address)
    return new_address


@router.put("/addresses/{address_id}", response_model=schemas.AddressResponse)
def update_address(
    address_id: int,
    address_update: schemas.AddressUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    address = _get_owned_address(db, address_id, current_user.id)

    update_data = address_update.model_dump(exclude_unset=True)
    make_default = update_data.pop("is_default", None)

    for field, value in update_data.items():
        setattr(address, field, value)

    if make_default:
        _clear_other_defaults(db, current_user.id, except_id=address.id)
        address.is_default = True

    db.commit()
    db.refresh(address)
    return address


@router.post("/addresses/{address_id}/default", response_model=schemas.AddressResponse)
def set_default_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    address = _get_owned_address(db, address_id, current_user.id)
    _clear_other_defaults(db, current_user.id, except_id=address.id)
    address.is_default = True
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
            .order_by(models.Address.id.desc())
            .first()
        )
        if next_address:
            next_address.is_default = True
            db.commit()
