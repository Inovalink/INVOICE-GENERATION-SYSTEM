import { prisma } from '@/lib/prisma';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const signupOtpVerification = prisma.signupOtpVerification;

export async function setOtp(email: string, code: string, ttlMs: number): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = new Date(Date.now() + ttlMs);

  await signupOtpVerification.upsert({
    where: { email: normalizedEmail },
    update: {
      code,
      expiresAt,
      verifiedUntil: null,
    },
    create: {
      email: normalizedEmail,
      code,
      expiresAt,
      verifiedUntil: null,
    },
  });
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const row = await signupOtpVerification.findUnique({
    where: { email: normalizedEmail },
    select: { code: true, expiresAt: true },
  });

  if (!row) return false;
  if (Date.now() > row.expiresAt.getTime()) {
    await signupOtpVerification.deleteMany({ where: { email: normalizedEmail } });
    return false;
  }
  if (row.code !== code.trim()) return false;

  await signupOtpVerification.update({
    where: { email: normalizedEmail },
    data: {
      code: '',
      expiresAt: new Date(),
    },
  });
  return true;
}

/** After OTP succeeds, allow completing signup for this email for a short window. */
export async function markSignupEmailVerified(email: string, ttlMs: number): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const verifiedUntil = new Date(Date.now() + ttlMs);

  await signupOtpVerification.upsert({
    where: { email: normalizedEmail },
    update: { verifiedUntil },
    create: {
      email: normalizedEmail,
      code: '',
      expiresAt: new Date(),
      verifiedUntil,
    },
  });
}

export async function consumeSignupEmailVerification(email: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const row = await signupOtpVerification.findUnique({
    where: { email: normalizedEmail },
    select: { verifiedUntil: true },
  });

  if (!row?.verifiedUntil || Date.now() > row.verifiedUntil.getTime()) {
    await signupOtpVerification.deleteMany({ where: { email: normalizedEmail } });
    return false;
  }

  await signupOtpVerification.delete({
    where: { email: normalizedEmail },
  });
  return true;
}
