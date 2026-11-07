import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axiosConfig';
import {
  FiBell,
  FiPackage,
  FiAward,
  FiGift,
  FiRefreshCw,
  FiMessageSquare,
  FiTag,
} from 'react-icons/fi';

const UNREAD_POLL_MS = 60000;

const TYPE_ICON = {
  order_status: FiPackage,
  loyalty_points: FiAward,
  referral: FiGift,
  return_request: FiRefreshCw,
  support_ticket: FiMessageSquare,
  back_in_stock: FiBell,
  price_drop: FiTag,
};

const timeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// The header bell's feed - order status, price-drop, back-in-stock,
// return/support and loyalty-points updates, matching the notification
// inbox Myntra/Nykaa/Ajio all show. This is often the FIRST place a
// customer actually sees these updates: several of the flows behind it
// (price-drop, back-in-stock, support replies) already emailed on this
// same event, but only land if SMTP_* happens to be configured on this
// deployment - this feed never depends on that.
const NotificationBell = () => {
  const { user } = useSelector((state) => state.auth);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(null); // null = not fetched yet
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const refreshUnreadCount = useCallback(() => {
    if (!user) return;
    api
      .getUnreadNotificationCount()
      .then((res) => setUnreadCount(res.data.unread_count))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications(null);
      return undefined;
    }
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && notifications === null) {
      api
        .getNotifications()
        .then((res) => setNotifications(res.data))
        .catch(() => setNotifications([]));
    }
  };

  const handleSelect = (notification) => {
    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      api.markNotificationRead(notification.id).catch(() => {});
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    if (unreadCount === 0) return;
    setNotifications((prev) => (prev ? prev.map((n) => ({ ...n, is_read: true })) : prev));
    setUnreadCount(0);
    api.markAllNotificationsRead().catch(() => {});
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex flex-col items-center text-ink hover:text-brand transition-colors"
      >
        <FiBell className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-2.5 bg-brand text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className="text-[11px] font-semibold uppercase mt-0.5">Updates</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded shadow-lg z-50 max-h-[26rem] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
            <p className="text-sm font-bold text-ink uppercase">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications === null ? (
            <p className="px-4 py-6 text-sm text-muted text-center">Loading&hellip;</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">
              No notifications yet - updates on your orders, offers and wishlist will show up here.
            </p>
          ) : (
            <ul>
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] || FiBell;
                return (
                  <li key={n.id} className="border-b border-gray-50 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => handleSelect(n)}
                      className={`flex items-start gap-3 w-full text-left px-4 py-3 hover:bg-surface ${
                        !n.is_read ? 'bg-brand-light/10' : ''
                      }`}
                    >
                      <span className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand shrink-0 mt-0.5">
                        <Icon size={15} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-sm leading-snug ${
                            !n.is_read ? 'font-bold text-ink' : 'text-ink'
                          }`}
                        >
                          {n.title}
                        </span>
                        {n.body && <span className="block text-xs text-muted mt-0.5">{n.body}</span>}
                        <span className="block text-xs text-muted mt-1">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
