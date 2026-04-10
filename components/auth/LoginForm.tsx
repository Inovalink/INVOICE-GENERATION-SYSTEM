'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import './auth-pages.css';

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

export default function LoginForm() {
  const router = useRouter();
  const signupHref = useMobileSignupEntryHref();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="auth-login-page">
      <div className="auth-login-card">
        <h1>Welcome back</h1>
        <p>Sign in to your workspace.</p>
        {error && (
          <div className="auth-split__error" style={{ marginBottom: '1rem' }} role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="auth-fields" style={{ marginTop: 0 }}>
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
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? <Loader2 className="auth-spin" size={18} /> : 'Sign in'}
          </button>
        </form>
        <p className="auth-split__footer" style={{ marginTop: '1.25rem' }}>
          Need an account?{' '}
          <Link href={signupHref} prefetch scroll>
            Create new account
          </Link>
        </p>
      </div>
    </div>
  );
}
