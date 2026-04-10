'use client';

import { useMemo } from 'react';
import { clampPage, getVisiblePages } from '@/lib/pagination';
import './PaginationBar.css';

type PaginationBarProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
};

export default function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
  className = '',
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = clampPage(currentPage, totalPages);

  const { start, end } = useMemo(() => {
    if (totalItems === 0) return { start: 0, end: 0 };
    const s = (safePage - 1) * pageSize + 1;
    const e = Math.min(safePage * pageSize, totalItems);
    return { start: s, end: e };
  }, [safePage, pageSize, totalItems]);

  const visible = useMemo(
    () => getVisiblePages(safePage, totalPages),
    [safePage, totalPages],
  );

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={`pagination ${className}`.trim()}>
      <span className="pagination-info">
        Showing {start} - {end} of {totalItems} {itemLabel}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="page-nav"
          aria-label="Previous page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          &lt;
        </button>
        {visible.map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`e-${idx}`} className="page-ellipsis">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`page-num ${item === safePage ? 'active' : ''}`}
              aria-label={`Page ${item}`}
              aria-current={item === safePage ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="page-nav"
          aria-label="Next page"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          &gt;
        </button>
      </div>
    </div>
  );
}
