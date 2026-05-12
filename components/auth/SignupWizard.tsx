'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CircleX,
  Check,
  ContactRound,
  FileText,
  ImageIcon,
  Loader2,
  Lock,
  Mail,
  Phone,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { isValidEmail } from '@/lib/auth/email';
import './auth-pages.css';
import '../dashboard/AlertPushDock.css';

type Account = 'SOLO' | 'TEAM';
const NAME_PARTIAL_RE = /^[A-Za-z\s'-]*$/;
const NAME_FULL_RE = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const INVALID_EMAIL_ERROR = 'Please enter a valid email address.';
const PASSWORD_MISMATCH_ERROR = 'Passwords do not match.';
const INVALID_BUSINESS_EMAIL_ERROR = 'Please enter a valid business email address.';

export default function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<Account | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessLocation, setBusinessLocation] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResendIn, setOtpResendIn] = useState(0);
  const [otpVerifiedFor, setOtpVerifiedFor] = useState<string | null>(null);
  const [showOtpSuccessToast, setShowOtpSuccessToast] = useState(false);
  const [otpSuccessToastLeaving, setOtpSuccessToastLeaving] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [uploadLoadedBytes, setUploadLoadedBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [isPreparingLogo, setIsPreparingLogo] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isLogoUploaded, setIsLogoUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const logoReadSeq = useRef(0);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const otpToastDismissTimer = useRef<number | null>(null);
  const otpToastRemoveTimer = useRef<number | null>(null);

  const steps = [
    { id: 1, label: 'Account type' },
    { id: 2, label: 'Personal info' },
    { id: 3, label: 'Verify email' },
    { id: 4, label: 'Business info' },
  ] as const;

  const canStep2 = accountType !== null;
  const emailTrimmed = email.trim();
  const emailOk = isValidEmail(emailTrimmed);
  const firstNameTrimmed = firstName.trim();
  const lastNameTrimmed = lastName.trim();
  const firstNameOk = NAME_FULL_RE.test(firstNameTrimmed);
  const lastNameOk = NAME_FULL_RE.test(lastNameTrimmed);
  const trimmedPassword = password.trim();
  const passwordChecks = {
    length: trimmedPassword.length >= 8,
    uppercase: /[A-Z]/.test(trimmedPassword),
    lowercase: /[a-z]/.test(trimmedPassword),
    number: /\d/.test(trimmedPassword),
    special: /[^A-Za-z0-9]/.test(trimmedPassword),
  };
  const passedPasswordChecks = Object.values(passwordChecks).filter(Boolean).length;
  const passwordOk = passwordChecks.length;
  const passwordsMatch = password.trim() === confirmPassword.trim();
  const passwordStrengthLevel =
    passedPasswordChecks === 0 ? 0 : passedPasswordChecks >= 5 ? 3 : passedPasswordChecks >= 3 ? 2 : 1;
  const passwordStrengthLabel =
    passwordStrengthLevel >= 3 ? 'Strong' : passwordStrengthLevel === 2 ? 'Medium' : 'Weak';
  const passwordStrengthDisplayLevel = passwordStrengthLevel === 0 ? 1 : passwordStrengthLevel;
  const passwordStrengthTone =
    passwordStrengthDisplayLevel >= 3
      ? 'strong'
      : passwordStrengthDisplayLevel === 2
        ? 'medium'
        : 'weak';
  const meterTooltipX =
    passwordStrengthDisplayLevel >= 3
      ? '83.333%'
      : passwordStrengthDisplayLevel === 2
        ? '50%'
        : '16.666%';
  const meterFillPercent = `${Math.round((passedPasswordChecks / 5) * 100)}%`;
  const showPasswordMeter = step === 2 && passwordFocused;
  const canStep3 =
    Boolean(
      firstNameTrimmed &&
        lastNameTrimmed &&
        firstNameOk &&
        lastNameOk &&
        emailTrimmed &&
        emailOk &&
        passwordOk &&
        passwordsMatch,
    );
  const businessPhoneTrimmed = businessPhone.trim();
  const businessEmailTrimmed = businessEmail.trim().toLowerCase();
  const businessEmailOk =
    businessEmailTrimmed.length === 0 ? true : isValidEmail(businessEmailTrimmed);
  const hasAnyStep2Input =
    Boolean(
      firstName.trim() ||
        lastName.trim() ||
        phone.trim() ||
        email.trim() ||
        password.trim() ||
        confirmPassword.trim(),
    );
  const clearError = () => {
    setError(null);
    setShowError(false);
  };
  const uploadProgress =
    uploadTotalBytes > 0
      ? Math.max(0, Math.min(100, Math.round((uploadLoadedBytes / uploadTotalBytes) * 100)))
      : 0;

  const formatUploadSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  async function submitSignupFormData(fd: FormData, onProgress?: (loaded: number) => void) {
    const useProgress = typeof onProgress === 'function';
    if (!useProgress) {
      const res = await fetch('/api/auth/signup', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    return await new Promise<{ ok: boolean; status: number; data: unknown }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/auth/signup');
      xhr.withCredentials = true;

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        onProgress(Math.max(0, ev.loaded));
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.onload = () => {
        let data: unknown = {};
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          data = {};
        }
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data,
        });
      };

      xhr.send(fd);
    });
  }
  const showInlineEmailError = step === 2 && showError && error === INVALID_EMAIL_ERROR;
  const showInlinePasswordMismatchError =
    step === 2 && showError && error === PASSWORD_MISMATCH_ERROR;
  const otpVerifiedForEmail = otpVerifiedFor === emailTrimmed && emailTrimmed.length > 0;
  const maskedOtpEmail = (() => {
    const at = otpEmail.indexOf('@');
    if (at <= 1) return otpEmail;
    const local = otpEmail.slice(0, at);
    const domain = otpEmail.slice(at);
    const visible = local.slice(0, 3);
    return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}${domain}`;
  })();

  useEffect(() => {
    if (step !== 3 || otpResendIn <= 0) return;
    const id = window.setTimeout(() => {
      setOtpResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [step, otpResendIn]);

  useEffect(() => {
    if (!showOtpSuccessToast) return;
    if (otpToastDismissTimer.current) clearTimeout(otpToastDismissTimer.current);
    if (otpToastRemoveTimer.current) clearTimeout(otpToastRemoveTimer.current);
    const id = window.setTimeout(() => {
      setOtpSuccessToastLeaving(true);
    }, 5200);
    otpToastDismissTimer.current = id;
    return () => {
      if (otpToastDismissTimer.current) clearTimeout(otpToastDismissTimer.current);
      otpToastDismissTimer.current = null;
    };
  }, [showOtpSuccessToast]);

  useEffect(() => {
    if (!otpSuccessToastLeaving) return;
    if (otpToastRemoveTimer.current) clearTimeout(otpToastRemoveTimer.current);
    const id = window.setTimeout(() => {
      setShowOtpSuccessToast(false);
      setOtpSuccessToastLeaving(false);
    }, 380);
    otpToastRemoveTimer.current = id;
    return () => {
      if (otpToastRemoveTimer.current) clearTimeout(otpToastRemoveTimer.current);
      otpToastRemoveTimer.current = null;
    };
  }, [otpSuccessToastLeaving]);

async function requestEmailOtp(): Promise<boolean> {
    setOtpSending(true);
    try {
      const res = await fetch('/api/auth/signup/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: unknown };
      if (!res.ok) {
        setError(
          typeof data.message === 'string'
            ? data.message
            : 'Failed to send verification code. Try again.',
        );
        setShowError(true);
        return false;
      }
      setOtpCode('');
      setOtpEmail(emailTrimmed);
      setOtpVerifiedFor(null);
      setOtpResendIn(59);
      setError(null);
      setShowError(false);
      return true;
    } catch {
      setError('Failed to send verification code. Try again.');
      setShowError(true);
      return false;
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyEmailOtp(): Promise<boolean> {
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code.');
      setShowError(true);
      return false;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch('/api/auth/signup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed, code }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: unknown };
      if (!res.ok) {
        setError(
          typeof data.message === 'string'
            ? data.message
            : 'Failed to verify code. Request a new one.',
        );
        setShowError(true);
        return false;
      }
      setOtpVerifiedFor(emailTrimmed);
      setError(null);
      setShowError(false);
      return true;
    } catch {
      setError('Failed to verify code. Request a new one.');
      setShowError(true);
      return false;
    } finally {
      setOtpVerifying(false);
    }
  }

  async function goToNextStep() {
    if (step === 1) {
      if (!canStep2) return;
      clearError();
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canStep3) {
        const missingBasics =
          !firstNameTrimmed || !lastNameTrimmed || !emailTrimmed;
        const passwordTouched = password.trim().length > 0 || confirmPassword.trim().length > 0;

        if (missingBasics || !passwordTouched) {
          setError('Please fill all required fields.');
        } else if (!emailOk) {
          setError(INVALID_EMAIL_ERROR);
        } else if (!firstNameOk || !lastNameOk) {
          setError('Names can only contain letters, spaces, apostrophes, and hyphens.');
        } else if (!passwordOk) {
          setError('Password must be at least 8 characters.');
        } else if (!passwordsMatch) {
          setError(PASSWORD_MISMATCH_ERROR);
        } else {
          setError('Please complete all required fields.');
        }
        setShowError(true);
        return;
      }
      const otpSent = await requestEmailOtp();
      if (!otpSent) return;
      setStep(3);
      return;
    }

    if (step === 3) {
      if (otpVerifiedForEmail) {
        setStep(4);
        return;
      }
      const verified = await verifyEmailOtp();
      if (!verified) return;
      setOtpSuccessToastLeaving(false);
      setShowOtpSuccessToast(true);
      setStep(4);
    }
  }

  function dismissOtpSuccessToast() {
    setOtpSuccessToastLeaving(true);
  }

  function updateOtpDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = otpCode.padEnd(6, ' ').split('');
    next[index] = digit || ' ';
    const compact = next.join('').replace(/\s+$/g, '');
    setOtpCode(compact);
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  async function handleSubmit() {
    clearError();
    if (!otpVerifiedForEmail) {
      setError('Please verify your email before continuing.');
      setShowError(true);
      return;
    }
    if (
      !accountType ||
      !canStep3 ||
      !businessName.trim() ||
      !businessLocation.trim()
    ) {
      setError('Please complete all required fields.');
      setShowError(true);
      return;
    }
    if (!businessEmailOk) {
      setError(INVALID_BUSINESS_EMAIL_ERROR);
      setShowError(true);
      return;
    }
    setLoading(true);
    setIsPreparingLogo(false);
    setIsUploadingLogo(Boolean(logo));
    setIsLogoUploaded(false);
    setUploadLoadedBytes(0);
    setUploadTotalBytes(logo?.size ?? 0);
    try {
      const fd = new FormData();
      fd.set('accountType', accountType);
      fd.set('firstName', firstName.trim());
      fd.set('lastName', lastName.trim());
      fd.set('phone', phone.trim());
      fd.set('email', email.trim().toLowerCase());
      fd.set('password', password.trim());
      fd.set('confirmPassword', confirmPassword.trim());
      fd.set('businessName', businessName.trim());
      fd.set('businessLocation', businessLocation.trim());
      fd.set('businessPhone', businessPhoneTrimmed);
      fd.set('businessEmail', businessEmailTrimmed);
      if (logo) fd.set('logo', logo);

      const result = await submitSignupFormData(
        fd,
        logo
          ? (loaded) => {
              const capped = Math.min(loaded, logo.size);
              setUploadLoadedBytes(capped);
            }
          : undefined,
      );
      const data = result.data as { message?: unknown };
      if (!result.ok) {
        setError(typeof data?.message === 'string' ? data.message : 'Signup failed');
        setShowError(true);
        setLoading(false);
        return;
      }
      if (logo) {
        setUploadLoadedBytes(logo.size);
        setUploadTotalBytes(logo.size);
        setIsLogoUploaded(true);
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
      setShowError(true);
    } finally {
      setLoading(false);
      setIsUploadingLogo(false);
      setIsPreparingLogo(false);
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-split__hero" aria-hidden>
        <div className="auth-split__hero-media">
          <div className="auth-split__hero-media-overlay" />
        </div>
        <div className="auth-split__hero-inner">
          <div className="auth-split__brand">
            <span className="auth-split__logo">FT</span>
            <span>FinTrack Pro</span>
          </div>
          <h1 className="auth-split__headline">
            Run your business from invoices
            
            <br/>to insights in one workspace.
          </h1>
          <p className="auth-split__lead">
            Invoices, clients, cash flow, and analytics—connected in one workspace, so you can track
            performance, uncover insights, and make smarter business decisions.
          </p>
          <div className="auth-split__features-grid">
            <ul className="auth-split__features auth-split__features--col" role="list">
              <li className="auth-split__feature">
                <span className="auth-split__feature-icon-wrap" aria-hidden>
                  <FileText size={19} strokeWidth={1.65} />
                </span>
                <div className="auth-split__feature-body">
                  <strong className="auth-split__feature-title">Smart invoicing</strong>
                  <p className="auth-split__feature-desc">
                    Professional invoices, reminders, and payment tracking without the busywork.
                  </p>
                </div>
              </li>
              <li className="auth-split__feature">
                <span className="auth-split__feature-icon-wrap" aria-hidden>
                  <BarChart3 size={19} strokeWidth={1.65} />
                </span>
                <div className="auth-split__feature-body">
                  <strong className="auth-split__feature-title">Built-in analytics</strong>
                  <p className="auth-split__feature-desc">
                    Revenue, profit, and performance in clear visuals, not spreadsheet chaos.
                  </p>
                </div>
              </li>
              <li className="auth-split__feature">
                <span className="auth-split__feature-icon-wrap" aria-hidden>
                  <TrendingUp size={19} strokeWidth={1.65} />
                </span>
                <div className="auth-split__feature-body">
                  <strong className="auth-split__feature-title">Faster decisions</strong>
                  <p className="auth-split__feature-desc">
                    Trends and cash-flow signals when you need them, not buried in exports.
                  </p>
                </div>
              </li>
            </ul>
            <ul className="auth-split__features auth-split__features--col" role="list">
              <li className="auth-split__feature">
                <span className="auth-split__feature-icon-wrap" aria-hidden>
                  <Users size={19} strokeWidth={1.65} />
                </span>
                <div className="auth-split__feature-body">
                  <strong className="auth-split__feature-title">Solo or team</strong>
                  <p className="auth-split__feature-desc">
                  Role-based access and a secure workspace built for real work.
                  </p>
                </div>
              </li>
              <li className="auth-split__feature">
                <span className="auth-split__feature-icon-wrap" aria-hidden>
                  <Zap size={19} strokeWidth={1.65} />
                </span>
                <div className="auth-split__feature-body">
                  <strong className="auth-split__feature-title">Up and running in minutes</strong>
                  <p className="auth-split__feature-desc">
                    Straightforward onboarding: clarity and control, not clutter.
                  </p>
                </div>
              </li>
              <li className="auth-split__feature">
                <span className="auth-split__feature-icon-wrap" aria-hidden>
                  <ContactRound size={19} strokeWidth={1.65} />
                </span>
                <div className="auth-split__feature-body">
                  <strong className="auth-split__feature-title">Clients in one place</strong>
                  <p className="auth-split__feature-desc">
                    Every contact, note, and invoice history in one profile without juggling tabs.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <div className="auth-split__form-wrap auth-split__form-wrap--signup">
        <nav className="auth-stepper auth-stepper--outer" aria-label="Registration steps">
          <div className="auth-stepper__track">
            <div className="auth-stepper__steps-row" role="list">
              {steps.map((s, i) => (
                <Fragment key={s.id}>
                  <div
                    className={`auth-stepper__segment ${step === s.id ? 'is-current' : ''} ${step > s.id ? 'is-complete' : ''} ${step < s.id ? 'is-future' : ''}`}
                    role="listitem"
                  >
                    <div className="auth-stepper__node">
                      <span
                        className={`auth-stepper__bubble ${step > s.id ? 'is-done' : ''} ${step === s.id ? 'is-active' : ''} ${step < s.id ? 'is-future' : ''}`}
                        aria-current={step === s.id ? 'step' : undefined}
                      >
                        {step > s.id ? (
                          <Check size={12} strokeWidth={3} aria-hidden />
                        ) : step === s.id ? (
                          s.id
                        ) : null}
                      </span>
                    </div>
                    <span
                      className={`auth-stepper__name ${step === s.id ? 'is-current' : ''} ${step > s.id ? 'is-complete' : ''}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="auth-stepper__rail-wrap" aria-hidden>
                      <div
                        className={`auth-stepper__rail ${step >= i + 2 ? 'auth-stepper__rail--done' : 'auth-stepper__rail--pending'}`}
                      />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </nav>

        <div className="auth-split__form-card">
          <header className="auth-split__header">
            {step === 3 && (
              <div className="auth-otp__hero-icon" aria-hidden>
                <svg
                  className="auth-otp__hero-icon-envelope"
                  viewBox="0 0 64 48"
                  width="54"
                  height="40"
                  focusable="false"
                  aria-hidden="true"
                >
                  <rect x="1.5" y="1.5" width="61" height="45" rx="10" fill="#16a34a" />
                  <path
                    d="M9.5 14.5L32 30.5L54.5 14.5"
                    fill="none"
                    stroke="#ecfdf5"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 16V34C10 36.2 11.8 38 14 38H50C52.2 38 54 36.2 54 34V16"
                    fill="none"
                    stroke="#f0fdf4"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
            <h2>{step === 3 ? 'Email Verification' : 'Create your account'}</h2>
            <p>
              {step === 1 && 'Choose how you’ll use FinTrack.'}
              {step === 2 && 'Your sign-in identity and contact details.'}
              {step === 3 && (
                <>
                  We have sent a 6-digit verification code to{' '}
                  <span className="auth-otp__email-highlight">{maskedOtpEmail}</span>.
                </>
              )}
              {step === 4 && 'Your company profile and optional logo.'}
            </p>
          </header>

          {showError && error && !showInlineEmailError && !showInlinePasswordMismatchError && (
            <div className="auth-split__error" role="alert">
              {error}
            </div>
          )}

          {showOtpSuccessToast && (
            <div className="alert-push-dock auth-otp-push-dock" aria-live="polite" aria-relevant="additions">
              <article
                className={`alert-push alert-push--variant-chart ${otpSuccessToastLeaving ? 'alert-push--leave' : 'alert-push--enter'}`}
                role="status"
              >
                <div className="alert-push__inner">
                  <div className="alert-push__icon alert-push__icon--chart" aria-hidden>
                    <Check size={20} strokeWidth={2.8} />
                  </div>
                  <div className="alert-push__body">
                    <p className="alert-push__title">Email verified</p>
                    <p className="alert-push__desc">
                      Verification successful. You can continue onboarding.
                    </p>
                    <p className="alert-push__meta">Just now</p>
                  </div>
                  <button
                    type="button"
                    className="alert-push__close"
                    aria-label="Dismiss"
                    onClick={dismissOtpSuccessToast}
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
                <div className="alert-push__hint" aria-hidden>
                  <div
                    className="alert-push__hint-bar"
                    style={{ '--push-duration': '5200ms' } as React.CSSProperties}
                  />
                </div>
              </article>
            </div>
          )}

          {step === 1 && (
            <div className="auth-type-grid">
              <button
                type="button"
                className={`auth-type-card ${accountType === 'SOLO' ? 'auth-type-card--active' : ''}`}
                onClick={() => {
                  clearError();
                  setAccountType('SOLO');
                }}
              >
                <span className="auth-type-card__check" aria-hidden>
                  {accountType === 'SOLO' ? <Check size={18} strokeWidth={2.5} /> : <span className="auth-type-card__dot" />}
                </span>
                <User size={22} className="auth-type-card__icon" strokeWidth={2} />
                <strong>Solo business</strong>
                <span>Just you — one workspace, full ownership.</span>
              </button>
              <button
                type="button"
                className={`auth-type-card ${accountType === 'TEAM' ? 'auth-type-card--active' : ''}`}
                onClick={() => {
                  clearError();
                  setAccountType('TEAM');
                }}
              >
                <span className="auth-type-card__check" aria-hidden>
                  {accountType === 'TEAM' ? <Check size={18} strokeWidth={2.5} /> : <span className="auth-type-card__dot" />}
                </span>
                <Building2 size={22} className="auth-type-card__icon" strokeWidth={2} />
                <strong>Team / company</strong>
                <span>Collaborate with admins and staff under one workspace.</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <form
              id="signup-step2-form"
              className="auth-fields"
              onSubmit={(e) => {
                e.preventDefault();
                goToNextStep();
              }}
            >
              <div className="auth-field-row">
                <label className="auth-field">
                  <span>First name</span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!NAME_PARTIAL_RE.test(next)) return;
                      clearError();
                      setFirstName(next);
                    }}
                    placeholder="Jane"
                  />
                </label>
                <label className="auth-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!NAME_PARTIAL_RE.test(next)) return;
                      clearError();
                      setLastName(next);
                    }}
                    placeholder="Doe"
                  />
                </label>
              </div>
              <label className="auth-field">
                <span>
                  <Phone size={14} aria-hidden /> Phone (optional)
                </span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    clearError();
                    setPhone(e.target.value);
                  }}
                  placeholder="+233 12 345 6789"
                />
              </label>
              <label className="auth-field auth-field--email">
                <span>
                  <Mail size={14} aria-hidden /> Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    clearError();
                    setEmail(e.target.value);
                    setOtpVerifiedFor(null);
                  }}
                  placeholder="you@company.com"
                />
                {showInlineEmailError && (
                  <div className="auth-inline-field-error" role="alert">
                    {INVALID_EMAIL_ERROR}
                  </div>
                )}
              </label>
              <label className="auth-field auth-field--password">
                <span>
                  <Lock size={14} aria-hidden /> Password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onChange={(e) => {
                    clearError();
                    setPassword(e.target.value);
                  }}
                  placeholder="At least 8 characters"
                />
                {showPasswordMeter && (
                  <div
                    className={`auth-password-meter auth-password-meter--${passwordStrengthTone}`}
                    role="status"
                    aria-live="polite"
                    style={
                      {
                        '--meter-tooltip-x': meterTooltipX,
                        '--meter-fill': meterFillPercent,
                      } as React.CSSProperties
                    }
                  >
                    <div className="auth-password-meter__head">
                    </div>
                    <div className="auth-password-meter__bars" aria-hidden>
                      {trimmedPassword.length > 0 ? (
                        <span className="auth-password-meter__tooltip">{passwordStrengthLabel}</span>
                      ) : null}
                      <span className="auth-password-meter__track">
                        <span className="auth-password-meter__fill" />
                      </span>
                    </div>
                    <ul className="auth-password-meter__checks">
                      <li className={passwordChecks.length ? 'is-passed' : ''}>
                        {passwordChecks.length ? (
                          <Check size={12} strokeWidth={3} aria-hidden />
                        ) : (
                          <X size={12} strokeWidth={3} aria-hidden />
                        )}{' '}
                        At least 8 characters
                      </li>
                      <li className={passwordChecks.uppercase ? 'is-passed' : ''}>
                        {passwordChecks.uppercase ? (
                          <Check size={12} strokeWidth={3} aria-hidden />
                        ) : (
                          <X size={12} strokeWidth={3} aria-hidden />
                        )}{' '}
                        Uppercase letter (A-Z)
                      </li>
                      <li className={passwordChecks.lowercase ? 'is-passed' : ''}>
                        {passwordChecks.lowercase ? (
                          <Check size={12} strokeWidth={3} aria-hidden />
                        ) : (
                          <X size={12} strokeWidth={3} aria-hidden />
                        )}{' '}
                        Lowercase letter (a-z)
                      </li>
                      <li className={passwordChecks.number ? 'is-passed' : ''}>
                        {passwordChecks.number ? (
                          <Check size={12} strokeWidth={3} aria-hidden />
                        ) : (
                          <X size={12} strokeWidth={3} aria-hidden />
                        )}{' '}
                        Number (0-9)
                      </li>
                      <li className={passwordChecks.special ? 'is-passed' : ''}>
                        {passwordChecks.special ? (
                          <Check size={12} strokeWidth={3} aria-hidden />
                        ) : (
                          <X size={12} strokeWidth={3} aria-hidden />
                        )}{' '}
                        Special character (e.g. !@#$%)
                      </li>
                    </ul>
                  </div>
                )}
              </label>
              <label className="auth-field auth-field--confirm-password">
                <span>Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    clearError();
                    setConfirmPassword(e.target.value);
                  }}
                  placeholder="Repeat password"
                />
                {showInlinePasswordMismatchError && (
                  <div className="auth-inline-field-error" role="alert">
                    {PASSWORD_MISMATCH_ERROR}
                  </div>
                )}
              </label>
            </form>
          )}

          {step === 3 && (
            <div className="auth-fields auth-otp">
              <div
                className="auth-otp__digit-row"
                onPaste={(e) => {
                  const pasted = e.clipboardData
                    .getData('text')
                    .replace(/\D/g, '')
                    .slice(0, 6);
                  if (!pasted) return;
                  e.preventDefault();
                  setOtpCode(pasted);
                  const nextIndex = Math.min(5, pasted.length);
                  otpInputRefs.current[nextIndex]?.focus();
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpInputRefs.current[i] = el;
                    }}
                    className="auth-otp__digit"
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : undefined}
                    maxLength={1}
                    value={otpCode[i] ?? ''}
                    onChange={(e) => {
                      clearError();
                      updateOtpDigit(i, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !(otpCode[i] ?? '') && i > 0) {
                        otpInputRefs.current[i - 1]?.focus();
                      }
                      if (e.key === 'ArrowLeft' && i > 0) {
                        e.preventDefault();
                        otpInputRefs.current[i - 1]?.focus();
                      }
                      if (e.key === 'ArrowRight' && i < 5) {
                        e.preventDefault();
                        otpInputRefs.current[i + 1]?.focus();
                      }
                    }}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>
              <p className="auth-otp__hint">
                Did not receive any code?{' '}
                <button
                  type="button"
                  className="auth-otp__resend"
                  onClick={() => {
                    void requestEmailOtp();
                  }}
                  disabled={otpSending || otpVerifying || otpResendIn > 0}
                >
                  {otpSending
                    ? 'Sending...'
                    : otpResendIn > 0
                    ? `Resend in 0:${String(otpResendIn).padStart(2, '0')}`
                    : 'Resend code'}
                </button>
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="auth-fields">
              <label className="auth-field">
                <span>Business name</span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => {
                    clearError();
                    setBusinessName(e.target.value);
                  }}
                  placeholder="Acme Ltd."
                />
              </label>
              <label className="auth-field">
                <span>Business location</span>
                <input
                  type="text"
                  value={businessLocation}
                  onChange={(e) => {
                    clearError();
                    setBusinessLocation(e.target.value);
                  }}
                  placeholder="City, country"
                />
              </label>
              <div className="auth-field-row">
                <label className="auth-field">
                  <span>Business number (optional)</span>
                  <input
                    type="tel"
                    value={businessPhone}
                    onChange={(e) => {
                      clearError();
                      setBusinessPhone(e.target.value);
                    }}
                    placeholder="+233 12 345 6789"
                  />
                </label>
                <label className="auth-field">
                  <span>Business email (optional)</span>
                  <input
                    type="email"
                    value={businessEmail}
                    onChange={(e) => {
                      clearError();
                      setBusinessEmail(e.target.value);
                    }}
                    placeholder="info@company.com"
                  />
                </label>
              </div>
              <label className="auth-field auth-field--file">
                <span>Logo (optional)</span>
                {!isLogoUploaded && (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      clearError();
                      const file = e.target.files?.[0] ?? null;
                      setLogo(file);
                      setUploadLoadedBytes(0);
                      setUploadTotalBytes(0);
                      setIsPreparingLogo(false);
                      setIsUploadingLogo(false);
                      setIsLogoUploaded(false);

                      if (!file) return;
                      setUploadTotalBytes(file.size);

                      // Show immediate "progress" while the browser reads the selected file.
                      const seq = ++logoReadSeq.current;
                      const reader = new FileReader();
                      setIsPreparingLogo(true);
                      reader.onprogress = (ev) => {
                        if (logoReadSeq.current !== seq) return;
                        if (!ev.lengthComputable) return;
                        setUploadLoadedBytes(Math.min(ev.loaded, file.size));
                      };
                      reader.onloadend = () => {
                        if (logoReadSeq.current !== seq) return;
                        setUploadLoadedBytes(file.size);
                        setIsPreparingLogo(false);
                        setIsLogoUploaded(true);
                      };
                      reader.onerror = () => {
                        if (logoReadSeq.current !== seq) return;
                        setUploadLoadedBytes(0);
                        setIsPreparingLogo(false);
                        setIsLogoUploaded(false);
                      };
                      reader.readAsArrayBuffer(file);
                    }}
                    disabled={loading}
                  />
                )}
                {logo ? (
                  <div className="auth-upload-card" role="status" aria-live="polite">
                    <div className="auth-upload-card__icon">
                      <ImageIcon size={26} strokeWidth={1.8} aria-hidden />
                    </div>
                    <div className="auth-upload-card__meta">
                      <p className="auth-upload-card__name">{logo.name}</p>
                      <p className="auth-upload-card__size">
                        {isPreparingLogo
                          ? `Preparing... ${formatUploadSize(uploadLoadedBytes)} of ${formatUploadSize(uploadTotalBytes || logo.size)}`
                          : isUploadingLogo
                          ? `${formatUploadSize(uploadLoadedBytes)} of ${formatUploadSize(uploadTotalBytes || logo.size)}`
                          : isLogoUploaded
                          ? `Successfully uploaded (${formatUploadSize(logo.size)})`
                          : `Ready to upload (${formatUploadSize(logo.size)})`}
                      </p>
                      {(isPreparingLogo || isUploadingLogo) && (
                        <div className="auth-upload-card__progress-track" aria-hidden>
                          <span
                            className="auth-upload-card__progress-fill"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="auth-upload-card__remove"
                      onClick={() => {
                        if (loading) return;
                        logoReadSeq.current += 1;
                        setLogo(null);
                        setUploadLoadedBytes(0);
                        setUploadTotalBytes(0);
                        setIsPreparingLogo(false);
                        setIsUploadingLogo(false);
                        setIsLogoUploaded(false);
                      }}
                      disabled={loading}
                      aria-label="Remove selected logo"
                    >
                      <CircleX size={20} aria-hidden />
                    </button>
                  </div>
                ) : null}
              </label>
            </div>
          )}

          <div className="auth-split__actions">
            {step > 1 && (
              <button
                type="button"
                className="btn btn-outline auth-btn-back"
                onClick={() => {
                  clearError();
                  setStep((x) => x - 1);
                }}
                disabled={loading}
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <div className="auth-split__actions-spacer" />
            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary auth-btn-next"
                disabled={
                  loading ||
                  otpSending ||
                  otpVerifying ||
                  (step === 1 && !canStep2) ||
                  (step === 2 && !hasAnyStep2Input) ||
                  (step === 3 && otpCode.trim().length === 0)
                }
                onClick={() => {
                  void goToNextStep();
                }}
              >
                {step === 3 ? 'Verify code' : 'Continue'} <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary auth-btn-next"
                disabled={
                  loading ||
                  !businessName.trim() ||
                  !businessLocation.trim()
                }
                onClick={handleSubmit}
              >
                {loading ? <Loader2 className="auth-spin" size={18} /> : <>Complete signup</>}
              </button>
            )}
          </div>

          <p className="auth-split__footer">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
