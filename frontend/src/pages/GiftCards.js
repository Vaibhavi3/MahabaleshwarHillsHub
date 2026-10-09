import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useSelector } from 'react-redux';
import api from '../api/axiosConfig';
import { requireAuth } from '../utils/requireAuth';
import { FiGift, FiCopy, FiCheck, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';

const PRESET_AMOUNTS = [500, 1000, 1500, 2000];
const MIN_AMOUNT = 200;
const MAX_AMOUNT = 5000;

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY || '');

const StripePayForm = ({ giftCard, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      const { data } = await api.createGiftCardPaymentIntent(giftCard.id);
      const result = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (result.error) throw new Error(result.error.message);
      const confirmed = await api.confirmGiftCardStripePayment(giftCard.id, result.paymentIntent.id);
      onSuccess(confirmed.data);
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
        {processing ? 'Processing...' : `Pay ₹${giftCard.initial_value.toFixed(2)}`}
      </button>
    </div>
  );
};

const RazorpayPayButton = ({ giftCard, onSuccess }) => {
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    setProcessing(true);
    try {
      const { data } = await api.createGiftCardRazorpayOrder(giftCard.id);
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: 'Mahabaleshwar Hills Hub Gift Card',
          order_id: data.razorpay_order_id,
          handler: async (response) => {
            try {
              const confirmed = await api.verifyGiftCardRazorpayPayment(giftCard.id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              onSuccess(confirmed.data);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          theme: { color: '#ff3f6c' },
        });
        rzp.on('payment.failed', () => reject(new Error('Payment failed')));
        rzp.open();
      });
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <button onClick={handlePay} disabled={processing} className="btn-primary w-full disabled:opacity-50">
      {processing ? 'Processing...' : `Pay ₹${giftCard.initial_value.toFixed(2)} with Razorpay`}
    </button>
  );
};

const GiftCardRow = ({ card }) => {
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(card.code);
      setCopied(true);
      toast.success('Code copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy - please copy it manually');
    }
  };

  return (
    <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 gap-4">
      <div className="min-w-0">
        <p className="font-mono font-bold text-ink tracking-wide text-sm">{card.code}</p>
        <p className="text-xs text-muted truncate">
          For {card.recipient_name} &middot; {new Date(card.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-ink">₹{card.balance.toFixed(0)}</p>
        <p className="text-xs text-muted">of ₹{card.initial_value.toFixed(0)}</p>
      </div>
      <button onClick={copyCode} className="shrink-0 text-muted hover:text-brand" title="Copy code">
        {copied ? <FiCheck className="text-emerald-600" /> : <FiCopy />}
      </button>
    </div>
  );
};

const GiftCards = () => {
  const { user, token } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const [amount, setAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [pendingCard, setPendingCard] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

  const effectiveAmount = customAmount ? parseInt(customAmount, 10) || 0 : amount;

  useEffect(() => {
    if (!user) {
      setLoadingCards(false);
      return;
    }
    api
      .getMyGiftCards()
      .then((res) => setMyCards(res.data))
      .catch(() => {})
      .finally(() => setLoadingCards(false));
  }, [user]);

  const handleStartPurchase = async (e) => {
    e.preventDefault();
    if (!requireAuth(token, navigate, location, 'Please login to send a gift card')) return;
    if (effectiveAmount < MIN_AMOUNT || effectiveAmount > MAX_AMOUNT) {
      toast.error(`Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}`);
      return;
    }
    if (!recipientName.trim() || !recipientEmail.trim()) {
      toast.error('Please enter who this gift card is for');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.purchaseGiftCard({
        amount: effectiveAmount,
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim(),
        sender_name: senderName.trim() || undefined,
        message: message.trim() || undefined,
      });
      setPendingCard(data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not start gift card purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = (card) => {
    setPurchasedCard(card);
    setMyCards((prev) => [card, ...prev]);
    setPendingCard(null);
    toast.success('Gift card sent!');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <FiGift className="text-brand" size={26} />
        <h1 className="text-2xl font-extrabold text-ink">Gift Cards</h1>
      </div>
      <p className="text-sm text-muted mb-8">
        Send a handmade-goods gift card to someone you love. It's delivered by email, and any balance left
        over after an order stays on the card for next time.
      </p>

      {purchasedCard ? (
        <div className="bg-gradient-to-br from-brand to-brand-dark rounded-lg p-6 text-white mb-10">
          <p className="text-sm uppercase tracking-wide opacity-80 mb-1">Sent to {purchasedCard.recipient_name}</p>
          <p className="text-3xl font-extrabold mb-2 font-mono tracking-wide">{purchasedCard.code}</p>
          <p className="text-sm opacity-90">
            We've emailed this ₹{purchasedCard.initial_value.toFixed(0)} code to {purchasedCard.recipient_email}.
            It can be redeemed at checkout.
          </p>
          <button onClick={() => setPurchasedCard(null)} className="mt-4 bg-white text-brand font-bold uppercase text-sm tracking-wide px-6 py-2.5 rounded">
            Send Another
          </button>
        </div>
      ) : pendingCard ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-10">
          <h2 className="text-lg font-bold text-ink mb-1">Pay for this gift card</h2>
          <p className="text-sm text-muted mb-5">
            ₹{pendingCard.initial_value.toFixed(0)} for {pendingCard.recipient_name}
          </p>
          <div className="flex gap-6 mb-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} />
              Razorpay (UPI / Cards)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} />
              Stripe (International Cards)
            </label>
          </div>
          {paymentMethod === 'razorpay' ? (
            <RazorpayPayButton giftCard={pendingCard} onSuccess={handlePaymentSuccess} />
          ) : (
            <Elements stripe={stripePromise}>
              <StripePayForm giftCard={pendingCard} onSuccess={handlePaymentSuccess} />
            </Elements>
          )}
          <button onClick={() => setPendingCard(null)} className="btn-secondary w-full mt-3">
            Back
          </button>
        </div>
      ) : (
        <form onSubmit={handleStartPurchase} className="bg-white border border-gray-200 rounded-lg p-6 mb-10 space-y-5">
          <div>
            <p className="text-sm font-bold text-ink uppercase mb-3">Choose an amount</p>
            <div className="flex flex-wrap gap-3 mb-3">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`px-5 py-2.5 rounded-lg border-2 font-bold text-sm ${
                    !customAmount && amount === amt ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-ink hover:border-gray-300'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`Or enter a custom amount (₹${MIN_AMOUNT} - ₹${MAX_AMOUNT})`}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full sm:w-72"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-ink uppercase block mb-1.5">Recipient's Name</label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full"
                placeholder="Who is this for?"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-ink uppercase block mb-1.5">Recipient's Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full"
                placeholder="where to send the code"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-ink uppercase block mb-1.5">Your Name (optional)</label>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full sm:w-72"
              placeholder={user?.username || 'From'}
            />
          </div>

          <div>
            <label className="text-sm font-bold text-ink uppercase block mb-1.5">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full"
              placeholder="Add a personal note"
            />
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted">
            <FiShield className="text-brand shrink-0" /> Paid securely via Stripe or Razorpay. Non-refundable once paid.
          </p>

          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
            {submitting ? 'Please wait...' : `Continue to Pay ₹${effectiveAmount || 0}`}
          </button>
        </form>
      )}

      {user && (
        <>
          <h2 className="text-lg font-bold text-ink mb-4">Gift Cards You've Sent</h2>
          {loadingCards ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : myCards.length === 0 ? (
            <p className="text-sm text-muted">You haven't sent a gift card yet.</p>
          ) : (
            <div className="space-y-2">
              {myCards.map((card) => (
                <GiftCardRow key={card.id} card={card} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GiftCards;
