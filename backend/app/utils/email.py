import os
import smtplib
import logging
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send a plain-text email via the SMTP_* settings from .env.example.

    Those settings are optional and were never wired up before - if they
    are not set, this just logs and returns False instead of failing, so
    callers can treat email as a best-effort notification, not a
    requirement."""
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not all([smtp_server, smtp_port, smtp_user, smtp_password]):
        logger.info("SMTP not configured - skipping email to %s: %s", to_email, subject)
        return False

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_email

    try:
        with smtplib.SMTP(smtp_server, int(smtp_port), timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False
