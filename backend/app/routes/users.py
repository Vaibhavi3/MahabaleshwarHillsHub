from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.utils.loyalty import SIGNUP_BONUS_POINTS, REFERRAL_REFEREE_BONUS_POINTS
from app.utils.referral import generate_referral_code
from app.schemas import LoginRequest
from app.utils.firebase_auth import FirebaseTokenError, verify_phone_id_token, phone_digits
import secrets

router = APIRouter()


def _find_user_by_phone(db: Session, phone: str):
    digits = phone_digits(phone)
    if len(digits) < 10:
        return None
    candidates = db.query(models.User).filter(models.User.phone.ilike(f"%{digits[-4:]}%")).all()
    return next((u for u in candidates if phone_digits(u.phone) == digits), None)


def _verified_phone(id_token: str) -> str:
    try:
        return verify_phone_id_token(id_token)
    except FirebaseTokenError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


def _token_response(db_user: models.User) -> dict:
    if not db_user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")
    return {
        "access_token": create_access_token(data={"sub": str(db_user.id)}),
        "token_type": "bearer",
        "user": db_user,
    }


@router.post("/auth/phone/verify", response_model=schemas.PhoneVerifyResponse)
def phone_verify(payload: schemas.PhoneTokenRequest, db: Session = Depends(get_db)):
    """Log in with a Firebase-verified mobile number. Returns new_user=True
    (and no token) when no account has this number yet."""
    phone = _verified_phone(payload.id_token)
    db_user = _find_user_by_phone(db, phone)
    if not db_user:
        return {"new_user": True, "phone": phone}
    return {"new_user": False, "phone": phone, **_token_response(db_user)}


@router.post("/auth/phone/register", response_model=schemas.TokenResponse)
def phone_register(payload: schemas.PhoneRegisterRequest, db: Session = Depends(get_db)):
    """Create an account for a Firebase-verified mobile number, then log in."""
    phone = _verified_phone(payload.id_token)
    existing = _find_user_by_phone(db, phone)
    if existing:
        return _token_response(existing)

    digits = phone_digits(phone)
    # Email is optional for mobile sign-ups; the placeholder keeps the unique,
    # non-null email column satisfied and simply never receives mail.
    email = (payload.email or "").strip().lower() or f"m{digits}@phone-login.mahabaleshwar-hills-hub-pi.vercel.app"
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered - log in with your password instead")

    username = f"m{digits}"
    while db.query(models.User).filter(models.User.username == username).first():
        username = f"m{digits}{secrets.randbelow(1000)}"

    new_user = schemas.UserCreate(
        username=username,
        email=email,
        password=secrets.token_urlsafe(24),
        first_name=payload.first_name.strip(),
        last_name=(payload.last_name or "").strip() or None,
        phone=phone,
        referral_code=payload.referral_code,
    )
    return _token_response(register(new_user, db))


@router.post("/auth/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register new user"""
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    referrer = None
    if user.referral_code and user.referral_code.strip():
        referrer = (
            db.query(models.User)
            .filter(models.User.referral_code == user.referral_code.strip().upper())
            .first()
        )
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid referral code")

    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone
    )

    cart = models.Cart(user=db_user)

    db.add(db_user)
    db.add(cart)
    db.flush()  # assigns db_user.id for the welcome-bonus ledger entry below

    db_user.referral_code = generate_referral_code(db, user.username)
    db_user.loyalty_points = SIGNUP_BONUS_POINTS
    db.add(models.LoyaltyTransaction(
        user_id=db_user.id,
        points=SIGNUP_BONUS_POINTS,
        reason="signup_bonus",
    ))

    if referrer:
        db_user.loyalty_points += REFERRAL_REFEREE_BONUS_POINTS
        db.add(models.LoyaltyTransaction(
            user_id=db_user.id,
            points=REFERRAL_REFEREE_BONUS_POINTS,
            reason="referral_welcome_bonus",
        ))
        db.add(models.Referral(referrer_id=referrer.id, referred_user_id=db_user.id, status="pending"))

    db.commit()
    db.refresh(db_user)

    return db_user


@router.post("/auth/login", response_model=schemas.TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    db_user = db.query(models.User).filter(
        (models.User.username == credentials.username) | 
        (models.User.email == credentials.username)
    ).first()
    
    if not db_user or not verify_password(credentials.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not db_user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")
    
    access_token = create_access_token(data={"sub": str(db_user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": db_user
    }


@router.get("/auth/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    """Get current authenticated user"""
    return current_user


@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update user profile"""
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.dict(exclude_unset=True)

    if "email" in update_data and update_data["email"] != db_user.email:
        existing = db.query(models.User).filter(models.User.email == update_data["email"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

    for key, value in update_data.items():
        setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/users/me/password")
def change_password(
    payload: schemas.PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Change the signed-in user's own password, matching Myntra/Nykaa/
    Ajio's "My Profile" change-password flow. Requires the current
    password so a hijacked session token alone can't lock the real owner
    out of their account."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated"}


@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get user by ID (self or admin only)"""
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user