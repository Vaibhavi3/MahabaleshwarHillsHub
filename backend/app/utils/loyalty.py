"""Rules for the "Hills Rewards" points program, kept in one place so the
earn/redeem math in the orders, users, and loyalty routes always agrees.

Modelled on what Nykaa Cash / Myntra Insider / Ajio Rewardz actually do:
earn a small percentage of what you spend as points, redeem points for a
straight rupee discount at checkout. The rates below are this store's own
(there's no real-world rate to copy exactly), chosen to be simple to state
on the Rewards page: "Earn 5 points per Rs 100 spent. 1 point = Re 1 off."
"""

from math import floor

POINTS_PER_100_RUPEES = 5  # earn rate: 5 points for every Rs 100 of a delivered order
POINT_VALUE_INR = 1  # redeem rate: 1 point = Re 1 off at checkout
SIGNUP_BONUS_POINTS = 50  # one-time welcome bonus on registration (Rs 50)
MIN_PAYABLE_INR = 1  # points can never take the payable total below this

# Hills Rewards tiers, modelled on Myntra Insider's spend-based tier ladder
# (Insider/Select/Elite/Icon unlock a richer earn rate the more a shopper's
# lifetime delivered-order spend grows). This store's own tier names and
# thresholds - only an earn-rate bonus is promised, since that's the one
# perk this app can actually deliver honestly (no fabricated "early access"
# or "exclusive drops" this store doesn't have the volume to run).
LOYALTY_TIERS = [
    {"name": "Bronze", "min_spend": 0, "earn_multiplier": 1.0},
    {"name": "Silver", "min_spend": 3000, "earn_multiplier": 1.2},
    {"name": "Gold", "min_spend": 8000, "earn_multiplier": 1.5},
]


def get_tier_for_spend(lifetime_spend: float) -> dict:
    """The highest tier a shopper's lifetime delivered-order spend qualifies for."""
    current = LOYALTY_TIERS[0]
    for tier in LOYALTY_TIERS:
        if lifetime_spend >= tier["min_spend"]:
            current = tier
    return current


def get_tier_progress(lifetime_spend: float) -> dict:
    """Current tier plus how close the shopper is to the next one, for the
    Rewards page progress bar."""
    lifetime_spend = max(0, lifetime_spend)
    current = get_tier_for_spend(lifetime_spend)
    current_index = LOYALTY_TIERS.index(current)
    next_tier = LOYALTY_TIERS[current_index + 1] if current_index + 1 < len(LOYALTY_TIERS) else None

    if next_tier is None:
        return {
            "tier_name": current["name"],
            "tier_earn_multiplier": current["earn_multiplier"],
            "next_tier_name": None,
            "amount_to_next_tier": None,
            "tier_progress_pct": 100.0,
        }

    span = next_tier["min_spend"] - current["min_spend"]
    progressed = lifetime_spend - current["min_spend"]
    progress_pct = round(min(100.0, max(0.0, (progressed / span) * 100)), 1) if span > 0 else 100.0

    return {
        "tier_name": current["name"],
        "tier_earn_multiplier": current["earn_multiplier"],
        "next_tier_name": next_tier["name"],
        "amount_to_next_tier": round(next_tier["min_spend"] - lifetime_spend, 2),
        "tier_progress_pct": progress_pct,
    }

# "Invite & Earn" referral bonuses, modelled on Ajio's Invite & Earn (a new
# shopper gets a signup bonus for using a friend's code, the friend earns a
# bonus once that shopper's first order is delivered) - paid in this
# store's own Hills Rewards points rather than AJIO SuperCash.
REFERRAL_REFEREE_BONUS_POINTS = 25  # extra points for a new shopper who signs up with a referral code
REFERRAL_REFERRER_BONUS_POINTS = 100  # points for the referrer once their friend's first order is delivered


def earn_points_for_amount(amount_inr: float, earn_multiplier: float = 1.0) -> int:
    """Points earned on a delivered order, based on what was actually paid
    and the shopper's current Hills Rewards tier bonus."""
    if amount_inr <= 0:
        return 0
    base_points = floor(amount_inr / 100) * POINTS_PER_100_RUPEES
    return floor(base_points * earn_multiplier)


def max_redeemable_points(points_balance: int, payable_amount_inr: float) -> int:
    """The most points a shopper can apply to an order of this size, capped
    so the order never becomes free (payment gateways need a non-trivial
    amount to charge, and a Re 0 order is not a real purchase)."""
    if points_balance <= 0 or payable_amount_inr <= MIN_PAYABLE_INR:
        return 0
    max_by_amount = floor((payable_amount_inr - MIN_PAYABLE_INR) / POINT_VALUE_INR)
    return max(0, min(points_balance, max_by_amount))
