import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    cartDrawerOpen: false,
  },
  reducers: {
    openCartDrawer: (state) => {
      state.cartDrawerOpen = true;
    },
    closeCartDrawer: (state) => {
      state.cartDrawerOpen = false;
    },
  },
});

export const { openCartDrawer, closeCartDrawer } = uiSlice.actions;
export default uiSlice.reducer;
