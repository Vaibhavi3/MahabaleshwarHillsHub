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

# "Invite & Earn" referral bonuses, modelled on Ajio's Invite & Earn (a new
# shopper gets a signup bonus for using a friend's code, the friend earns a
# bonus once that shopper's first order is delivered) - paid in this
# store's own Hills Rewards points rather than AJIO SuperCash.
REFERRAL_REFEREE_BONUS_POINTS = 25  # extra points for a new shopper who signs up with a referral code
REFERRAL_REFERRER_BONUS_POINTS = 100  # points for the referrer once their friend's first order is delivered


def earn_points_for_amount(amount_inr: float) -> int:
    """Points earned on a delivered order, based on what was actually paid."""
    if amount_inr <= 0:
        return 0
    return floor(amount_inr / 100) * POINTS_PER_100_RUPEES


def max_redeemable_points(points_balance: int, payable_amount_inr: float) -> int:
    """The most points a shopper can apply to an order of this size, capped
    so the order never becomes free (payment gateways need a non-trivial
    amount to charge, and a Re 0 order is not a real purchase)."""
    if points_balance <= 0 or payable_amount_inr <= MIN_PAYABLE_INR:
        return 0
    max_by_amount = floor((payable_amount_inr - MIN_PAYABLE_INR) / POINT_VALUE_INR)
    return max(0, min(points_balance, max_by_amount))
