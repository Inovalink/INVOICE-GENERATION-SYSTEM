/** Page numbers to show with ellipsis gaps (1-based). */
export function getVisiblePages(
  currentPage: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === 'number' && p - prev > 1) {
      out.push('ellipsis');
    }
    out.push(p);
  }
  return out;
}

export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.min(Math.max(1, page), totalPages);
}
