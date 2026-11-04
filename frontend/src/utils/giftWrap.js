// Mirrors backend/app/utils/giftwrap.py, for instant checkout display only.
// The backend recomputes this fee itself at order creation and is the only
// thing that actually charges it, so nothing here needs to be trusted.
export const GIFT_WRAP_FEE_INR = 39;
export const GIFT_MESSAGE_MAX_LEN = 300;
