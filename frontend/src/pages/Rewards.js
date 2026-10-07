import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';
import { FiAward, FiArrowUpRight, FiArrowDownRight, FiGift } from 'react-icons/fi';

const REASON_LABELS = {
  signup_bonus: 'Welcome bonus',
  order_earned: 'Earned on delivered order',
  order_redeemed: 'Redeemed at checkout',
  order_redeemed_refund: 'Refunded (order cancelled)',
};

const Rewards = () => {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [balanceResponse, txResponse] = await Promise.all([
          api.getLoyaltyBalance(),
          api.getLoyaltyTransactions(),
        ]);
        setBalance(balanceResponse.data);
        setTransactions(txResponse.data);
      } catch (error) {
        toast.error('Failed to load Hills Rewards');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
