import { NextResponse } from 'next/server';
import { setOtp } from '@/lib/auth/otpStore';
import { sendMail } from '@/lib/email/mailer';
import { otpEmailTemplate } from '@/lib/email/templates/otp';

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

  try {
    await sendMail({
      to: email,
      subject: 'Your Invoice System verification code',
      html: otpEmailTemplate(code),
    });
    await setOtp(email, code, 15 * 60 * 1000);
  } catch (err) {
    console.error('[send-otp] Failed to send email:', err);
    return NextResponse.json(
      { message: 'Failed to send verification email. Check mail configuration and try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
