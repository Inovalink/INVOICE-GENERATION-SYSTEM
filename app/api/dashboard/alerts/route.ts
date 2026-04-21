import { NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/auth/getCurrentUser';
import { parseLocalDayBounds } from '@/lib/financeDayBounds';
import { buildDashboardAlerts } from '@/lib/dashboardAlerts';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getSessionClaims();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get('date');

  try {
    if (dateRaw) {
      const bounds = parseLocalDayBounds(dateRaw);
      if (!bounds) {
        return NextResponse.json({ message: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
      }
      const alerts = await buildDashboardAlerts(prisma, { dayBounds: bounds });
      return NextResponse.json({ alerts, scope: 'day' as const, date: dateRaw });
    }

    const alerts = await buildDashboardAlerts(prisma);
    return NextResponse.json({ alerts, scope: 'default' as const });
  } catch (e) {
    console.error('dashboard/alerts', e);
    return NextResponse.json({ message: 'Failed to load timeline' }, { status: 500 });
  }
}
