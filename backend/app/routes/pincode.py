import re

import requests
from fastapi import APIRouter

from app import schemas

router = APIRouter()

PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")
LOOKUP_URL = "https://api.postalpincode.in/pincode/{code}"
LOOKUP_TIMEOUT_SECONDS = 4


@router.get("/pincode/{code}", response_model=schemas.PincodeLookupResult)
def lookup_pincode(code: str):
    """Look up the city/state for an Indian PIN code via India Post's public
    lookup, so checkout and the PDP delivery check show a real place name
    instead of a made-up delivery estimate. Never raises on a bad PIN code
    or an unreachable upstream - callers get `valid`/`found` flags to decide
    what to show instead of an error page."""
    if not PINCODE_RE.match(code):
        return schemas.PincodeLookupResult(valid=False, found=False)

    try:
        response = requests.get(LOOKUP_URL.format(code=code), timeout=LOOKUP_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
        payload = data[0] if isinstance(data, list) and data else None
        post_offices = (payload or {}).get("PostOffice") or []
        if payload and payload.get("Status") == "Success" and post_offices:
            first = post_offices[0]
            return schemas.PincodeLookupResult(
                valid=True,
                found=True,
                city=first.get("District"),
                state=first.get("State"),
            )
        return schemas.PincodeLookupResult(valid=True, found=False)
    except (requests.RequestException, ValueError, KeyError, IndexError):
        # Upstream lookup is unavailable - the PIN code itself may well be
        # fine, so this is reported distinctly from "not found".
        return schemas.PincodeLookupResult(valid=True, found=False, service_unavailable=True)
