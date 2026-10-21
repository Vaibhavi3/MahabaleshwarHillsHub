import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { FiChevronDown, FiLifeBuoy, FiClock, FiCheckCircle } from 'react-icons/fi';
import api from '../api/axiosConfig';
import { requireAuth } from '../utils/requireAuth';

// Real store policy only - never a fabricated delivery date, discount, or
// threshold. Mirrors the facts already shown on the homepage trust strip,
// product page badges, and checkout (see Home.js, ProductDetail.js,
// Checkout.js) and the return window return_requests.py enforces.
const FAQ_GROUPS = [
  {
    title: 'Shipping',
    items: [
      {
        q: 'Do you charge for shipping?',
        a: 'No. Shipping is free on every order, with no minimum order value required.',
      },
      {
        q: 'Which areas do you deliver to?',
        a: 'We ship across India. Once your order is placed, you can follow its progress under Your Orders, which shows each status update (confirmed, shipped, delivered) as it happens.',
      },
    ],
  },
  {
    title: 'Payments',
    items: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept card, UPI, net banking, and wallets through Stripe and Razorpay. We do not offer Cash on Delivery.',
      },
      {
        q: 'Is it safe to pay on this site?',
        a: 'Yes - we never see or store your card or bank details. Payments are handled directly by Stripe and Razorpay, both PCI-DSS compliant payment processors.',
      },
    ],
  },
  {
    title: 'Returns & Exchanges',
    items: [
      {
        q: 'What is your return window?',
        a: 'You can request a return or exchange within 7 days of delivery, directly from Your Orders - no need to raise a ticket for this. Look for the "Return / Exchange" link under the item.',
      },
      {
        q: 'My return window has passed or my order already shipped - what now?',
        a: 'Raise a ticket below under "Order related" with your order number and we will take a look.',
      },
    ],
  },
  {
    title: 'Rewards, Gift Cards & Account',
    items: [
      {
        q: 'How do Hills Rewards points work?',
        a: 'You earn points on delivered orders and can redeem your balance at checkout. See your balance and history on the Hills Rewards page.',
      },
      {
        q: 'Can I buy a gift card for someone else?',
        a: 'Yes - gift cards can be bought for yourself or emailed straight to a friend, and redeemed at checkout. See the Gift Cards page.',
      },
      {
        q: 'How do I update my profile or password?',
        a: 'Go to My Account to edit your details or change your password.',
      },
    ],
  },
];

const CATEGORIES = [
  { value: 'order', label: 'Order related' },
  { value: 'payment', label: 'Payment related' },
  { value: 'product', label: 'Product related' },
  { value: 'account', label: 'Account related' },
  { value: 'other', label: 'Something else' },
];

const STATUS_STYLES = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const FAQAccordion = () => {
  const [openKey, setOpenKey] = useState(null);
  return (
    <div className="space-y-8">
      {FAQ_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="font-bold text-ink uppercase text-sm mb-3 tracking-wide">{group.title}</h3>
          <div className="border border-gray-200 rounded divide-y divide-gray-200">
            {group.items.map((item) => {
              const key = `${group.title}:${item.q}`;
              const isOpen = openKey === key;
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    className="w-full flex items-center justify-between gap-3 text-left px-4 py-3 text-sm font-semibold text-ink"
                  >
                    {item.q}
                    <FiChevronDown className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && <p className="px-4 pb-4 text-sm text-gray-600">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const Help = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useSelector((state) => state.auth);

  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preselectOrderId = searchParams.get('order');
  const [form, setForm] = useState({
    category: preselectOrderId ? 'order' : 'other',
    order_id: preselectOrderId || '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    if (!token) return;
    api.getOrders().then((res) => setOrders(res.data)).catch(() => {});
    setLoadingTickets(true);
    api
      .getMyTickets()
      .then((res) => setTickets(res.data))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }, [token]);

  const eligibleOrders = useMemo(() => orders, [orders]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value, ...(name === 'category' && value !== 'order' ? { order_id: '' } : {}) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!requireAuth(token, navigate, location, 'Please login to raise a support ticket')) return;
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Please fill in a subject and message');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
        ...(form.category === 'order' && form.order_id ? { order_id: Number(form.order_id) } : {}),
      };
      const { data } = await api.createSupportTicket(payload);
      setTickets((prev) => [data, ...prev]);
      setForm({ category: 'other', order_id: '', subject: '', message: '' });
      toast.success("Got it - we'll get back to you soon");
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not submit your ticket, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <FiLifeBuoy className="text-brand" size={26} />
        <h1 className="text-2xl font-extrabold text-ink">Help Center</h1>
      </div>
      <p className="text-sm text-muted mb-8">
        Answers to common questions, and a way to reach us directly if you need more help.
      </p>

      <FAQAccordion />

      <div className="mt-12 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-extrabold text-ink mb-1">Still need help?</h2>
        <p className="text-sm text-muted mb-5">
          {user
            ? "Tell us what's going on and we'll get back to you by email."
            : 'Login to raise a ticket - this way we can tie it to your account and orders.'}
        </p>
        <form onSubmit={handleSubmit} className="border border-gray-200 rounded p-4 space-y-3 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {form.category === 'order' && (
              <select
                name="order_id"
                value={form.order_id}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
              >
                <option value="">No specific order</option>
                {eligibleOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number}
                  </option>
                ))}
              </select>
            )}
          </div>
          <input
            type="text"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            placeholder="Subject"
            maxLength={150}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
          />
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="Describe your issue..."
            rows={4}
            maxLength={2000}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
          />
          <button type="submit" disabled={submitting} className="btn-primary px-6 py-2 text-sm disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>
      </div>

      {token && (
        <div className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-extrabold text-ink mb-4">Your Tickets</h2>
          {loadingTickets ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted">You haven't raised any tickets yet.</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t.id} className="border border-gray-200 rounded p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold text-ink">{t.subject}</p>
                      <p className="text-xs text-muted">
                        {CATEGORIES.find((c) => c.value === t.category)?.label || t.category}
                        {t.order_number && ` · Order ${t.order_number}`}
                        {' · '}
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-700'}`}>
                      {t.status === 'resolved' ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{t.message}</p>
                  {t.admin_reply && (
                    <div className="bg-surface rounded p-3 text-sm text-ink mt-2">
                      <p className="text-xs font-bold uppercase text-muted mb-1">Our reply</p>
                      {t.admin_reply}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!token && (
        <p className="mt-6 text-sm text-muted">
          <Link to="/auth" className="text-brand font-semibold hover:underline">
            Login or create an account
          </Link>{' '}
          to raise and track support tickets.
        </p>
      )}
    </div>
  );
};

export default Help;
