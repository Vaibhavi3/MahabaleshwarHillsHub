import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../api/axiosConfig';
import { clearCart } from '../features/cartSlice';
import { FiTruck, FiShield, FiCheck, FiEdit2, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import AddressForm from '../components/AddressForm';

const CHECKOUT_STEPS = [
  { key: 'address', label: 'Shipping' },
  { key: 'payment', label: 'Payment' },
];

const CheckoutProgress = ({ step }) => {
  const activeIndex = CHECKOUT_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center mb-8 max-w-sm">
      {CHECKOUT_STEPS.map((s, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDone || isActive ? 'bg-brand text-white' : 'bg-surface text-muted'
                }`}
              >
                {isDone ? <FiCheck size={14} /> : i + 1}
              </span>
              <span
                className={`text-sm font-bold uppercase tracking-wide ${
                  isDone || isActive ? 'text-ink' : 'text-muted'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < CHECKOUT_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${isDone ? 'bg-brand' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY || '');

const StripeCheckoutForm = ({ order, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      const { data } = await api.createPaymentIntent(order.id);
      const result = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      await api.confirmPayment(order.id, result.paymentIntent.id);
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg px-4 py-3">
        <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
      </div>
      <button onClick={handlePay} disabled={!stripe || processing} className="btn-primary w-full disabled:opacity-50">
        {processing ? 'Processing...' : `Pay ₹${order.total_amount.toFixed(2)}`}
      </button>
    </div>
  );
};

const RazorpayButton = ({ order, onSuccess }) => {
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    setProcessing(true);
    try {
      const { data } = await api.createRazorpayOrder(order.id);
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: 'Mahabaleshwar Hills Hub',
          order_id: data.razorpay_order_id,
          handler: async (response) => {
            try {
              await api.verifyRazorpayPayment({
                order_id: order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          theme: { color: '#7c3aed' },
        });
        rzp.on('payment.failed', () => reject(new Error('Payment failed')));
        rzp.open();
      });
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <button onClick={handlePay} disabled={processing} className="btn-primary w-full disabled:opacity-50">
      {processing ? 'Processing...' : `Pay ₹${order.total_amount.toFixed(2)} with Razorpay`}
    </button>
  );
};

const Checkout = () => {
  const { items, couponCode, discountAmount } = useSelector((state) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [step, setStep] = useState('address');
  const [order, setOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [submitting, setSubmitting] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const response = await api.getAddresses();
        setSavedAddresses(response.data);
        if (response.data.length > 0) {
          const preferred = response.data.find((a) => a.is_default) || response.data[0];
          setSelectedAddressId(preferred.id);
        } else {
          setAddressFormOpen(true);
        }
      } catch (error) {
        toast.error('Failed to load your saved addresses');
      } finally {
        setLoadingAddresses(false);
      }
    };
    loadAddresses();
  }, []);

  const handleAddressSaved = (saved) => {
    setSavedAddresses((prev) => {
      const rest = saved.is_default ? prev.map((a) => ({ ...a, is_default: false })) : [...prev];
      const withoutSaved = rest.filter((a) => a.id !== saved.id);
      return [...withoutSaved, saved].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
    });
    setSelectedAddressId(saved.id);
    setAddressFormOpen(false);
    setEditingAddress(null);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    const selected = savedAddresses.find((a) => a.id === selectedAddressId);
    if (!selected) {
      toast.error('Please select or add a shipping address');
      return;
    }
    setSubmitting(true);
    try {
      // Backend orders are built from the server-side cart, so mirror the
      // client cart there before creating the order.
      await api.clearCart();
      for (const item of items) {
        await api.addToCart({ product_id: item.id, quantity: item.quantity });
      }

      const shipping_address = `${selected.full_name}, ${selected.phone}, ${selected.address_line}, ${selected.city}, ${selected.state} ${selected.postal_code}, ${selected.country}`;
      const response = await api.createOrder({
        shipping_address,
        payment_method: paymentMethod,
        coupon_code: couponCode || undefined,
      });
      setOrder(response.data);
      setStep('payment');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    dispatch(clearCart());
    toast.success('Order placed successfully!');
    navigate('/orders');
  };

  if (items.length === 0 && step === 'address') {
    return <div className="container mx-auto px-4 py-16 text-center text-gray-600">Your cart is empty</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>
      <CheckoutProgress step={step} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          {step === 'address' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-3">Shipping Address</h2>
                {loadingAddresses ? (
                  <p className="text-sm text-muted">Loading your addresses...</p>
                ) : addressFormOpen ? (
                  <AddressForm
                    initial={editingAddress}
                    onSaved={handleAddressSaved}
                    onCancel={
                      savedAddresses.length > 0
                        ? () => {
                            setAddressFormOpen(false);
                            setEditingAddress(null);
                          }
                        : undefined
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {savedAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedAddressId === addr.id ? 'border-brand ring-1 ring-brand' : 'border-gray-200 hover:border-ink'
                        }`}
                      >
                        <input
                          type="radio"
                          name="savedAddress"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1 accent-brand shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-ink bg-surface px-2 py-0.5 rounded">
                              {addr.label}
                            </span>
                            {addr.is_default && (
                              <span className="text-[10px] font-bold uppercase text-brand">Default</span>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-ink">
                            {addr.full_name} &middot; {addr.phone}
                          </p>
                          <p className="text-sm text-muted">
                            {addr.address_line}, {addr.city}, {addr.state} {addr.postal_code}, {addr.country}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setEditingAddress(addr);
                            setAddressFormOpen(true);
                          }}
                          className="text-muted hover:text-brand shrink-0"
                          title="Edit address"
                        >
                          <FiEdit2 size={15} />
                        </button>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddress(null);
                        setAddressFormOpen(true);
                      }}
                      className="flex items-center gap-1.5 text-sm font-bold uppercase text-brand hover:underline"
                    >
                      <FiPlus /> Add a new address
                    </button>
                  </div>
                )}
              </div>

              {!addressFormOpen && savedAddresses.length > 0 && (
                <form onSubmit={handleCreateOrder} className="space-y-4 pt-2 border-t">
                  <h2 className="text-xl font-semibold mb-2 pt-4">Payment Method</h2>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="paymentMethod" value="razorpay" checked={paymentMethod === 'razorpay'} onChange={(e) => setPaymentMethod(e.target.value)} />
                      Razorpay (UPI / Cards)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="paymentMethod" value="stripe" checked={paymentMethod === 'stripe'} onChange={(e) => setPaymentMethod(e.target.value)} />
                      Stripe (International Cards)
                    </label>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted -mt-2">
                    <FiShield className="text-brand shrink-0" /> All payments are processed securely online. Cash on Delivery is not available.
                  </p>

                  <button type="submit" disabled={submitting || !selectedAddressId} className="btn-primary w-full disabled:opacity-50">
                    {submitting ? 'Please wait...' : 'Continue to Payment'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-4">Payment</h2>
              {paymentMethod === 'razorpay' ? (
                <RazorpayButton order={order} onSuccess={handlePaymentSuccess} />
              ) : (
                <Elements stripe={stripePromise}>
                  <StripeCheckoutForm order={order} onSuccess={handlePaymentSuccess} />
                </Elements>
              )}
              <button onClick={() => setStep('address')} className="btn-secondary w-full mt-3">
                Back
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 h-fit">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name} x {item.quantity}</span>
                <span>₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          {couponCode && (
            <div className="space-y-1 mb-2 pb-2 border-b">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-700 font-semibold">
                <span>Coupon ({couponCode})</span>
                <span>- ₹{discountAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="border-t pt-4 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <FiTruck className="text-brand shrink-0" /> Free shipping on every order, no minimum
            </span>
            <span className="flex items-center gap-1.5">
              <FiShield className="text-brand shrink-0" /> Secure checkout via Stripe or Razorpay
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
