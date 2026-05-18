import { NextResponse } from 'next/server';
import { getCurrentContext } from '@/lib/auth/getCurrentUser';
import { clientTenantWhere, scopeFromContext } from '@/lib/auth/tenantScope';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const scope = scopeFromContext(ctx);

    const clients = await prisma.client.findMany({
      where: clientTenantWhere(scope),
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(clients);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed to load clients' }, { status: 500 });
  }
}
