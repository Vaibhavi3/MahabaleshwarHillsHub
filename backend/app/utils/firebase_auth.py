"""Verify Firebase Phone Auth ID tokens without a service-account key.

Firebase signs ID tokens with Google's public keys, so checking the
signature, audience (project id), issuer and expiry is enough to trust
the `phone_number` claim - no secret needs to live on this server.
"""
import os
import re
import time

import requests
from jose import jwt

CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_cache = {"certs": None, "expires": 0.0}


class FirebaseTokenError(Exception):
    pass


def project_id() -> str:
    return os.getenv("FIREBASE_PROJECT_ID", "")


def _certs() -> dict:
    if _cache["certs"] and time.time() < _cache["expires"]:
        return _cache["certs"]
    resp = requests.get(CERTS_URL, timeout=10)
    resp.raise_for_status()
    max_age = re.search(r"max-age=(\d+)", resp.headers.get("Cache-Control", ""))
    _cache["certs"] = resp.json()
    _cache["expires"] = time.time() + (int(max_age.group(1)) if max_age else 3600)
    return _cache["certs"]


def verify_phone_id_token(id_token: str) -> str:
    """Return the verified E.164 phone number (e.g. +919876543210)."""
    pid = project_id()
    if not pid:
        raise FirebaseTokenError("Phone login is not configured on the server")
    try:
        kid = jwt.get_unverified_header(id_token).get("kid")
        cert = _certs().get(kid)
        if not cert:
            raise FirebaseTokenError("Unknown signing key")
        claims = jwt.decode(
            id_token,
            cert,
            algorithms=["RS256"],
            audience=pid,
            issuer=f"https://securetoken.google.com/{pid}",
            options={"verify_at_hash": False},
        )
    except FirebaseTokenError:
        raise
    except Exception as exc:  # jose raises several error types for bad/expired tokens
        raise FirebaseTokenError("Invalid or expired verification") from exc

    phone = claims.get("phone_number")
    if not claims.get("sub") or not phone:
        raise FirebaseTokenError("Token has no verified phone number")
    return phone


def phone_digits(phone: str) -> str:
    """Last 10 digits, used to match numbers saved as '98765 43210', '+91-9876543210', etc."""
    return re.sub(r"\D", "", phone or "")[-10:]
