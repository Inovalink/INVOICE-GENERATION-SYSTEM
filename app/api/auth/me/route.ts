import { NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSessionClaims();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}
