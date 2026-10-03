import { createSlice } from '@reduxjs/toolkit';

// The wishlist is account-backed (see backend/app/routes/wishlist.py) -
// components call the API directly and hand the resulting list to
// setWishlistItems, the same way Addresses/Orders pages work. This slice
// just holds that list and mirrors it to local storage so the page still
// has something to show instantly on reload, before the account's real
// list has been re-fetched.
const mapWishlistResponse = (data) =>
  data.map((entry) => ({
    id: entry.product.id,
    name: entry.product.name,
    price: entry.product.price,
    image_url: entry.product.image_url,
    stock: entry.product.stock,
  }));

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: {
    items: JSON.parse(localStorage.getItem('wishlistItems')) || [],
  },
  reducers: {
    setWishlistItems: (state, action) => {
      state.items = action.payload;
      localStorage.setItem('wishlistItems', JSON.stringify(state.items));
    },
    clearWishlist: (state) => {
      state.items = [];
      localStorage.removeItem('wishlistItems');
    },
  },
});

export { mapWishlistResponse };
export const { setWishlistItems, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
