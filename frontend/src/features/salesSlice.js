import { createSlice } from '@reduxjs/toolkit';

// Holds the currently-live admin "Sale" campaigns (see backend
// app/routes/sales.py's public /sales/active), fetched once on app load in
// App.js - the same list every product card/detail page/checkout reads to
// price and badge a product, so it's only ever fetched once instead of
// once per card.
const salesSlice = createSlice({
  name: 'sales',
  initialState: {
    activeSales: [],
  },
  reducers: {
    setActiveSales: (state, action) => {
      state.activeSales = action.payload;
    },
  },
});

export const { setActiveSales } = salesSlice.actions;
export default salesSlice.reducer;
