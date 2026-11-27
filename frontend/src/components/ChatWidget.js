import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi';
import api from '../api/axiosConfig';
import { requireAuth } from '../utils/requireAuth';
import { OPEN_CHAT_WIDGET_EVENT } from '../utils/chatWidget';

const POLL_CLOSED_MS = 30000;
const POLL_OPEN_MS = 6000;

const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// A floating "Chat with us" button, matching Myntra's 24x7 in-app live
// chat and AJIO's chat support launched from the Order Details Page -
// a faster, synchronous alternative to the Help Center's support-ticket
// form. Mounted once in App.js so it follows the shopper across pages,
// the same way the cart drawer does.
const ChatWidget = () => {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef(null);

  const refreshUnreadCount = useCallback(() => {
    if (!user) return;
    api
      .getMyChatUnreadCount()
      .then((res) => setUnreadCount(res.data.unread_count))
      .catch(() => {});
  }, [user]);

  const refreshMessages = useCallback(() => {
    if (!user) return;
    api
      .getMyChatMessages()
      .then((res) => {
        setMessages(res.data);
        setLoaded(true);
        setUnreadCount(0);
      })
      .catch(() => {});
  }, [user]);

  // Badge on the closed button - polled at a slower cadence than the
  // open panel's near-live refresh.
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return undefined;
    }
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_CLOSED_MS);
    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  // While the panel is open, poll faster so an admin reply shows up
  // without the shopper having to close and reopen it.
  useEffect(() => {
    if (!open || !user) return undefined;
    refreshMessages();
    const interval = setInterval(refreshMessages, POLL_OPEN_MS);
    return () => clearInterval(interval);
  }, [open, user, refreshMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  const openWithPrefill = useCallback(
    (prefill) => {
      if (!requireAuth(token, navigate, location, 'Please login to chat with us')) return;
      setOpen(true);
      if (prefill) setDraft((prev) => (prev ? prev : prefill));
    },
    [token, navigate, location]
  );

  // Lets other pages (Orders.js' "Chat about this order", Help.js'
  // "Chat with us" button, and the notification bell's chat-reply link)
  // open this same widget instead of each building their own.
  useEffect(() => {
    const handler = (e) => openWithPrefill(e.detail?.prefill);
    window.addEventListener(OPEN_CHAT_WIDGET_EVENT, handler);
    return () => window.removeEventListener(OPEN_CHAT_WIDGET_EVENT, handler);
  }, [openWithPrefill]);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    openWithPrefill();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { data } = await api.sendChatMessage(body);
      setMessages((prev) => [...prev, data]);
      setDraft('');
    } catch {
      // best-effort UI - the compose box keeps the draft so nothing is lost
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40">
      {open && (
        <div className="mb-3 w-[90vw] max-w-sm bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col h-[28rem] overflow-hidden">
          <div className="bg-ink text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <p className="text-sm font-bold">Chat with us</p>
              <p className="text-xs text-gray-300">Mahabaleshwar Hills Hub</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              <FiX size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-surface">
            {!loaded ? (
              <p className="text-xs text-muted text-center mt-6">Loading&hellip;</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted text-center mt-6">
                Questions about an order, a product, or anything else - send us a message and
                we'll reply here.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.sender === 'customer'
                        ? 'bg-brand text-white rounded-br-none'
                        : 'bg-white text-ink border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        m.sender === 'customer' ? 'text-white/70' : 'text-muted'
                      }`}
                    >
                      {timeLabel(m.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-gray-200 p-2 flex items-end gap-2 shrink-0">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type a message..."
              rows={1}
              maxLength={2000}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm resize-none max-h-24"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="btn-primary px-3 py-2 disabled:opacity-50"
            >
              <FiSend size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        className="relative w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-brand-dark transition-colors"
      >
        {open ? <FiX size={22} /> : <FiMessageCircle size={22} />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-ink text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
