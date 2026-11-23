import React, { useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon, X } from 'lucide-react';
import { auth, db, googleProvider } from '../lib/firebase';
import { useApp } from '../context/AppContext';

export function AuthModal() {
  const {
    showAuthModal,
    setShowAuthModal,
    authModalMode,
    setAuthModalMode,
    guestPrefs,
    lang,
    theme,
    pushToast,
    setShowOnboarding,
  } = useApp();

  const [view, setView] = useState<'signin' | 'signup' | 'reset'>(authModalMode);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarData, setAvatarData] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  React.useEffect(() => {
    setView(authModalMode);
    setErrorMsg('');
    setInfoMsg('');
  }, [authModalMode, showAuthModal]);

  if (!showAuthModal) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      setErrorMsg('Please choose an avatar image smaller than 400KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarData(reader.result.slice(0, 500));
      }
    };
    reader.readAsDataURL(file);
  };

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Incorrect email or password. Please verify your credentials.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not enabled yet in your Firebase Console (Authentication > Sign-in method). Use Google Sign-In now, or enable Email/Password in Firebase Console.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google Sign-In popup was closed before completing.';
    }
    return err?.message || 'Authentication failed. Please try again.';
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithPopup(auth, googleProvider);
      setShowAuthModal(false);
      pushToast('Signed in with Google', 'success');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setShowAuthModal(false);
      pushToast('Welcome back to STR SCORES!', 'success');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanUser = username.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (cleanUser.length < 2 || cleanUser.length > 32) {
      setErrorMsg('Username must be 2–32 characters (letters, numbers, underscores).');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg('Please accept the Terms of Service and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, {
        displayName: fullName.trim(),
      });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        username: cleanUser,
        displayName: fullName.trim().slice(0, 64),
        avatarUrl: avatarData || '',
        bio: 'STR SCORES Supporter',
        favoriteTeams: guestPrefs.favoriteTeams,
        favoriteNationalTeams: guestPrefs.favoriteNationalTeams,
        favoriteLeagues: guestPrefs.favoriteLeagues,
        favoritePlayers: guestPrefs.favoritePlayers,
        favoriteCountry: guestPrefs.favoriteCountry,
        favoriteCity: guestPrefs.favoriteCity,
        favoritePosition: guestPrefs.favoritePosition,
        points: 100,
        achievements: ['First Kickoff'],
        online: true,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', cred.user.uid, 'private', 'info'), {
        uid: cred.user.uid,
        email: email.trim(),
        language: lang,
        theme,
        notifGoals: true,
        notifKickoff: true,
        notifFinal: true,
        notifRedCards: true,
        notifNews: true,
        notifFriends: true,
        notifGroups: true,
        notifQuiz: true,
        blockedUids: [],
        updatedAt: serverTimestamp(),
      });
      await sendEmailVerification(cred.user).catch(() => {});
      setShowAuthModal(false);
      setShowOnboarding(true);
      pushToast('Account created! Check your inbox for the verification email.', 'success');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    if (!email.trim()) {
      setErrorMsg('Enter your account email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg('Password reset instructions have been sent to your email.');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/str_scores_logo_1795349596176.jpg"
              alt="STR SCORES"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {view === 'signin'
                ? 'Sign In to STR SCORES'
                : view === 'signup'
                ? 'Create Supporter Account'
                : 'Reset Password'}
            </h2>
          </div>
          <button
            onClick={() => setShowAuthModal(false)}
            aria-label="Close modal"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#E11D48] text-xs leading-relaxed">
              {infoMsg}
            </div>
          )}

          {view !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-sm flex items-center justify-center gap-3 transition disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.4 1.8 14.9 1 12 1 7.4 1 3.4 3.6 1.5 7.4l3.7 2.8C6.1 7.3 8.8 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.2 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.5 7.4C.5 9.3 0 11.4 0 13.5s.5 4.2 1.5 6.1l3.7-2.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.2 0-5.9-2.2-6.8-5.1l-3.7 2.8C3.4 21.4 7.4 24 12 24z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span>or with email</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            </>
          )}

          {view === 'signin' && (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded accent-[#E11D48]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setView('reset')}
                  className="text-[#00C853] dark:text-[#E11D48] font-medium hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#E11D48] text-white font-bold text-sm hover:brightness-105 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>

              <p className="text-center text-xs text-slate-500">
                New to STR SCORES?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('signup');
                    setAuthModalMode('signup');
                  }}
                  className="text-[#00C853] dark:text-[#E11D48] font-semibold hover:underline"
                >
                  Create Account
                </button>
              </p>
            </form>
          )}

          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Haddad"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alex_10"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Confirm
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <label className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="mr-1.5 accent-[#E11D48]"
                  />
                  Show passwords
                </label>
                <label className="cursor-pointer text-[#00C853] dark:text-[#E11D48] font-medium">
                  Upload Photo (optional)
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded accent-[#E11D48]"
                />
                <span>
                  I accept the STR SCORES Terms of Service and Privacy Policy (no gambling, verified fair play).
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#E11D48] text-white font-bold text-sm hover:brightness-105 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account & Send Verification
              </button>

              <p className="text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('signin');
                    setAuthModalMode('signin');
                  }}
                  className="text-[#00C853] dark:text-[#E11D48] font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            </form>
          )}

          {view === 'reset' && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter your registered email address and we will send you a password reset link.
              </p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[#E11D48]"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#E11D48] text-white font-bold text-sm hover:brightness-105 transition flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>
              <button
                type="button"
                onClick={() => setView('signin')}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
