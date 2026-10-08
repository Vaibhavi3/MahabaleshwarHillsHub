from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user
from app.utils.loyalty import REFERRAL_REFEREE_BONUS_POINTS, REFERRAL_REFERRER_BONUS_POINTS

router = APIRouter()


def _mask_name(user) -> str:
    """Show enough of a referred friend's name to feel personal without
    exposing their full identity to the referrer, e.g. "Priya" -> "P****"."""
    name = (user.first_name or user.username or "Shopper").strip() if user else "Shopper"
    if len(name) <= 1:
        return f"{name}*"
    return name[0].upper() + "*" * (len(name) - 1)


@router.get("/referrals/me", response_model=schemas.ReferralSummaryResponse)
def get_my_referrals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The shopper's own "Invite & Earn" code, the two bonus amounts, and
    the status of everyone they've referred so far - pending (signed up,
    hasn't completed a first order yet) or completed (referrer bonus paid)."""
    referrals = (
        db.query(models.Referral)
        .filter(models.Referral.referrer_id == current_user.id)
        .order_by(models.Referral.created_at.desc())
        .all()
    )
    completed = [r for r in referrals if r.status == "completed"]

    return schemas.ReferralSummaryResponse(
        referral_code=current_user.referral_code,
        referee_bonus_points=REFERRAL_REFEREE_BONUS_POINTS,
        referrer_bonus_points=REFERRAL_REFERRER_BONUS_POINTS,
        total_referrals=len(referrals),
        completed_referrals=len(completed),
        pending_referrals=len(referrals) - len(completed),
        points_earned_from_referrals=sum(r.reward_points for r in completed),
        referrals=[
            schemas.ReferralItemResponse(
                id=r.id,
                referred_name=_mask_name(r.referred_user),
                status=r.status,
                reward_points=r.reward_points,
                created_at=r.created_at,
                completed_at=r.completed_at,
            )
            for r in referrals
        ],
    )
