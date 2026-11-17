import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiSend } from 'react-icons/fi';
import api from '../api/axiosConfig';

/**
 * The message-by-message conversation for one support ticket, with a box
 * to send another message - the "chat with us" follow-up Myntra, Nykaa
 * and Ajio all let a customer send, instead of a ticket being stuck with
 * the single reply it started with. Used on the Help Center page, inside
 * the floating SupportChatWidget (both as `viewerType="customer"`), and
 * in the admin dashboard's Support tab (`viewerType="admin"`), so all
 * three never show a different version of the same conversation.
 */
const TicketThread = ({ ticketId, autoLoad = true, onThreadUpdate, viewerType = 'customer' }) => {
  const [messages, setMessages] = useState(null); // null = not fetched yet
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    api
      .getTicketThread(ticketId)
      .then((res) => {
        setMessages(res.data);
        if (onThreadUpdate) onThreadUpdate(res.data);
      })
      .catch(() => setMessages((prev) => prev || []));
  };

  useEffect(() => {
    if (autoLoad) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, autoLoad]);

  useEffect(() => {
    if (messages && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const { data } =
        viewerType === 'admin'
          ? await api.sendAdminTicketMessage(ticketId, text)
          : await api.sendTicketMessage(ticketId, text);
      setMessages(data);
      if (onThreadUpdate) onThreadUpdate(data);
      setDraft('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not send your message, please try again');
    } finally {
      setSending(false);
    }
  };

  if (messages === null) {
    return <p className="text-xs text-muted py-2">Loading conversation&hellip;</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {messages.map((m) => {
          const isMine = m.sender_type === viewerType;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isMine ? 'bg-brand text-white' : 'bg-surface text-ink'}`}>
                {m.sender_type === 'admin' && viewerType !== 'admin' && (
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-0.5">Mahabaleshwar Hills Hub</p>
                )}
                {m.sender_type === 'customer' && viewerType === 'admin' && (
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-0.5">Customer</p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-white/70' : 'text-muted'}`}>
                  {new Date(m.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          className="flex-1 border border-gray-300 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Send message"
          className="w-8 h-8 shrink-0 rounded-full bg-brand text-white flex items-center justify-center disabled:opacity-40"
        >
          <FiSend size={14} />
        </button>
      </form>
    </div>
  );
};

export default TicketThread;
