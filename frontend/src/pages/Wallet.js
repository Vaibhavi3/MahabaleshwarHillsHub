import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';
import { FiCreditCard, FiArrowUpRight, FiArrowDownRight, FiZap } from 'react-icons/fi';

const REASON_LABELS = {
  order_cancelled_refund: 'Instant refund (order cancelled)',
  return_completed_refund: 'Instant refund (return completed)',
  order_redeemed: 'Redeemed at checkout',
  order_cancelled_restore: 'Refunded (order cancelled)',
};

const Wallet = () => {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [balanceResponse, txResponse] = await Promise.all([
          api.getWalletBalance(),
          api.getWalletTransactions(),
        ]);
        setBalance(balanceResponse.data.balance);
        setTransactions(txResponse.data);
      } catch (error) {
        toast.error('Failed to load Hills Wallet');
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
        <FiCreditCard className="text-brand" size={26} />
        <h1 className="text-2xl font-extrabold text-ink">Hills Wallet</h1>
      </div>
      <p className="text-sm text-muted mb-8">
        Store credit from a cancelled order or a completed return - redeemable for real discounts at checkout, any
        time, no expiry.
      </p>

      <div className="bg-gradient-to-br from-brand to-brand-dark rounded-lg p-6 text-white mb-8">
        <p className="text-sm uppercase tracking-wide opacity-80 mb-1">Your balance</p>
        <p className="text-4xl font-extrabold mb-1">₹{balance.toFixed(2)}</p>
        <p className="text-sm opacity-90">Apply any amount up to this balance at checkout</p>
      </div>

      <div className="bg-surface rounded-lg p-4 flex gap-3 items-start mb-10">
        <FiZap className="text-brand shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-bold text-ink mb-1">Why choose Hills Wallet over a bank refund?</p>
          <p className="text-sm text-muted">
            When you cancel an order or a return is completed, you can choose instant Hills Wallet credit instead of
            waiting for your bank or card to process a refund. It lands here immediately and spends like cash on
            your next order.
          </p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-ink mb-4">Wallet history</h2>
      {transactions.length === 0 ? (
        <div className="text-center py-10 text-muted">
          <p className="mb-4">No wallet activity yet.</p>
          <Link to="/products" className="btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b border-gray-100 py-3">
              <div className="flex items-center gap-3">
                {tx.amount >= 0 ? (
                  <FiArrowUpRight className="text-emerald-600 shrink-0" />
                ) : (
                  <FiArrowDownRight className="text-red-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold text-ink">{REASON_LABELS[tx.reason] || tx.reason}</p>
                  <p className="text-xs text-muted">
                    {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {tx.amount >= 0 ? '+' : ''}₹{tx.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wallet;
