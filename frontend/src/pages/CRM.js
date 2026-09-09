import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
const TABS = ['overview', 'customers', 'leads', 'tasks'];

const money = (value) => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const fullName = (lead) => [lead.first_name, lead.last_name].filter(Boolean).join(' ');

const Metric = ({ label, value, detail }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
  </div>
);

const CRM = () => {
  const { user } = useSelector((state) => state.auth);
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadForm, setLeadForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', source: 'website', value: '', notes: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '', customer_id: '', lead_id: '' });

  const loadOverview = async () => {
    const response = await api.getCRMOverview();
    setOverview(response.data);
  };
  const loadCustomers = async () => {
    const response = await api.getCRMCustomers({ search: customerSearch || undefined });
    setCustomers(response.data);
  };
  const loadLeads = async () => {
    const response = await api.getCRMLeads();
    setLeads(response.data);
  };
  const loadActivities = async () => {
    const response = await api.getCRMActivities({ open_only: tab === 'tasks' });
    setActivities(response.data);
  };

  useEffect(() => {
    if (!user?.is_admin) return;
    setLoading(true);
    Promise.all([loadOverview(), loadCustomers(), loadLeads(), loadActivities()])
      .catch((error) => toast.error(error.response?.data?.detail || 'Could not load CRM data'))
      .finally(() => setLoading(false));
  }, [user, customerSearch, tab]);

  if (!user?.is_admin) return <div className="container mx-auto px-4 py-16 text-center text-gray-600">Admin access only</div>;
  if (loading && !overview) return <div className="container mx-auto px-4 py-16 text-center text-gray-600">Loading CRM...</div>;

  const tabClass = (name) => 'px-4 py-2 text-sm font-semibold border-b-2 ' + (tab === name ? 'text-purple-700 border-purple-600' : 'text-gray-500 border-transparent');

  const openCustomer = async (id) => {
    try {
      const response = await api.getCRMCustomer(id);
      setSelectedCustomer(response.data);
    } catch (error) {
      toast.error('Could not load customer');
    }
  };

  const createLead = async (event) => {
    event.preventDefault();
    try {
      await api.createCRMLead({ ...leadForm, value: Number(leadForm.value || 0) });
      setLeadForm({ first_name: '', last_name: '', email: '', phone: '', company: '', source: 'website', value: '', notes: '' });
      await Promise.all([loadLeads(), loadOverview()]);
      toast.success('Lead created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create lead');
    }
  };

  const updateLeadStatus = async (lead, status) => {
    try {
      await api.updateCRMLead(lead.id, { status });
      await Promise.all([loadLeads(), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not update lead');
    }
  };

  const createTask = async (event) => {
    event.preventDefault();
    if (!taskForm.customer_id && !taskForm.lead_id) {
      toast.error('Select a customer or lead');
      return;
    }
    try {
      await api.createCRMActivity({
        type: 'task',
        title: taskForm.title,
        description: taskForm.description || null,
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
        customer_id: taskForm.customer_id ? Number(taskForm.customer_id) : null,
        lead_id: taskForm.lead_id ? Number(taskForm.lead_id) : null,
      });
      setTaskForm({ title: '', description: '', due_date: '', customer_id: '', lead_id: '' });
      await Promise.all([loadActivities(), loadOverview()]);
      toast.success('Task created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create task');
    }
  };

  const completeTask = async (activity) => {
    try {
      await api.updateCRMActivity(activity.id, { completed: true });
      await Promise.all([loadActivities(), loadOverview()]);
      if (selectedCustomer) openCustomer(selectedCustomer.customer.id);
    } catch (error) {
      toast.error('Could not complete task');
    }
  };

  const pipelineTotal = useMemo(() => Object.values(overview?.pipeline || {}).reduce((sum, item) => sum + Number(item.value || 0), 0), [overview]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div><p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Operations</p><h1 className="text-3xl font-bold text-gray-900">Customer Relationship Manager</h1><p className="text-gray-500 mt-1">One workspace for customers, sales follow-up, and order relationships.</p></div>
        <a href="/admin" className="text-sm text-purple-700 hover:underline">Back to store admin →</a>
      </div>
      <div className="flex gap-2 border-b border-gray-200 mb-8 overflow-x-auto">
        {TABS.map((name) => <button key={name} onClick={() => setTab(name)} className={tabClass(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}
      </div>

      {tab === 'overview' && overview && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Metric label="Customers" value={overview.total_customers} detail="Registered shoppers" />
            <Metric label="Orders" value={overview.total_orders} detail="All-time orders" />
            <Metric label="Revenue" value={money(overview.total_revenue)} detail="From existing orders" />
            <Metric label="Active leads" value={overview.active_leads} detail="Not won or lost" />
            <Metric label="Open tasks" value={overview.open_tasks} detail="Needs follow-up" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-lg">Recent orders</h2><button onClick={() => setTab('customers')} className="text-sm text-purple-700">View customers</button></div>
              <div className="divide-y">{overview.recent_orders.map((order) => <div key={order.id} className="py-3 flex flex-wrap justify-between gap-2"><div><p className="font-medium">{order.customer_name}</p><p className="text-xs text-gray-500">{order.order_number} · {date(order.created_at)}</p></div><div className="text-right"><p className="font-semibold">{money(order.total_amount)}</p><span className="text-xs text-gray-500 capitalize">{order.status}</span></div></div>)}{overview.recent_orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"><h2 className="font-bold text-lg mb-4">Pipeline value</h2><p className="text-3xl font-bold text-purple-700 mb-4">{money(pipelineTotal)}</p><div className="space-y-3">{LEAD_STATUSES.map((status) => <div key={status} className="flex justify-between text-sm"><span className="capitalize text-gray-600">{status}</span><span className="font-medium">{money(overview.pipeline?.[status]?.value || 0)} · {overview.pipeline?.[status]?.count || 0}</span></div>)}</div></div>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6"><div className="flex justify-between gap-3 mb-4"><h2 className="font-bold text-lg">Customers</h2><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name or email" className="border rounded-lg px-3 py-2 text-sm w-64" /></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-gray-500 border-b"><tr><th className="py-3">Customer</th><th className="py-3">Orders</th><th className="py-3">Lifetime value</th><th className="py-3">Last order</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id} onClick={() => openCustomer(customer.id)} className="border-b last:border-0 hover:bg-purple-50 cursor-pointer"><td className="py-3"><p className="font-medium">{customer.name}</p><p className="text-xs text-gray-500">{customer.email}</p></td><td className="py-3">{customer.order_count}</td><td className="py-3 font-medium">{money(customer.lifetime_value)}</td><td className="py-3 text-gray-500">{date(customer.last_order_at)}</td></tr>)}</tbody></table>{customers.length === 0 && <p className="text-gray-500 py-6 text-center">No customers found.</p>}</div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">{selectedCustomer ? <><div className="flex justify-between"><div><h2 className="font-bold text-lg">{selectedCustomer.customer.name}</h2><p className="text-sm text-gray-500">{selectedCustomer.customer.email}</p><p className="text-sm text-gray-500">{selectedCustomer.customer.phone || 'No phone'} · {selectedCustomer.customer.city || 'No city'}</p></div><button onClick={() => setSelectedCustomer(null)} className="text-gray-400">×</button></div><div className="grid grid-cols-2 gap-3 my-5"><div className="bg-purple-50 rounded-lg p-3"><p className="text-xs text-gray-500">Orders</p><p className="font-bold">{selectedCustomer.customer.order_count}</p></div><div className="bg-purple-50 rounded-lg p-3"><p className="text-xs text-gray-500">Value</p><p className="font-bold">{money(selectedCustomer.customer.lifetime_value)}</p></div></div><h3 className="font-semibold mb-2">Order history</h3><div className="space-y-2 mb-5">{selectedCustomer.orders.map((order) => <div key={order.id} className="flex justify-between text-sm"><span>{order.order_number}<span className="text-gray-400"> · {order.status}</span></span><span>{money(order.total_amount)}</span></div>)}{selectedCustomer.orders.length === 0 && <p className="text-sm text-gray-500">No orders yet.</p>}</div><h3 className="font-semibold mb-2">Activities</h3><div className="space-y-2">{selectedCustomer.activities.map((activity) => <div key={activity.id} className="text-sm"><p className="font-medium">{activity.title}</p><p className="text-xs text-gray-500">{activity.type} · {activity.completed ? 'Completed' : 'Open'}</p></div>)}{selectedCustomer.activities.length === 0 && <p className="text-sm text-gray-500">No activities yet.</p>}</div></> : <p className="text-gray-500 text-sm">Select a customer to see order history and CRM activity.</p>}</div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><form onSubmit={createLead} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3"><h2 className="font-bold text-lg mb-4">Add lead</h2><div className="grid grid-cols-2 gap-3"><input required value={leadForm.first_name} onChange={(e) => setLeadForm({ ...leadForm, first_name: e.target.value })} placeholder="First name" className="border rounded-lg px-3 py-2" /><input value={leadForm.last_name} onChange={(e) => setLeadForm({ ...leadForm, last_name: e.target.value })} placeholder="Last name" className="border rounded-lg px-3 py-2" /></div><input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="Email" className="border rounded-lg px-3 py-2 w-full" /><input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="Phone" className="border rounded-lg px-3 py-2 w-full" /><input value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} placeholder="Company or group" className="border rounded-lg px-3 py-2 w-full" /><div className="grid grid-cols-2 gap-3"><select value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} className="border rounded-lg px-3 py-2"><option value="website">Website</option><option value="referral">Referral</option><option value="social">Social</option><option value="offline">Offline</option></select><input type="number" min="0" value={leadForm.value} onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })} placeholder="Value ₹" className="border rounded-lg px-3 py-2" /></div><textarea value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} placeholder="Notes" rows="3" className="border rounded-lg px-3 py-2 w-full" /><button className="btn-primary w-full">Create lead</button></form><div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6"><h2 className="font-bold text-lg mb-4">Sales pipeline</h2><div className="space-y-3">{leads.map((lead) => <div key={lead.id} className="border rounded-lg p-4 flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{fullName(lead)}</p><p className="text-sm text-gray-500">{lead.email || 'No email'}{lead.company ? ' · ' + lead.company : ''}</p><p className="text-xs text-gray-400 mt-1">{lead.source} · {money(lead.value)}</p></div><select value={lead.status} onChange={(e) => updateLeadStatus(lead, e.target.value)} className="border rounded-lg px-3 py-2 text-sm">{LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>)}{leads.length === 0 && <p className="text-gray-500">No leads yet. Add your first prospect.</p>}</div></div></div>
      )}

      {tab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><form onSubmit={createTask} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3"><h2 className="font-bold text-lg mb-4">Create follow-up task</h2><input required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" className="border rounded-lg px-3 py-2 w-full" /><textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Details" rows="3" className="border rounded-lg px-3 py-2 w-full" /><input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} className="border rounded-lg px-3 py-2 w-full" /><select value={taskForm.customer_id} onChange={(e) => setTaskForm({ ...taskForm, customer_id: e.target.value, lead_id: '' })} className="border rounded-lg px-3 py-2 w-full"><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><select value={taskForm.lead_id} onChange={(e) => setTaskForm({ ...taskForm, lead_id: e.target.value, customer_id: '' })} className="border rounded-lg px-3 py-2 w-full"><option value="">Or select lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{fullName(lead)}</option>)}</select><button className="btn-primary w-full">Create task</button></form><div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6"><h2 className="font-bold text-lg mb-4">Open follow-ups</h2><div className="space-y-3">{activities.map((activity) => <div key={activity.id} className="border rounded-lg p-4 flex justify-between gap-4"><div><p className="font-semibold">{activity.title}</p><p className="text-sm text-gray-500">{activity.customer_name || activity.lead_name || 'Unassigned'} · due {date(activity.due_date)}</p><p className="text-sm text-gray-600 mt-1">{activity.description || 'No details'}</p></div><button onClick={() => completeTask(activity)} className="text-sm text-green-700 whitespace-nowrap">Complete</button></div>)}{activities.length === 0 && <p className="text-gray-500">No open tasks.</p>}</div></div></div>
      )}
    </div>
  );
};

export default CRM;
