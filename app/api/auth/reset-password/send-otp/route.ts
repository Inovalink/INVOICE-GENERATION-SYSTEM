import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidEmail } from '@/lib/auth/email';
import { MailerConfigError, sendMail } from '@/lib/email/mailer';
import { passwordResetEmailTemplate } from '@/lib/email/templates/passwordReset';

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ message: 'Valid email required' }, { status: 400 });
  }

  const users = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE email = ${email} LIMIT 1
  `;

  // Always respond success — never reveal whether the email exists
  if (!users.length) {
    return NextResponse.json({ ok: true });
  }

  const code = randomCode();
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.$executeRaw`
    INSERT INTO "PasswordResetToken" (email, code, "expiresAt", "createdAt", "updatedAt")
    VALUES (${email}, ${code}, ${expiresAt}, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE
      SET code = ${code}, "expiresAt" = ${expiresAt}, "updatedAt" = NOW()
  `;

  try {
    await sendMail({
      to: email,
      subject: 'Reset your Invoice System password',
      html: passwordResetEmailTemplate(code),
    });
  } catch (err) {
    console.error('[reset-password/send-otp] Failed to send email:', err);
    if (err instanceof MailerConfigError) {
      return NextResponse.json(
        { message: 'Mail service is not configured.' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { message: 'Failed to send reset email. Try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
