import toast from 'react-hot-toast';

// Redirects a guest to login/register, preserving the current page so
// Auth.js can send them back here after they sign in. Returns whether the
// caller is authenticated and should proceed.
export const requireAuth = (token, navigate, location, message) => {
  if (token) return true;
  toast.error(message);
  navigate('/auth', { state: { from: location.pathname + location.search } });
  return false;
};
