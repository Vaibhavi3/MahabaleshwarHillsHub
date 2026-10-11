import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../api/axiosConfig';
import { clearCart } from '../features/cartSlice';
import { FiTruck, FiShield, FiCheck, FiAward, FiGift, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import AddressBook from '../components/AddressBook';

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
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [rewardsBalance, setRewardsBalance] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [useRewards, setUseRewards] = useState(false);
  const [giftCardInput, setGiftCardInput] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [applyingGiftCard, setApplyingGiftCard] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalBeforeRewards = Math.max(0, subtotal - discountAmount);
  // Points can never take the payable total below Re 1 - a Rs 0 order isn't
  // something Stripe/Razorpay can actually charge.
  const maxRedeemable = Math.max(0, Math.min(rewardsBalance, Math.floor(totalBeforeRewards - 1)));
  const pointsToRedeem = useRewards ? Math.min(redeemPoints, maxRedeemable) : 0;
  const totalBeforeGiftCard = Math.max(0, totalBeforeRewards - pointsToRedeem);
  // Same Re 1 floor applies to a gift card - any amount beyond that stays
  // on the card for a future order instead of zeroing this one out.
  const giftCardAmount = appliedGiftCard
    ? Math.max(0, Math.min(appliedGiftCard.balance, totalBeforeGiftCard - 1))
    : 0;
  const total = Math.max(0, totalBeforeGiftCard - giftCardAmount);

  useEffect(() => {
    api.getLoyaltyBalance()
      .then((response) => setRewardsBalance(response.data.points_balance))
      .catch(() => {});
  }, []);

  const handleApplyGiftCard = async (e) => {
    e.preventDefault();
    if (!giftCardInput.trim()) return;
    setApplyingGiftCard(true);
    try {
      const { data } = await api.validateGiftCard(giftCardInput.trim());
      if (data.valid) {
        setAppliedGiftCard({ code: giftCardInput.trim().toUpperCase(), balance: data.balance });
        toast.success(`Gift card applied - ₹${data.balance.toFixed(0)} available`);
        setGiftCardInput('');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not apply gift card');
    } finally {
      setApplyingGiftCard(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e?.preventDefault();
    if (!selectedAddress) {
      toast.error('Please add or select a delivery address');
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

      const addressLine2 = selectedAddress.address_line2 ? `, ${selectedAddress.address_line2}` : '';
      const shipping_address = `${selectedAddress.full_name}, ${selectedAddress.phone} - ${selectedAddress.address_line1}${addressLine2}, ${selectedAddress.city}, ${selectedAddress.state} ${selectedAddress.postal_code}, ${selectedAddress.country}`;
      const response = await api.createOrder({
        shipping_address,
        payment_method: paymentMethod,
        coupon_code: couponCode || undefined,
        redeem_points: pointsToRedeem,
        gift_card_code: appliedGiftCard?.code || undefined,
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
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-2">Shipping Address</h2>
              <AddressBook selectable onSelect={setSelectedAddress} />

              <h2 className="text-xl font-semibold mb-2 pt-2">Payment Method</h2>
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

              {rewardsBalance > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useRewards}
                      onChange={(e) => {
                        setUseRewards(e.target.checked);
                        if (e.target.checked) setRedeemPoints(maxRedeemable);
                      }}
                      className="accent-brand w-4 h-4 mt-0.5"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 font-semibold text-ink text-sm">
                        <FiAward className="text-brand" /> Use Hills Rewards points
                      </span>
                      <span className="text-xs text-muted">
                        You have {rewardsBalance} points (₹{rewardsBalance} value)
                      </span>
                    </span>
                  </label>
                  {useRewards && maxRedeemable > 0 && (
                    <div className="mt-3 pl-7 flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max={maxRedeemable}
                        value={Math.min(redeemPoints, maxRedeemable)}
                        onChange={(e) => setRedeemPoints(parseInt(e.target.value, 10))}
                        className="flex-1 accent-brand"
                      />
                      <span className="text-sm font-bold text-ink whitespace-nowrap">
                        {pointsToRedeem} pts (-₹{pointsToRedeem})
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="flex items-center gap-1.5 font-semibold text-ink text-sm mb-2">
                  <FiGift className="text-brand" /> Have a Gift Card?
                </p>
                {appliedGiftCard ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
                    <span className="text-emerald-700 font-semibold text-sm">
                      {appliedGiftCard.code} - ₹{appliedGiftCard.balance.toFixed(0)} available
                    </span>
                    <button type="button" onClick={() => setAppliedGiftCard(null)} className="text-emerald-700 hover:text-emerald-900">
                      <FiX />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={giftCardInput}
                      onChange={(e) => setGiftCardInput(e.target.value)}
                      placeholder="Enter gift card code"
                      className="flex-1 border rounded-lg px-4 py-2 text-sm uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyGiftCard}
                      disabled={applyingGiftCard}
                      className="btn-secondary disabled:opacity-50"
                    >
                      {applyingGiftCard ? '...' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>

              <button type="button" onClick={handleCreateOrder} disabled={submitting || !selectedAddress} className="btn-primary w-full disabled:opacity-50">
                {submitting ? 'Please wait...' : 'Continue to Payment'}
              </button>
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
          {(couponCode || pointsToRedeem > 0 || giftCardAmount > 0) && (
            <div className="space-y-1 mb-2 pb-2 border-b">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {couponCode && (
                <div className="flex justify-between text-sm text-emerald-700 font-semibold">
                  <span>Coupon ({couponCode})</span>
                  <span>- ₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              {pointsToRedeem > 0 && (
                <div className="flex justify-between text-sm text-emerald-700 font-semibold">
                  <span>Hills Rewards ({pointsToRedeem} pts)</span>
                  <span>- ₹{pointsToRedeem.toFixed(2)}</span>
                </div>
              )}
              {giftCardAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-700 font-semibold">
                  <span>Gift Card ({appliedGiftCard.code})</span>
                  <span>- ₹{giftCardAmount.toFixed(2)}</span>
                </div>
              )}
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
