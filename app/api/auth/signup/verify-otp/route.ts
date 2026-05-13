import { NextResponse } from 'next/server';
import { markSignupEmailVerified, verifyOtp } from '@/lib/auth/otpStore';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
  } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: 'Invalid verification request' }, { status: 400 });
  }

  if (!(await verifyOtp(email, code))) {
    return NextResponse.json({ message: 'Invalid or expired code' }, { status: 400 });
  }

  await markSignupEmailVerified(email, 30 * 60 * 1000);
  return NextResponse.json({ ok: true });
}
