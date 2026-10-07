from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
from app.utils.loyalty import POINTS_PER_100_RUPEES, POINT_VALUE_INR

router = APIRouter()


@router.get("/loyalty/balance", response_model=schemas.LoyaltyBalanceResponse)
def get_loyalty_balance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Current "Hills Rewards" points balance, and the two rates needed to
    explain it on the Rewards page and at checkout."""
    return schemas.LoyaltyBalanceResponse(
        points_balance=current_user.loyalty_points,
        points_value_inr=round(current_user.loyalty_points * POINT_VALUE_INR, 2),
        earn_rate_description=f"Earn {POINTS_PER_100_RUPEES} points for every ₹100 you spend on a delivered order",
        redeem_rate_description=f"1 point = ₹{POINT_VALUE_INR} off at checkout",
    )


@router.get("/loyalty/transactions", response_model=list[schemas.LoyaltyTransactionResponse])
def get_loyalty_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The points ledger behind the balance above - signup bonus, points
    earned per delivered order, and points spent/refunded at checkout."""
    return (
        db.query(models.LoyaltyTransaction)
        .filter(models.LoyaltyTransaction.user_id == current_user.id)
        .order_by(models.LoyaltyTransaction.created_at.desc())
        .limit(100)
        .all()
    )
