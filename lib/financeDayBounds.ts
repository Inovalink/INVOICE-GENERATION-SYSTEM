/** Parse `YYYY-MM-DD` as a local calendar day; returns half-open interval [start, end) for queries. */
export function parseLocalDayBounds(ymd: string): { start: Date; end: Date } | null {
  const trimmed = ymd.trim();
  const parts = trimmed.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
