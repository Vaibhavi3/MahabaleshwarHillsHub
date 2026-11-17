import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiMessageCircle, FiX, FiChevronLeft, FiLifeBuoy } from 'react-icons/fi';
import api from '../api/axiosConfig';
import TicketThread from './TicketThread';

const UNREAD_POLL_MS = 60000;

const STATUS_STYLES = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

/**
 * A site-wide floating chat bubble, inspired by the always-available
 * "chat with us" widget Myntra, Nykaa and Ajio keep in the corner of
 * every page - closing the gap with this store's Help Center, which
 * previously only lived on its own full page and could never be
 * continued once the single admin reply came in. Backed by the same
 * real support_tickets data as the Help Center page (see
 * TicketThread.js, support.py); never a scripted or canned "agent"
 * reply, since this store has no live agents behind it.
 */
const SupportChatWidget = () => {
  const { user, token } = useSelector((state) => state.auth);
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState(null); // null = not fetched yet
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const refreshUnreadCount = useCallback(() => {
    if (!token) return;
    api
      .getSupportUnreadCount()
      .then((res) => setUnreadCount(res.data.unread_count))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      setTickets(null);
      setActiveTicketId(null);
      return undefined;
    }
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [token, refreshUnreadCount]);

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
    if (next && tickets === null) {
      api
        .getMyTickets()
        .then((res) => setTickets(res.data))
        .catch(() => setTickets([]));
    }
  };

  const handleThreadUpdate = () => {
    // A reply just got read/sent inside the thread - the badge no longer
    // applies to it, and sending can reopen a resolved ticket.
    refreshUnreadCount();
  };

  if (!user) return null;

  const activeTicket = tickets?.find((t) => t.id === activeTicketId) || null;

  return (
    <div ref={containerRef} className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40">
      {open && (
        <div className="absolute bottom-16 right-0 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col max-h-[28rem]">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-brand text-white rounded-t-lg">
            <div className="flex items-center gap-2 min-w-0">
              {activeTicket && (
                <button
                  type="button"
                  onClick={() => setActiveTicketId(null)}
                  aria-label="Back to your tickets"
                  className="shrink-0"
                >
                  <FiChevronLeft size={18} />
                </button>
              )}
              <p className="text-sm font-bold truncate">{activeTicket ? activeTicket.subject : 'Chat with us'}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              <FiX size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTicket ? (
              <div className="p-3">
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2 ${
                    STATUS_STYLES[activeTicket.status] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {STATUS_LABELS[activeTicket.status] || activeTicket.status}
                </span>
                <TicketThread ticketId={activeTicket.id} onThreadUpdate={handleThreadUpdate} />
              </div>
            ) : (
              <div className="p-3">
                {tickets === null ? (
                  <p className="text-sm text-muted text-center py-6">Loading&hellip;</p>
                ) : tickets.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">
                    You haven't raised any queries yet.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {tickets.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTicketId(t.id)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-surface border border-gray-100"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-ink truncate">{t.subject}</span>
                            <span
                              className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {STATUS_LABELS[t.status] || t.status}
                            </span>
                          </span>
                          <span className="block text-xs text-muted truncate mt-0.5">{t.message}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/help"
                  onClick={() => setOpen(false)}
                  className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-brand hover:underline py-2"
                >
                  <FiLifeBuoy size={14} /> Raise a new query
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label="Chat with us"
        className="relative w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-brand-dark transition-colors"
      >
        {open ? <FiX size={22} /> : <FiMessageCircle size={22} />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-ink text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default SupportChatWidget;
