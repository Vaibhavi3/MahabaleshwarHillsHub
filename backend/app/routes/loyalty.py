from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
from app.utils.loyalty import POINTS_PER_100_RUPEES, POINT_VALUE_INR, get_tier_progress

router = APIRouter()


@router.get("/loyalty/balance", response_model=schemas.LoyaltyBalanceResponse)
def get_loyalty_balance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Current "Hills Rewards" points balance, tier, and the rates needed to
    explain it on the Rewards page and at checkout."""
    progress = get_tier_progress(current_user.lifetime_spend or 0)
    earn_rate = round(POINTS_PER_100_RUPEES * progress["tier_earn_multiplier"], 1)
    earn_rate_description = f"Earn {earn_rate:g} points for every ₹100 you spend on a delivered order"
    if progress["tier_name"] != "Bronze":
        earn_rate_description += f" ({progress['tier_name']} tier bonus)"

    return schemas.LoyaltyBalanceResponse(
        points_balance=current_user.loyalty_points,
        points_value_inr=round(current_user.loyalty_points * POINT_VALUE_INR, 2),
        earn_rate_description=earn_rate_description,
        redeem_rate_description=f"1 point = ₹{POINT_VALUE_INR} off at checkout",
        lifetime_spend=round(current_user.lifetime_spend or 0, 2),
        **progress,
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
