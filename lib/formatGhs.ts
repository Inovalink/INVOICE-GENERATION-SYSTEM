/** Display amounts in Ghana Cedis (matches invoice currency option in app). */
export function formatGhs(amount: number, maximumFractionDigits = 0): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `GHS ${n.toLocaleString('en-GH', { maximumFractionDigits, minimumFractionDigits: 0 })}`;
}

export type MoMTrend = {
  label: string;
  tone: 'positive' | 'negative' | 'neutral';
  direction: 'up' | 'down' | 'flat';
};

/** Compare current period revenue to the previous period (e.g. this month vs last month). */
export function formatRevenueMoM(current: number, previous: number): MoMTrend {
  if (previous === 0 && current === 0) {
    return { label: 'No revenue last month', tone: 'neutral', direction: 'flat' };
  }
  if (previous === 0) {
    return { label: 'New revenue this period', tone: 'positive', direction: 'up' };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded >= 0 ? '+' : '';
  const tone = rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : 'neutral';
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  return { label: `${sign}${rounded}% from last month`, tone, direction };
}

/** Week-over-week payment / amount comparison (same shape as MoM). */
export function formatRevenueWoW(current: number, previous: number): MoMTrend {
  if (previous === 0 && current === 0) {
    return { label: 'No activity prior week', tone: 'neutral', direction: 'flat' };
  }
  if (previous === 0) {
    return { label: 'New vs prior week', tone: 'positive', direction: 'up' };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded >= 0 ? '+' : '';
  const tone = rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : 'neutral';
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  return { label: `${sign}${rounded}% vs prior week`, tone, direction };
}

/** Day-over-day comparison for scoped dashboard views. */
export function formatDayOverDayTrend(current: number, previous: number): MoMTrend {
  if (previous === 0 && current === 0) {
    return { label: 'Same as prior day', tone: 'neutral', direction: 'flat' };
  }
  if (previous === 0) {
    return { label: 'Up from prior day', tone: 'positive', direction: 'up' };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded >= 0 ? '+' : '';
  const tone = rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : 'neutral';
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  return { label: `${sign}${rounded}% vs prior day`, tone, direction };
}
