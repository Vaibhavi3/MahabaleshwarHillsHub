// Lets any page (e.g. "Chat about this order" on My Orders, "Chat with
// us" on Help) open the globally-mounted ChatWidget and pre-fill a
// draft message, without prop-drilling through App.js.
export const OPEN_CHAT_WIDGET_EVENT = 'open-chat-widget';

export const openChatWidget = (prefill) => {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_WIDGET_EVENT, { detail: { prefill } }));
};
