import React, { useEffect, useState } from 'react';
import api from '../api/axiosConfig';
import { sendOtp, confirmOtp, otpErrorMessage } from '../utils/phoneAuth';
import toast from 'react-hot-toast';

const RESEND_SECONDS = 30;

// Mobile number -> OTP -> (first time only) name/email, then onLoggedIn(user, token).
const PhoneOtpLogin = ({ onLoggedIn, referralCode = '' }) => {
  const [step, setStep] = useState('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [idToken, setIdToken] = useState('');
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '', referral_code: referralCode });
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestOtp = async (e) => {
    e?.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    try {
      const result = await sendOtp(`+91${mobile}`, 'otp-recaptcha');
      setConfirmation(result);
      setOtp('');
      setStep('otp');
      setResendIn(RESEND_SECONDS);
      toast.success(`OTP sent to +91 ${mobile}`);
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      toast.error('Please enter the 6-digit OTP.');
      return;
    }
    setBusy(true);
    try {
      const token = await confirmOtp(confirmation, otp);
      const { data } = await api.phoneVerify(token);
      if (data.new_user) {
        setIdToken(token);
        setStep('profile');
      } else {
        onLoggedIn(data.user, data.access_token, false);
      }
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.phoneRegister({
        id_token: idToken,
        first_name: profile.first_name,
        last_name: profile.last_name || undefined,
        email: profile.email || undefined,
        referral_code: profile.referral_code.trim() || undefined,
      });
      onLoggedIn(data.user, data.access_token, true);
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div id="otp-recaptcha" />

      {step === 'phone' && (
        <form onSubmit={requestOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Mobile Number</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 border border-r-0 rounded-l-lg bg-surface text-ink text-sm">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile number"
                required
                className="w-full border rounded-r-lg px-4 py-2"
              />
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
            {busy ? 'Sending OTP...' : 'Get OTP'}
          </button>
          <p className="text-xs text-muted text-center">We'll send a 6-digit code by SMS. New here? Your account is created after you verify.</p>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyOtp} className="space-y-4">
          <p className="text-sm text-ink">
            Enter the OTP sent to <span className="font-bold">+91 {mobile}</span>{' '}
            <button type="button" onClick={() => setStep('phone')} className="text-brand text-xs font-bold hover:underline">
              Change
            </button>
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="------"
            autoFocus
            required
            className="w-full border rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em]"
          />
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
            {busy ? 'Verifying...' : 'Verify & Continue'}
          </button>
          <p className="text-xs text-center text-muted">
            {resendIn > 0 ? (
              `Resend OTP in ${resendIn}s`
            ) : (
              <button type="button" onClick={requestOtp} disabled={busy} className="text-brand font-bold hover:underline">
                Resend OTP
              </button>
            )}
          </p>
        </form>
      )}

      {step === 'profile' && (
        <form onSubmit={createAccount} className="space-y-4">
          <p className="text-sm text-ink">Number verified. Just tell us your name to finish creating your account.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                value={profile.first_name}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                required
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                value={profile.last_name}
                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email (optional, for order updates)</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Referral Code (optional)</label>
            <input
              value={profile.referral_code}
              onChange={(e) => setProfile({ ...profile, referral_code: e.target.value.toUpperCase() })}
              className="w-full border rounded-lg px-4 py-2 uppercase"
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
            {busy ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}
    </div>
  );
};

export default PhoneOtpLogin;
