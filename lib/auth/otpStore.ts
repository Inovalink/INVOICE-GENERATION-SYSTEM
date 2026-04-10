type Entry = { code: string; exp: number };

const store = new Map<string, Entry>();
const verifiedSignup = new Map<string, number>();

export function setOtp(email: string, code: string, ttlMs: number): void {
  store.set(email.toLowerCase(), { code, exp: Date.now() + ttlMs });
}

export function verifyOtp(email: string, code: string): boolean {
  const key = email.toLowerCase();
  const row = store.get(key);
  if (!row) return false;
  if (Date.now() > row.exp) {
    store.delete(key);
    return false;
  }
  if (row.code !== code.trim()) return false;
  store.delete(key);
  return true;
}

/** After OTP succeeds, allow completing signup for this email for a short window. */
export function markSignupEmailVerified(email: string, ttlMs: number): void {
  verifiedSignup.set(email.toLowerCase(), Date.now() + ttlMs);
}

export function consumeSignupEmailVerification(email: string): boolean {
  const key = email.toLowerCase();
  const exp = verifiedSignup.get(key);
  if (!exp || Date.now() > exp) {
    verifiedSignup.delete(key);
    return false;
  }
  verifiedSignup.delete(key);
  return true;
}
