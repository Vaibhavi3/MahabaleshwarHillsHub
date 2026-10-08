import secrets
import string

from sqlalchemy.orm import Session

from app import models

CODE_ALPHABET = string.ascii_uppercase + string.digits


def generate_referral_code(db: Session, username: str) -> str:
    """A short, shareable "Invite & Earn" code for a new user - derived
    from their username so it's memorable, with a random suffix so it
    stays unique even if several users share a similar username."""
    base = "".join(ch for ch in username.upper() if ch.isalnum())[:8] or "HILLS"
    for _ in range(20):
        candidate = f"{base}{''.join(secrets.choice(CODE_ALPHABET) for _ in range(4))}"
        if not db.query(models.User).filter(models.User.referral_code == candidate).first():
            return candidate
    raise RuntimeError("Could not generate a unique referral code")
