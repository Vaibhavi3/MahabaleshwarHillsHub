import { createSlice } from '@reduxjs/toolkit';

const productSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    selectedProduct: null,
    isLoading: false,
    error: null,
    filters: {
      category: '',
      searchTerm: '',
    },
  },
  reducers: {
    setProducts: (state, action) => {
      state.items = action.payload;
    },
    setSelectedProduct: (state, action) => {
      state.selectedProduct = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
});

export const { setProducts, setSelectedProduct, setLoading, setError, setFilters } =
  productSlice.actions;
export default productSlice.reducer;
