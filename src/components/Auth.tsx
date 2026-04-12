import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, Mail, Phone, ArrowRight, Loader2, X, ChevronLeft, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthProps {
  onSuccess?: () => void;
}

type AuthMode = 'selection' | 'email-signin' | 'email-signup' | 'phone' | 'otp';

export const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('selection');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Phone state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    // Cleanup recaptcha on unmount
    return () => {
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setupRecaptcha();
    const appVerifier = (window as any).recaptchaVerifier;
    
    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setMode('otp');
    } catch (err: any) {
      setError(err.message);
      if (appVerifier) appVerifier.clear();
      (window as any).recaptchaVerifier = null;
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    setError(null);
    try {
      await confirmationResult.confirm(verificationCode);
      onSuccess?.();
    } catch (err: any) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderError = () => (
    <AnimatePresence>
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 flex items-start gap-2"
        >
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderSelection = () => (
    <div className="space-y-3">
      <button 
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex items-center justify-center gap-3 w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
        Continue with Google
      </button>

      <button 
        onClick={() => setMode('email-signin')}
        className="flex items-center justify-center gap-3 w-full bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg"
      >
        <Mail className="w-5 h-5" />
        Continue with Email
      </button>

      <button 
        onClick={() => setMode('phone')}
        className="flex items-center justify-center gap-3 w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
      >
        <Phone className="w-5 h-5" />
        Continue with Phone
      </button>
    </div>
  );

  const renderEmailForm = (isSignUp: boolean) => (
    <form onSubmit={isSignUp ? handleEmailSignUp : handleEmailSignIn} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button 
          type="button"
          onClick={() => setMode('selection')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-[#004275]">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
      </div>

      {renderError()}

      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
        <input 
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
          placeholder="name@example.com"
        />
      </div>

      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Password</label>
        <input 
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
          placeholder="••••••••"
        />
      </div>

      <button 
        type="submit"
        disabled={loading}
        className="w-full bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
        {!loading && <ArrowRight className="w-5 h-5" />}
      </button>

      <p className="text-center text-sm text-gray-500">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button 
          type="button"
          onClick={() => setMode(isSignUp ? 'email-signin' : 'email-signup')}
          className="text-[#004275] font-bold hover:underline"
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </form>
  );

  const renderPhoneForm = () => (
    <form onSubmit={handlePhoneSignIn} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button 
          type="button"
          onClick={() => setMode('selection')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-[#004275]">Phone Authentication</h2>
      </div>

      {renderError()}

      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Phone Number</label>
        <input 
          type="tel"
          required
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
          placeholder="+1 123 456 7890"
        />
        <p className="text-[10px] text-gray-400 mt-2">Include country code (e.g. +1 for USA)</p>
      </div>

      <div id="recaptcha-container"></div>

      <button 
        type="submit"
        disabled={loading}
        className="w-full bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Code'}
        {!loading && <ArrowRight className="w-5 h-5" />}
      </button>
    </form>
  );

  const renderOtpForm = () => (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button 
          type="button"
          onClick={() => setMode('phone')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-[#004275]">Verify Code</h2>
      </div>

      {renderError()}

      <div className="text-center mb-6">
        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-[#004275]" />
        </div>
        <p className="text-sm text-gray-600">
          We've sent a 6-digit verification code to <br />
          <span className="font-bold text-gray-900">{phoneNumber}</span>
        </p>
      </div>

      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 text-center">Verification Code</label>
        <input 
          type="text"
          required
          maxLength={6}
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center text-2xl font-black tracking-[0.5em] focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
          placeholder="000000"
        />
      </div>

      <button 
        type="submit"
        disabled={loading}
        className="w-full bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
      </button>

      <button 
        type="button"
        onClick={() => setMode('phone')}
        className="w-full text-sm text-gray-500 hover:text-[#004275] transition-colors"
      >
        Didn't receive a code? Try again
      </button>
    </form>
  );

  return (
    <div className="w-full">
      {mode === 'selection' && renderSelection()}
      {mode === 'email-signin' && renderEmailForm(false)}
      {mode === 'email-signup' && renderEmailForm(true)}
      {mode === 'phone' && renderPhoneForm()}
      {mode === 'otp' && renderOtpForm()}
    </div>
  );
};
