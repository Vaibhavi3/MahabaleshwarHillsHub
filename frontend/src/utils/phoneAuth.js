// Firebase Phone Auth: Google sends and checks the SMS OTP, then gives us an
// ID token that the backend verifies. The web config below is public by
// design (it identifies the Firebase project, it is not a secret).
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const phoneAuthEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let authPromise;
const getAuthModule = () => {
  if (!authPromise) {
    // Loaded on demand so the Firebase SDK isn't in every page's bundle.
    authPromise = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appMod, authMod]) => {
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
      return { auth: authMod.getAuth(app), authMod };
    });
  }
  return authPromise;
};

let verifier;

export const sendOtp = async (phoneE164, recaptchaContainerId) => {
  const { auth, authMod } = await getAuthModule();
  if (verifier) {
    verifier.clear();
    verifier = null;
  }
  verifier = new authMod.RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  return authMod.signInWithPhoneNumber(auth, phoneE164, verifier);
};

export const confirmOtp = async (confirmation, code) => {
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken();
};

export const otpErrorMessage = (error) => {
  const code = error?.code || '';
  if (code.includes('invalid-verification-code')) return 'Incorrect OTP. Please check and try again.';
  if (code.includes('code-expired')) return 'This OTP has expired. Please request a new one.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (code.includes('invalid-phone-number')) return 'Please enter a valid 10-digit mobile number.';
  if (code.includes('quota-exceeded')) return 'OTP service is busy right now. Please try again later.';
  return error?.response?.data?.detail || 'Could not verify your number. Please try again.';
};
