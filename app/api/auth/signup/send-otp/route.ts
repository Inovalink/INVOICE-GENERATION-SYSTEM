import { NextResponse } from 'next/server';
import { setOtp } from '@/lib/auth/otpStore';
import { MailerConfigError, sendMail } from '@/lib/email/mailer';
import { otpEmailTemplate } from '@/lib/email/templates/otp';
import { isValidEmail } from '@/lib/auth/email';

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ message: 'Email required' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 });
  }

  const code = randomCode();

  try {
    await setOtp(email, code, 15 * 60 * 1000);
  } catch (err) {
    console.error('[send-otp] Failed to store verification code:', err);
    return NextResponse.json(
      { message: 'Verification service is unavailable. Check database configuration and try again.' },
      { status: 500 },
    );
  }

  try {
    await sendMail({
      to: email,
      subject: 'Your Invoice System verification code',
      html: otpEmailTemplate(code),
    });
  } catch (err) {
    console.error('[send-otp] Failed to send email:', err);

    if (err instanceof MailerConfigError) {
      return NextResponse.json(
        { message: 'Mail service is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: 'Failed to send verification email. Check mail configuration and try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
