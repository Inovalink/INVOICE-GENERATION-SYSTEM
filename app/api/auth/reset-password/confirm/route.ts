import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isValidEmail } from '@/lib/auth/email';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
    newPassword?: string;
  } | null;

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ message: 'Valid email required' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: 'Invalid reset code' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { message: 'Password must be at least 8 characters' },
      { status: 400 },
    );
  }

  const tokens = await prisma.$queryRaw<{ code: string; expiresAt: Date }[]>`
    SELECT code, "expiresAt" FROM "PasswordResetToken" WHERE email = ${email} LIMIT 1
  `;

  const token = tokens[0] ?? null;

  if (!token || token.code !== code || Date.now() > new Date(token.expiresAt).getTime()) {
    await prisma.$executeRaw`DELETE FROM "PasswordResetToken" WHERE email = ${email}`;
    return NextResponse.json(
      { message: 'Reset code is invalid or has expired. Please request a new one.' },
      { status: 400 },
    );
  }

  const users = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE email = ${email} LIMIT 1
  `;
  const user = users[0] ?? null;

  if (!user) {
    return NextResponse.json({ message: 'No account found for this email.' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$executeRaw`
    UPDATE "User" SET password = ${passwordHash}, "updatedAt" = NOW() WHERE id = ${user.id}
  `;
  await prisma.$executeRaw`DELETE FROM "PasswordResetToken" WHERE email = ${email}`;

  return NextResponse.json({ ok: true });
}
