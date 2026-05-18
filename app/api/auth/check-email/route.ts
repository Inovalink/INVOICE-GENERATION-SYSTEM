import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidEmail } from '@/lib/auth/email';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ message: 'Valid email required' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  return NextResponse.json({ exists: Boolean(existing) });
}
