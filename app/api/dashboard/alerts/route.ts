import { NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/auth/getCurrentUser';
import { parseLocalDayBounds } from '@/lib/financeDayBounds';
import { buildDashboardAlerts } from '@/lib/dashboardAlerts';
import { prisma } from '@/lib/prisma';

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  const session = await getSessionClaims();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get('date');

  try {
    const bounds = dateRaw ? parseLocalDayBounds(dateRaw) : null;
    if (dateRaw && !bounds) {
      return NextResponse.json({ message: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const targetDate = bounds?.start ?? new Date();
    const dateStr = localDateString(targetDate);

    const dismissed = await prisma.dismissedAlert.findMany({
      where: { userId: session.sub, dismissedDate: dateStr },
      select: { alertId: true },
    });
    const dismissedIds = new Set(dismissed.map((d) => d.alertId));

    const alerts = await buildDashboardAlerts(prisma, {
      dayBounds: bounds ?? undefined,
      dismissedAlertIds: dismissedIds,
    });

    return NextResponse.json({
      alerts,
      scope: bounds ? ('day' as const) : ('default' as const),
      ...(dateRaw ? { date: dateRaw } : {}),
    });
  } catch (e) {
    console.error('dashboard/alerts', e);
    return NextResponse.json({ message: 'Failed to load timeline' }, { status: 500 });
  }
}
