from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/wallet/balance", response_model=schemas.WalletBalanceResponse)
def get_wallet_balance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Current "Hills Wallet" store-credit balance, spendable at checkout."""
    return schemas.WalletBalanceResponse(balance=round(current_user.wallet_balance or 0, 2))


@router.get("/wallet/transactions", response_model=list[schemas.WalletTransactionResponse])
def get_wallet_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The ledger behind the balance above - instant credits from a
    cancelled order or completed return, and amounts spent at checkout."""
    return (
        db.query(models.WalletTransaction)
        .filter(models.WalletTransaction.user_id == current_user.id)
        .order_by(models.WalletTransaction.created_at.desc())
        .limit(100)
        .all()
    )
