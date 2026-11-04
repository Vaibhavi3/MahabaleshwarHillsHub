"""
Optional "Gift Wrap & Personalised Note" at checkout, inspired by Myntra's
checkout-page gift wrap add-on (a flat fee under "Giftings &
Personalizations" that adds kraft-paper wrap plus a handwritten-style
message to the recipient).

Fits this store honestly: a flat, disclosed fee (not a fabricated discount
or urgency device), and the wrap itself is real - kraft paper and a
handwritten note card, consistent with "100% Handmade". No invented
delivery promise is attached to it.

Mirrored in frontend/src/utils/giftWrap.js for instant checkout display;
this module (and the order-creation total it is added into) stays the
single source of truth that actually gets charged.
"""

GIFT_WRAP_FEE_INR = 39.0
GIFT_MESSAGE_MAX_LEN = 300
