"""
Cart-abandonment reminder, matching Myntra/Nykaa/Ajio's "you left
something in your bag" nudge: emails (and in-app notifies) a shopper
whose account cart has gone idle, listing exactly what's really still
sitting in it - real item names, quantities and prices, no invented
urgency ("selling fast", fake countdowns) and no discount that doesn't
exist.

Unlike the migrate_*.py scripts, this one is meant to run repeatedly,
not once - it's a recurring job, not a schema change. On Render, add it
as a Cron Job (Dashboard > New > Cron Job, same repo/branch) running
hourly with the command:

    python scripts/send_cart_reminder_emails.py

Safe to run as often as you like: a cart only gets reminded once per
idle stretch (see Cart.reminder_sent_at in backend/app/models.py) - it
re-arms only once the shopper touches that cart again.

Requires the `last_activity_at` / `reminder_sent_at` columns added by
scripts/migrate_add_cart_reminder_columns.py - run that migration once
before the first run of this script, and set this up as a recurring job
any time after (order between the two doesn't matter, as long as the
migration has already run by the time this script executes against
that database).

Run with DATABASE_URL set (plus SMTP_* to actually send mail - without
it, send_email() just logs and this script still marks carts reminded
and still creates the in-app notification, matching how every other
best-effort email in this app behaves):
    python send_cart_reminder_emails.py [--idle-hours 24]
"""
import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.orm import joinedload  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app import models  # noqa: E402
from app.utils.email import send_email  # noqa: E402
from app.utils.notifications import notify  # noqa: E402

SITE_URL = "https://mahabaleshwar-hills-hub-pi.vercel.app"


def _aware(dt):
    """sqlite (used in local/tests) returns naive datetimes even for a
    timezone(True) column; Postgres doesn't. Normalize to UTC either way
    so idle-time comparisons never crash or silently misfire."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _is_due(cart, cutoff) -> bool:
    last_activity = _aware(cart.last_activity_at) or _aware(cart.created_at)
    if last_activity is None or last_activity > cutoff:
        return False
    reminder_sent_at = _aware(cart.reminder_sent_at)
    if reminder_sent_at is not None and reminder_sent_at >= last_activity:
        return False  # already reminded for this idle stretch
    return True


def main(idle_hours: float) -> None:
    db = SessionLocal()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=idle_hours)
    sent = 0
    skipped_no_stock = 0

    try:
        carts = (
            db.query(models.Cart)
            .join(models.CartItem, models.CartItem.cart_id == models.Cart.id)
            .options(joinedload(models.Cart.items).joinedload(models.CartItem.product))
            .options(joinedload(models.Cart.user))
            .distinct()
            .all()
        )

        for cart in carts:
            if not _is_due(cart, cutoff):
                continue

            user = cart.user
            if not user or not user.email:
                continue

            # Only mention items that could actually be checked out today -
            # telling someone an out-of-stock item is "waiting for them"
            # would be dishonest, so a cart that's gone idle only because
            # everything in it sold out gets no reminder at all.
            in_stock_items = [ci for ci in cart.items if ci.product and ci.product.stock > 0]
            if not in_stock_items:
                skipped_no_stock += 1
                cart.reminder_sent_at = datetime.now(timezone.utc)
                db.commit()
                continue

            lines = [
                f"  - {ci.product.name} x{ci.quantity} - Rs. {ci.product.price * ci.quantity:.0f}"
                for ci in in_stock_items
            ]
            subtotal = sum(ci.product.price * ci.quantity for ci in in_stock_items)

            send_email(
                user.email,
                "You left something in your bag",
                (
                    f"Hi {user.first_name or ''},\n\n"
                    "You still have these in your Mahabaleshwar Hills Hub bag:\n\n"
                    + "\n".join(lines)
                    + f"\n\nSubtotal: Rs. {subtotal:.0f}\n\n"
                    "Shipping is always free, no minimum order.\n\n"
                    f"{SITE_URL}/cart"
                ),
            )
            notify(
                db,
                user.id,
                "cart_reminder",
                "You left something in your bag",
                body=(
                    f"{in_stock_items[0].product.name}"
                    + (f" and {len(in_stock_items) - 1} more" if len(in_stock_items) > 1 else "")
                    + f" - Rs. {subtotal:.0f}"
                ),
                link="/cart",
            )
            cart.reminder_sent_at = datetime.now(timezone.utc)
            db.commit()
            sent += 1

        print(f"Reminders sent: {sent}. Idle carts with nothing in stock: {skipped_no_stock}.")
    finally:
        db.close()


if __name__ == "__main__":
    if "DATABASE_URL" not in os.environ:
        raise SystemExit("Set DATABASE_URL before running this script.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--idle-hours",
        type=float,
        default=24,
        help="How many hours of no cart activity before a reminder is due (default: 24).",
    )
    args = parser.parse_args()
    main(args.idle_hours)
