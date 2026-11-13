import React, { useEffect, useState } from 'react';
import { FiShare2, FiCopy, FiCheck } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';

/**
 * Lets a signed-in shopper turn their wishlist into a public, read-only
 * link they can send to family/friends - matching Myntra/Nykaa/Ajio's
 * "share your wishlist" (handy around Diwali/birthday gifting, when
 * someone wants to point a relative at exactly what to pick). Off by
 * default: nothing is shared until the shopper explicitly flips this on.
 */
const ShareWishlistCard = () => {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getWishlistShareStatus()
      .then(({ data }) => {
        setEnabled(data.enabled);
        setToken(data.token);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shareUrl = token ? `${window.location.origin}/wishlist/shared/${token}` : null;

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        const { data } = await api.disableWishlistShare();
        setEnabled(data.enabled);
        setToken(data.token);
        toast.success('Your wishlist link has been turned off');
      } else {
        const { data } = await api.enableWishlistShare();
        setEnabled(data.enabled);
        setToken(data.token);
        toast.success('Your wishlist link is live');
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Could not copy the link');
    }
  };

  if (loading) return null;

  return (
    <div className="bg-surface border border-gray-200 rounded px-4 py-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 flex-1">
        <FiShare2 className="text-brand mt-0.5 shrink-0" size={20} />
        <div>
          <p className="text-sm font-bold text-ink">Share your wishlist</p>
          <p className="text-xs text-muted mt-0.5">
            Turn on a link so family or friends can see what you've saved - handy for gifting.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            disabled={busy}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-brand transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
        </label>
        <span className="text-xs font-semibold text-ink w-10">{enabled ? 'On' : 'Off'}</span>
      </div>

      {enabled && shareUrl && (
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
            className="flex-1 sm:w-56 text-xs text-muted bg-white border border-gray-300 rounded px-2 py-1.5 truncate"
          />
          <button
            onClick={handleCopy}
            title="Copy link"
            className="p-2 border border-gray-300 rounded text-ink hover:border-ink transition-colors"
          >
            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Here's my Mahabaleshwar Hills Hub wishlist: ${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Share via WhatsApp"
            className="p-2 border border-gray-300 rounded text-green-600 hover:border-green-600 transition-colors"
          >
            <FaWhatsapp size={14} />
          </a>
        </div>
      )}
    </div>
  );
};

export default ShareWishlistCard;
