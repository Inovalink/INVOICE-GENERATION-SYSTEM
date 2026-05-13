import { NextResponse } from 'next/server';
import { getDefaultUserId } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getDefaultUserId();
    if (!userId) return NextResponse.json({ message: 'No user in system' }, { status: 500 });

    const clients = await prisma.client.findMany({
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(clients);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed to load clients' }, { status: 500 });
  }
}
