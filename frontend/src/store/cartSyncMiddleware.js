import api from '../api/axiosConfig';

// Keeps the account's server-side cart (backend/app/routes/cart.py) in
// step with the local, instant-feeling Redux cart used everywhere else
// in the app (ProductCard, QuickViewModal, ProductDetail, CartDrawer,
// Cart, Wishlist's "move to bag", Orders' "buy again", Frequently
// Bought Together). Nothing in those components needs to change or wait
// on a network round trip - this just mirrors each mutation to the
// account in the background, the same way the cart already follows a
// shopper across devices for the wishlist. Failures are swallowed: the
// local cart (and localStorage mirror) stays the source of truth for
// this browser; the next login's /cart/sync call reconciles anything
// that didn't make it to the account.
const cartSyncMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  const token = store.getState().auth?.token;
  if (!token) return result;

  switch (action.type) {
    case 'cart/addToCart':
      api
        .addToCart({ product_id: action.payload.id, quantity: action.payload.quantity || 1 })
        .catch(() => {});
      break;
    case 'cart/updateCartItem':
      api.updateCartItemByProduct(action.payload.id, action.payload.quantity).catch(() => {});
      break;
    case 'cart/removeFromCart':
      api.removeFromCartByProduct(action.payload).catch(() => {});
      break;
    case 'cart/clearCart':
      api.clearCart().catch(() => {});
      break;
    default:
      break;
  }

  return result;
};

export default cartSyncMiddleware;
