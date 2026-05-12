import { NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function POST(request: Request) {
  const session = await getSessionClaims();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const alertId =
    body && typeof body === 'object' && 'alertId' in body && typeof (body as Record<string, unknown>).alertId === 'string'
      ? ((body as Record<string, unknown>).alertId as string).trim()
      : null;

  if (!alertId) {
    return NextResponse.json({ message: 'alertId is required' }, { status: 400 });
  }

  const dismissedDate = localDateString(new Date());

  await prisma.dismissedAlert.upsert({
    where: {
      userId_alertId_dismissedDate: {
        userId: session.sub,
        alertId,
        dismissedDate,
      },
    },
    update: {},
    create: {
      userId: session.sub,
      alertId,
      dismissedDate,
    },
  });

  return NextResponse.json({ ok: true });
}
