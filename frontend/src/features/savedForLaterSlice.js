import { createSlice } from '@reduxjs/toolkit';

// "Saved for Later" is account-backed (see backend/app/routes/saved_for_later.py),
// inspired by Myntra/Amazon's bag-page "Saved for later" section - components
// call the API directly and hand the resulting list to setSavedForLaterItems,
// the same way the wishlist slice works. This slice just holds that list and
// mirrors it to local storage so the page still has something to show
// instantly on reload, before the account's real list has been re-fetched.
const mapSavedForLaterResponse = (data) =>
  data.map((entry) => ({
    id: entry.product.id,
    name: entry.product.name,
    price: entry.product.price,
    image_url: entry.product.image_url,
    stock: entry.product.stock,
    category: entry.product.category,
    quantity: entry.quantity,
  }));

const savedForLaterSlice = createSlice({
  name: 'savedForLater',
  initialState: {
    items: JSON.parse(localStorage.getItem('savedForLaterItems')) || [],
  },
  reducers: {
    setSavedForLaterItems: (state, action) => {
      state.items = action.payload;
      localStorage.setItem('savedForLaterItems', JSON.stringify(state.items));
    },
    clearSavedForLater: (state) => {
      state.items = [];
      localStorage.removeItem('savedForLaterItems');
    },
  },
});

export { mapSavedForLaterResponse };
export const { setSavedForLaterItems, clearSavedForLater } = savedForLaterSlice.actions;
export default savedForLaterSlice.reducer;
