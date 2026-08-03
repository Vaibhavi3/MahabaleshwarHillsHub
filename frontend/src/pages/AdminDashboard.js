import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
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

const AdminDashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      const response = await api.getProducts(page * 20, 20);
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to load products');
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

  useEffect(() => {
    if (!user?.is_admin) return;
    setLoading(true);
    const load = tab === 'products' ? loadProducts() : loadOrders();
    load.finally(() => setLoading(false));
  }, [tab, loadProducts, loadOrders, user]);

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

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
                      <td className="p-3">{p.stock}</td>
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
    </div>
  );
};

export default AdminDashboard;
