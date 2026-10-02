import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  id: null,
  name: '',
  description: '',
  price: '',
  stock: '',
  category: 'socks',
  image_url: '',
  color: '',
  size: '',
  material: '',
};

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const EMPTY_COUPON_FORM = {
  id: null,
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: '',
  min_order_value: '0',
  max_discount: '',
  usage_limit: '',
  is_active: true,
  expires_at: '',
};

const AdminDashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON_FORM);
  const [loading, setLoading] = useState(true);
  const [alertCounts, setAlertCounts] = useState({});

  const loadProducts = useCallback(async () => {
    try {
      const response = await api.getProducts(page * 20, 20);
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to load products');
    }
    try {
      const countsResponse = await api.getStockAlertPendingCounts();
      setAlertCounts(countsResponse.data);
    } catch (error) {
      // non-critical - the product table just won't show waiting counts
    }
  }, [page]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await api.getAllOrders();
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    try {
      const response = await api.getCoupons();
      setCoupons(response.data);
    } catch (error) {
      toast.error('Failed to load offers');
    }
  }, []);

  useEffect(() => {
    if (!user?.is_admin) return;
    setLoading(true);
    const load = tab === 'products' ? loadProducts() : tab === 'orders' ? loadOrders() : loadCoupons();
    load.finally(() => setLoading(false));
  }, [tab, loadProducts, loadOrders, loadCoupons, user]);

  if (!user?.is_admin) {
    return <div className="container mx-auto px-4 py-16 text-center text-gray-600">Admin access only</div>;
  }

  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      stock: parseInt(form.stock, 10),
      category: form.category,
      image_url: form.image_url,
      color: form.color,
      size: form.size,
      material: form.material,
    };
    try {
      if (form.id) {
        await api.updateProduct(form.id, payload);
        toast.success('Product updated');
      } else {
        await api.createProduct(payload);
        toast.success('Product created');
      }
      setForm(EMPTY_FORM);
      loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Save failed');
    }
  };

  const handleEdit = (product) => {
    setForm({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      category: product.category,
      image_url: product.image_url || '',
      color: product.color || '',
      size: product.size || '',
      material: product.material || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.deleteProduct(id);
      toast.success('Product deleted');
      loadProducts();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const handleOrderStatus = async (orderId, status) => {
    try {
      await api.updateOrder(orderId, { status });
      toast.success('Order updated');
      loadOrders();
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleCouponFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCouponForm({ ...couponForm, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmitCoupon = async (e) => {
    e.preventDefault();
    const payload = {
      code: couponForm.code.trim().toUpperCase(),
      description: couponForm.description || undefined,
      discount_type: couponForm.discount_type,
      discount_value: parseFloat(couponForm.discount_value),
      min_order_value: parseFloat(couponForm.min_order_value) || 0,
      max_discount: couponForm.max_discount ? parseFloat(couponForm.max_discount) : undefined,
      usage_limit: couponForm.usage_limit ? parseInt(couponForm.usage_limit, 10) : undefined,
      is_active: couponForm.is_active,
      expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : undefined,
    };
    try {
      if (couponForm.id) {
        // Code can't be changed via the admin update endpoint - drop it.
        const { code, ...updatePayload } = payload;
        await api.updateCoupon(couponForm.id, updatePayload);
        toast.success('Offer updated');
      } else {
        await api.createCoupon(payload);
        toast.success('Offer created');
      }
      setCouponForm(EMPTY_COUPON_FORM);
      loadCoupons();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Save failed');
    }
  };

  const handleEditCoupon = (coupon) => {
    setCouponForm({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_value: coupon.min_order_value,
      max_discount: coupon.max_discount || '',
      usage_limit: coupon.usage_limit || '',
      is_active: coupon.is_active,
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Delete this offer?')) return;
    try {
      await api.deleteCoupon(id);
      toast.success('Offer deleted');
      loadCoupons();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-8"><h1 className="text-3xl font-bold">Admin Dashboard</h1><Link to="/crm" className="btn-primary">Open CRM</Link></div>

      <div className="flex gap-4 mb-8 border-b">
        <button
          className={`pb-2 font-semibold ${tab === 'products' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
          onClick={() => setTab('products')}
        >
          Products
        </button>
        <button
          className={`pb-2 font-semibold ${tab === 'orders' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
          onClick={() => setTab('orders')}
        >
          Orders
        </button>
        <button
          className={`pb-2 font-semibold ${tab === 'offers' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
          onClick={() => setTab('offers')}
        >
          Offers
        </button>
      </div>

      {tab === 'products' && (
        <>
          <form
            onSubmit={handleSubmitProduct}
            className="bg-white rounded-lg shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input name="name" value={form.name} onChange={handleFormChange} placeholder="Name" required className="border rounded-lg px-4 py-2" />
            <select name="category" value={form.category} onChange={handleFormChange} className="border rounded-lg px-4 py-2">
              <option value="socks">Socks</option>
              <option value="slidders">Slidders</option>
              <option value="bags">Bags</option>
            </select>
            <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleFormChange} placeholder="Price" required className="border rounded-lg px-4 py-2" />
            <input name="stock" type="number" min="0" value={form.stock} onChange={handleFormChange} placeholder="Stock" required className="border rounded-lg px-4 py-2" />
            <input name="color" value={form.color} onChange={handleFormChange} placeholder="Color" className="border rounded-lg px-4 py-2" />
            <input name="size" value={form.size} onChange={handleFormChange} placeholder="Size" className="border rounded-lg px-4 py-2" />
            <input name="material" value={form.material} onChange={handleFormChange} placeholder="Material" className="border rounded-lg px-4 py-2" />
            <input
              name="image_url"
              value={form.image_url}
              onChange={handleFormChange}
              placeholder="/static/products/.../x.jpg"
              className="border rounded-lg px-4 py-2 md:col-span-2"
            />
            <textarea
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Description"
              className="border rounded-lg px-4 py-2 md:col-span-3"
            />
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary">
                {form.id ? 'Update Product' : 'Add Product'}
              </button>
              {form.id && (
                <button type="button" onClick={() => setForm(EMPTY_FORM)} className="btn-secondary">
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <div className="text-center text-gray-600">Loading...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Color</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">{p.name}</td>
                      <td className="p-3">{p.category}</td>
                      <td className="p-3">{p.color}</td>
                      <td className="p-3">₹{p.price}</td>
                      <td className="p-3">
                        {p.stock}
                        {p.stock <= 0 && alertCounts[String(p.id)] > 0 && (
                          <span
                            className="ml-2 inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full"
                            title="Customers waiting for a back-in-stock email"
                          >
                            {alertCounts[String(p.id)]} waiting
                          </span>
                        )}
                      </td>
                      <td className="p-3 flex gap-3">
                        <button onClick={() => handleEdit(p)} className="text-purple-600 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-secondary disabled:opacity-50">
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button onClick={() => setPage(page + 1)} disabled={products.length < 20} className="btn-secondary disabled:opacity-50">
              Next
            </button>
          </div>
        </>
      )}

      {tab === 'orders' &&
        (loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                  <div>
                    <p className="font-semibold">{order.order_number}</p>
                    <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <select
                    value={order.status}
                    onChange={(e) => handleOrderStatus(order.id, e.target.value)}
                    className="border rounded-lg px-3 py-1"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-gray-600 mb-2">{order.shipping_address}</p>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-gray-600">
                    Payment: {order.payment_status} ({order.payment_method})
                  </span>
                  <span className="font-bold">₹{order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {orders.length === 0 && <div className="text-center text-gray-600">No orders yet</div>}
          </div>
        ))}

      {tab === 'offers' && (
        <>
          <form
            onSubmit={handleSubmitCoupon}
            className="bg-white rounded-lg shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input
              name="code"
              value={couponForm.code}
              onChange={handleCouponFormChange}
              placeholder="Code (e.g. WELCOME10)"
              required
              disabled={!!couponForm.id}
              className="border rounded-lg px-4 py-2 uppercase disabled:bg-gray-100"
            />
            <select name="discount_type" value={couponForm.discount_type} onChange={handleCouponFormChange} className="border rounded-lg px-4 py-2">
              <option value="percent">Percent off</option>
              <option value="flat">Flat amount off</option>
            </select>
            <input
              name="discount_value"
              type="number"
              step="0.01"
              min="0.01"
              value={couponForm.discount_value}
              onChange={handleCouponFormChange}
              placeholder={couponForm.discount_type === 'percent' ? 'Discount %' : 'Discount ₹'}
              required
              className="border rounded-lg px-4 py-2"
            />
            <input
              name="min_order_value"
              type="number"
              step="0.01"
              min="0"
              value={couponForm.min_order_value}
              onChange={handleCouponFormChange}
              placeholder="Minimum order value (₹)"
              className="border rounded-lg px-4 py-2"
            />
            <input
              name="max_discount"
              type="number"
              step="0.01"
              min="0"
              value={couponForm.max_discount}
              onChange={handleCouponFormChange}
              placeholder="Max discount cap (₹, percent coupons only)"
              className="border rounded-lg px-4 py-2"
            />
            <input
              name="usage_limit"
              type="number"
              step="1"
              min="1"
              value={couponForm.usage_limit}
              onChange={handleCouponFormChange}
              placeholder="Usage limit (blank = unlimited)"
              className="border rounded-lg px-4 py-2"
            />
            <input
              name="expires_at"
              type="date"
              value={couponForm.expires_at}
              onChange={handleCouponFormChange}
              className="border rounded-lg px-4 py-2"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="is_active" checked={couponForm.is_active} onChange={handleCouponFormChange} />
              Active (shown in "Available Offers" to shoppers)
            </label>
            <textarea
              name="description"
              value={couponForm.description}
              onChange={handleCouponFormChange}
              placeholder="Description shown to shoppers (e.g. On orders above ₹499)"
              className="border rounded-lg px-4 py-2 md:col-span-3"
            />
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary">
                {couponForm.id ? 'Update Offer' : 'Add Offer'}
              </button>
              {couponForm.id && (
                <button type="button" onClick={() => setCouponForm(EMPTY_COUPON_FORM)} className="btn-secondary">
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <div className="text-center text-gray-600">Loading...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Discount</th>
                    <th className="p-3">Min Order</th>
                    <th className="p-3">Used</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-semibold">{c.code}</td>
                      <td className="p-3">{c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`}</td>
                      <td className="p-3">₹{c.min_order_value}</td>
                      <td className="p-3">
                        {c.used_count}
                        {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                      </td>
                      <td className="p-3">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 flex gap-3">
                        <button onClick={() => handleEditCoupon(c)} className="text-purple-600 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteCoupon(c.id)} className="text-red-600 hover:underline">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-600">
                        No offers yet - add one above to show it in the shop's "Available Offers".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
