"""Hills Wallet: an instant store-credit ledger, matching Myntra Wallet /
Nykaa Cash's "refund to wallet instead of waiting for the bank" option.

Crediting it is always exact and instant - it only ever moves money this
store already holds (a cancelled or returned order's paid amount, or a
wallet amount a cancelled order had used) into a balance the customer can
spend on a future order. It never grants a bonus or promotional credit.
"""
from app import models


def credit_wallet(db, user: "models.User", amount: float, reason: str, order_id: int = None) -> float:
    """Add `amount` to the user's wallet balance and record the ledger
    entry. Returns the amount actually credited (0 if amount <= 0)."""
    amount = round(amount, 2)
    if amount <= 0:
        return 0.0
    user.wallet_balance = round((user.wallet_balance or 0) + amount, 2)
    db.add(models.WalletTransaction(user_id=user.id, order_id=order_id, amount=amount, reason=reason))
    return amount


def debit_wallet(db, user: "models.User", amount: float, reason: str, order_id: int = None) -> float:
    """Subtract `amount` from the user's wallet balance and record the
    ledger entry. Returns the amount actually debited (0 if amount <= 0)."""
    amount = round(amount, 2)
    if amount <= 0:
        return 0.0
    user.wallet_balance = round((user.wallet_balance or 0) - amount, 2)
    db.add(models.WalletTransaction(user_id=user.id, order_id=order_id, amount=-amount, reason=reason))
    return amount
