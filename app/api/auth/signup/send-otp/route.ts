import { NextResponse } from 'next/server';
import { setOtp } from '@/lib/auth/otpStore';

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ message: 'Email required' }, { status: 400 });
  }

  const code = randomCode();
  setOtp(email, code, 15 * 60 * 1000);
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[signup-otp] ${email} code=${code}`);
  }

  return NextResponse.json({ ok: true });
}
