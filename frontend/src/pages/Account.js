import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { FiUser, FiLock, FiPackage, FiMapPin, FiHeart, FiAward, FiGift } from 'react-icons/fi';
import api from '../api/axiosConfig';
import { updateUserInfo } from '../features/authSlice';

const QUICK_LINKS = [
  { to: '/orders', label: 'Orders', icon: FiPackage },
  { to: '/addresses', label: 'Addresses', icon: FiMapPin },
  { to: '/wishlist', label: 'Wishlist', icon: FiHeart },
  { to: '/rewards', label: 'Hills Rewards', icon: FiAward },
  { to: '/gift-cards', label: 'Gift Cards', icon: FiGift },
];

const Account = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((f) => ({ ...f, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((f) => ({ ...f, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.updateProfile(user.id, profileForm);
      dispatch(updateUserInfo(data));
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  const initials = `${(user.first_name || user.username || '?')[0]}${(user.last_name || '')[0] || ''}`.toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-brand text-white flex items-center justify-center text-xl font-extrabold shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-ink">
            {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username}
          </h1>
          <p className="text-sm text-muted">
            {user.email}
            {memberSince && <> · Member since {memberSince}</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-10">
        {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 bg-surface rounded-lg py-4 px-2 text-center hover:bg-brand-light/20 transition-colors"
          >
            <Icon className="text-brand" size={20} />
            <span className="text-xs font-semibold text-ink">{label}</span>
          </Link>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-5">
          <FiUser className="text-brand" size={18} />
          <h2 className="text-lg font-bold text-ink">Profile Information</h2>
        </div>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">First Name</label>
              <input
                name="first_name"
                value={profileForm.first_name}
                onChange={handleProfileChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Last Name</label>
              <input
                name="last_name"
                value={profileForm.last_name}
                onChange={handleProfileChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={profileForm.email}
                onChange={handleProfileChange}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Phone</label>
              <input
                name="phone"
                value={profileForm.phone}
                onChange={handleProfileChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button type="submit" disabled={savingProfile} className="btn-primary disabled:opacity-50">
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-5">
          <FiLock className="text-brand" size={18} />
          <h2 className="text-lg font-bold text-ink">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Current Password</label>
            <input
              type="password"
              name="current_password"
              value={passwordForm.current_password}
              onChange={handlePasswordChange}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm sm:max-w-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">New Password</label>
              <input
                type="password"
                name="new_password"
                value={passwordForm.new_password}
                onChange={handlePasswordChange}
                required
                minLength={8}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Confirm New Password</label>
              <input
                type="password"
                name="confirm_password"
                value={passwordForm.confirm_password}
                onChange={handlePasswordChange}
                required
                minLength={8}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button type="submit" disabled={savingPassword} className="btn-primary disabled:opacity-50">
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Account;
