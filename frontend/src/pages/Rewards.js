import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';
import { FiAward, FiArrowUpRight, FiArrowDownRight, FiGift, FiCopy, FiCheck, FiUsers } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

const REASON_LABELS = {
  signup_bonus: 'Welcome bonus',
  order_earned: 'Earned on delivered order',
  order_redeemed: 'Redeemed at checkout',
  order_redeemed_refund: 'Refunded (order cancelled)',
  referral_welcome_bonus: 'Welcome bonus (referred by a friend)',
  referral_bonus: "Bonus - friend's first order delivered",
};

const Rewards = () => {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [referrals, setReferrals] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [balanceResponse, txResponse, referralsResponse] = await Promise.all([
          api.getLoyaltyBalance(),
          api.getLoyaltyTransactions(),
          api.getMyReferrals(),
        ]);
        setBalance(balanceResponse.data);
        setTransactions(txResponse.data);
        setReferrals(referralsResponse.data);
      } catch (error) {
        toast.error('Failed to load Hills Rewards');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const referralLink = referrals?.referral_code
    ? `${window.location.origin}/auth?ref=${referrals.referral_code}`
    : '';

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link - please copy it manually');
    }
  };

  const shareOnWhatsApp = () => {
    const text = `Shop handmade socks, slidders & bags at Mahabaleshwar Hills Hub! Use my code ${referrals.referral_code} when you sign up: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-muted">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <FiAward className="text-brand" size={26} />
        <h1 className="text-2xl font-extrabold text-ink">Hills Rewards</h1>
      </div>
      <p className="text-sm text-muted mb-8">
        Our thank-you for shopping handmade with us - points you earn on delivered orders, redeemable for real
        discounts at checkout.
      </p>

      <div className="bg-gradient-to-br from-brand to-brand-dark rounded-lg p-6 text-white mb-8">
        <p className="text-sm uppercase tracking-wide opacity-80 mb-1">Your balance</p>
        <p className="text-4xl font-extrabold mb-1">{balance.points_balance} pts</p>
        <p className="text-sm opacity-90">Worth ₹{balance.points_value_inr.toFixed(0)} off your next order</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-surface rounded-lg p-4 flex gap-3 items-start">
          <FiGift className="text-brand shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-ink mb-1">How you earn</p>
            <p className="text-sm text-muted">{balance.earn_rate_description}.</p>
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4 flex gap-3 items-start">
          <FiAward className="text-brand shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-ink mb-1">How you redeem</p>
            <p className="text-sm text-muted">{balance.redeem_rate_description}. Just choose how many to use at checkout.</p>
          </div>
        </div>
      </div>

      {referrals && (
        <div className="border border-brand/20 rounded-lg p-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <FiUsers className="text-brand" size={20} />
            <h2 className="text-lg font-bold text-ink">Invite & Earn</h2>
          </div>
          <p className="text-sm text-muted mb-5">
            Share your code - your friend gets {referrals.referee_bonus_points} bonus points the moment they sign
            up, and you get {referrals.referrer_bonus_points} points once their first order is delivered.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
            <div className="flex-1 bg-surface rounded-lg px-4 py-2.5 font-mono font-bold text-ink tracking-wide text-center sm:text-left">
              {referrals.referral_code}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyReferralLink}
                className="btn-secondary px-4 py-2.5 flex items-center gap-2 whitespace-nowrap"
              >
                {copied ? <FiCheck className="text-emerald-600" /> : <FiCopy />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <button
                onClick={shareOnWhatsApp}
                className="px-4 py-2.5 rounded bg-emerald-600 text-white font-bold text-sm uppercase tracking-wide flex items-center gap-2 whitespace-nowrap hover:bg-emerald-700"
              >
                <FaWhatsapp size={16} />
                Share
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5 text-center">
            <div className="bg-surface rounded-lg py-3">
              <p className="text-xl font-extrabold text-ink">{referrals.total_referrals}</p>
              <p className="text-xs text-muted uppercase tracking-wide">Invited</p>
            </div>
            <div className="bg-surface rounded-lg py-3">
              <p className="text-xl font-extrabold text-ink">{referrals.pending_referrals}</p>
              <p className="text-xs text-muted uppercase tracking-wide">Pending</p>
            </div>
            <div className="bg-surface rounded-lg py-3">
              <p className="text-xl font-extrabold text-ink">{referrals.points_earned_from_referrals}</p>
              <p className="text-xs text-muted uppercase tracking-wide">Points Earned</p>
            </div>
          </div>

          {referrals.referrals.length > 0 && (
            <div className="space-y-2">
              {referrals.referrals.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between border-t border-gray-100 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{ref.referred_name}</p>
                    <p className="text-xs text-muted">
                      Joined {new Date(ref.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {ref.status === 'completed' ? (
                    <span className="text-sm font-bold text-emerald-600">+{ref.reward_points} pts</span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-600 bg-amber-50 px-2.5 py-1 rounded">
                      Pending first order
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold text-ink mb-4">Points history</h2>
      {transactions.length === 0 ? (
        <div className="text-center py-10 text-muted">
          <p className="mb-4">No points activity yet.</p>
          <Link to="/products" className="btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b border-gray-100 py-3">
              <div className="flex items-center gap-3">
                {tx.points >= 0 ? (
                  <FiArrowUpRight className="text-emerald-600 shrink-0" />
                ) : (
                  <FiArrowDownRight className="text-red-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold text-ink">{REASON_LABELS[tx.reason] || tx.reason}</p>
                  <p className="text-xs text-muted">{new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <span className={`text-sm font-bold ${tx.points >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {tx.points >= 0 ? '+' : ''}{tx.points} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Rewards;
