'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Lock, X } from 'lucide-react';
import './auth-pages.css';

type View = 'login' | 'reset-email' | 'reset-otp' | 'reset-newpw' | 'reset-done';

function useMobileSignupEntryHref() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia('(max-width: 960px)');
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () => (window.matchMedia('(max-width: 960px)').matches ? '/signup/account-type' : '/signup'),
    () => '/signup',
  );
}

const PASSWORD_CHECKS = {
  length:    (p: string) => p.length >= 8,
  uppercase: (p: string) => /[A-Z]/.test(p),
  lowercase: (p: string) => /[a-z]/.test(p),
  number:    (p: string) => /\d/.test(p),
  special:   (p: string) => /[^A-Za-z0-9]/.test(p),
};

export default function LoginForm() {
  const router = useRouter();
  const signupHref = useMobileSignupEntryHref();

  // ── Login state ──────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Reset flow state ──────────────────────────────────────
  const [view, setView] = useState<View>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetResendIn, setResetResendIn] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Password strength (for reset new-password step) ──────
  const trimmedNew = newPassword.trim();
  const pwChecks = {
    length:    PASSWORD_CHECKS.length(trimmedNew),
    uppercase: PASSWORD_CHECKS.uppercase(trimmedNew),
    lowercase: PASSWORD_CHECKS.lowercase(trimmedNew),
    number:    PASSWORD_CHECKS.number(trimmedNew),
    special:   PASSWORD_CHECKS.special(trimmedNew),
  };
  const passedChecks = Object.values(pwChecks).filter(Boolean).length;
  const newPasswordOk = pwChecks.length;
  const newPasswordsMatch = newPassword.trim() === confirmNewPassword.trim();

  const maskedResetEmail = (() => {
    const at = resetEmail.indexOf('@');
    if (at <= 1) return resetEmail;
    const local = resetEmail.slice(0, at);
    const domain = resetEmail.slice(at);
    const visible = local.slice(0, 3);
    return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}${domain}`;
  })();

  // ── Resend countdown ──────────────────────────────────────
  function startResendCountdown() {
    setResetResendIn(59);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResetResendIn((s) => {
        if (s <= 1) {
          clearInterval(resendTimerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function goBackToLogin() {
    setView('login');
    setResetEmail('');
    setResetOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetError(null);
    setResetResendIn(0);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
  }

  // ── OTP digit helpers ─────────────────────────────────────
  function updateOtpDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = resetOtp.padEnd(6, ' ').split('');
    next[index] = digit || ' ';
    const compact = next.join('').replace(/\s+$/g, '');
    setResetOtp(compact);
    if (digit && index < 5) otpInputRefs.current[index + 1]?.focus();
  }

  // ── API calls ─────────────────────────────────────────────
  async function sendResetOtp(targetEmail: string): Promise<boolean> {
    setResetSending(true);
    setResetError(null);
    try {
      const res = await fetch('/api/auth/reset-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setResetError(data.message ?? 'Failed to send reset code. Try again.');
        return false;
      }
      startResendCountdown();
      return true;
    } catch {
      setResetError('Network error. Try again.');
      return false;
    } finally {
      setResetSending(false);
    }
  }

  async function handleSendResetCode() {
    const e = resetEmail.trim().toLowerCase();
    if (!e) { setResetError('Please enter your email address.'); return; }
    const sent = await sendResetOtp(e);
    if (sent) {
      setResetOtp('');
      setView('reset-otp');
    }
  }

  async function handleVerifyAndProceed() {
    const code = resetOtp.trim();
    if (!/^\d{6}$/.test(code)) {
      setResetError('Enter the 6-digit reset code.');
      return;
    }
    setResetError(null);
    setView('reset-newpw');
  }

  async function handleConfirmReset() {
    if (!newPasswordOk) {
      setResetError('Password must be at least 8 characters.');
      return;
    }
    if (!newPasswordsMatch) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetConfirming(true);
    setResetError(null);
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          code: resetOtp.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setResetError(data.message ?? 'Reset failed. Try again.');
        // Bad/expired code — send back to OTP step
        if (res.status === 400) setView('reset-otp');
        return;
      }
      setView('reset-done');
    } catch {
      setResetError('Network error. Try again.');
    } finally {
      setResetConfirming(false);
    }
  }

  // ── Normal login ──────────────────────────────────────────
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.message === 'string' ? data.message : 'Login failed');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="auth-login-page">
      <div className="auth-login-card">

        {/* ── LOGIN VIEW ─────────────────────────────────── */}
        {view === 'login' && (
          <>
            <h1>Welcome back</h1>
            <p>Sign in to your workspace.</p>
            {error && (
              <div className="auth-split__error" style={{ marginBottom: '1rem' }} role="alert">
                {error}
              </div>
            )}
            <form onSubmit={handleLoginSubmit} className="auth-fields" style={{ marginTop: 0 }}>
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <div className="auth-forgot-row">
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setResetEmail(email.trim());
                    setResetError(null);
                    setView('reset-email');
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={loading}
              >
                {loading ? <Loader2 className="auth-spin" size={18} /> : 'Sign in'}
              </button>
            </form>
            <p className="auth-split__footer" style={{ marginTop: '1.25rem' }}>
              Need an account?{' '}
              <Link href={signupHref} prefetch scroll>
                Create new account
              </Link>
            </p>
          </>
        )}

        {/* ── RESET — ENTER EMAIL ────────────────────────── */}
        {view === 'reset-email' && (
          <>
            <button type="button" className="auth-reset-back-btn" onClick={goBackToLogin}>
              <ArrowLeft size={15} aria-hidden /> Back to sign in
            </button>
            <h1>Forgot your password?</h1>
            <p>Enter your account email and we&apos;ll send a 6-digit reset code.</p>
            {resetError && (
              <div className="auth-split__error" style={{ marginBottom: '1rem' }} role="alert">
                {resetError}
              </div>
            )}
            <div className="auth-fields" style={{ marginTop: 0 }}>
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => { setResetEmail(e.target.value); setResetError(null); }}
                  placeholder="you@company.com"
                  autoFocus
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={resetSending || !resetEmail.trim()}
                onClick={handleSendResetCode}
              >
                {resetSending ? <><Loader2 className="auth-spin" size={16} /> Sending...</> : 'Send reset code'}
              </button>
            </div>
          </>
        )}

        {/* ── RESET — ENTER OTP ──────────────────────────── */}
        {view === 'reset-otp' && (
          <>
            <button type="button" className="auth-reset-back-btn" onClick={() => { setResetError(null); setView('reset-email'); }}>
              <ArrowLeft size={15} aria-hidden /> Back
            </button>
            <div className="auth-otp__hero-icon" aria-hidden>
              <svg viewBox="0 0 64 48" width="54" height="40" focusable="false" aria-hidden="true">
                <rect x="1.5" y="1.5" width="61" height="45" rx="10" fill="#16a34a" />
                <path d="M9.5 14.5L32 30.5L54.5 14.5" fill="none" stroke="#ecfdf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 16V34C10 36.2 11.8 38 14 38H50C52.2 38 54 36.2 54 34V16" fill="none" stroke="#f0fdf4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>Check your email</h1>
            <p>
              We sent a reset code to{' '}
              <span className="auth-otp__email-highlight">{maskedResetEmail}</span>
            </p>
            {resetError && (
              <div className="auth-split__error" style={{ marginBottom: '1rem' }} role="alert">
                {resetError}
              </div>
            )}
            <div className="auth-fields auth-otp" style={{ marginTop: '0.5rem' }}>
              <div
                className="auth-otp__digit-row"
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                  if (!pasted) return;
                  e.preventDefault();
                  setResetOtp(pasted);
                  otpInputRefs.current[Math.min(5, pasted.length)]?.focus();
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputRefs.current[i] = el; }}
                    className="auth-otp__digit"
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : undefined}
                    maxLength={1}
                    value={resetOtp[i] ?? ''}
                    onChange={(e) => { setResetError(null); updateOtpDigit(i, e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !(resetOtp[i] ?? '') && i > 0) otpInputRefs.current[i - 1]?.focus();
                      if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); otpInputRefs.current[i - 1]?.focus(); }
                      if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); otpInputRefs.current[i + 1]?.focus(); }
                    }}
                    aria-label={`Reset code digit ${i + 1}`}
                  />
                ))}
              </div>
              <p className="auth-otp__hint">
                Didn&apos;t receive a code?{' '}
                <button
                  type="button"
                  className="auth-otp__resend"
                  disabled={resetSending || resetResendIn > 0}
                  onClick={() => sendResetOtp(resetEmail.trim().toLowerCase())}
                >
                  {resetSending ? 'Sending...' : resetResendIn > 0 ? `Resend in 0:${String(resetResendIn).padStart(2, '0')}` : 'Resend code'}
                </button>
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={resetOtp.trim().length < 6}
                onClick={handleVerifyAndProceed}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* ── RESET — SET NEW PASSWORD ───────────────────── */}
        {view === 'reset-newpw' && (
          <>
            <button type="button" className="auth-reset-back-btn" onClick={() => { setResetError(null); setView('reset-otp'); }}>
              <ArrowLeft size={15} aria-hidden /> Back
            </button>
            <h1>Set new password</h1>
            <p>Choose a strong password for your account.</p>
            {resetError && (
              <div className="auth-split__error" style={{ marginBottom: '1rem' }} role="alert">
                {resetError}
              </div>
            )}
            <div className="auth-fields" style={{ marginTop: 0 }}>
              <label className="auth-field auth-field--password">
                <span><Lock size={14} aria-hidden /> New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onFocus={() => setNewPasswordFocused(true)}
                  onBlur={() => setNewPasswordFocused(false)}
                  onChange={(e) => { setResetError(null); setNewPassword(e.target.value); }}
                  placeholder="At least 8 characters"
                  autoFocus
                />
                {newPasswordFocused && trimmedNew.length > 0 && (
                  <div
                    className={`auth-password-meter auth-password-meter--${
                      passedChecks >= 5 ? 'strong' : passedChecks >= 3 ? 'medium' : 'weak'
                    }`}
                    role="status"
                    aria-live="polite"
                    style={{
                      '--meter-tooltip-x': passedChecks >= 5 ? '83.333%' : passedChecks >= 3 ? '50%' : '16.666%',
                      '--meter-fill': `${Math.round((passedChecks / 5) * 100)}%`,
                    } as React.CSSProperties}
                  >
                    <div className="auth-password-meter__bars" aria-hidden>
                      <span className="auth-password-meter__tooltip">
                        {passedChecks >= 5 ? 'Strong' : passedChecks >= 3 ? 'Medium' : 'Weak'}
                      </span>
                      <span className="auth-password-meter__track">
                        <span className="auth-password-meter__fill" />
                      </span>
                    </div>
                    <ul className="auth-password-meter__checks">
                      {(Object.entries(pwChecks) as [string, boolean][]).map(([key, passed]) => (
                        <li key={key} className={passed ? 'is-passed' : ''}>
                          {passed
                            ? <Check size={12} strokeWidth={3} aria-hidden />
                            : <X size={12} strokeWidth={3} aria-hidden />}{' '}
                          {key === 'length' ? 'At least 8 characters'
                            : key === 'uppercase' ? 'Uppercase letter (A-Z)'
                            : key === 'lowercase' ? 'Lowercase letter (a-z)'
                            : key === 'number' ? 'Number (0-9)'
                            : 'Special character (e.g. !@#$%)'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </label>
              <label className="auth-field">
                <span>Confirm new password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => { setResetError(null); setConfirmNewPassword(e.target.value); }}
                  placeholder="Repeat password"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={resetConfirming || !newPasswordOk || !newPasswordsMatch || !confirmNewPassword}
                onClick={handleConfirmReset}
              >
                {resetConfirming ? <><Loader2 className="auth-spin" size={16} /> Resetting...</> : 'Reset password'}
              </button>
            </div>
          </>
        )}

        {/* ── RESET — SUCCESS ────────────────────────────── */}
        {view === 'reset-done' && (
          <>
            <div className="auth-reset-success" aria-live="polite">
              <div className="auth-reset-success__icon" aria-hidden>
                <Check size={32} strokeWidth={2.8} />
              </div>
              <h1>Password updated!</h1>
              <p>Your password has been reset successfully. Sign in with your new password.</p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={() => {
                  setEmail(resetEmail);
                  setPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setResetOtp('');
                  setView('login');
                }}
              >
                Back to sign in
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
