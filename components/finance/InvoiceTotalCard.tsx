'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import type {
  InvoiceTotalCardPayload,
  InvoiceTotalFilter,
} from '@/lib/invoiceTotalSeries';

const PERIODS = [
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

const STATUS_OPTIONS: { value: InvoiceTotalFilter; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'proforma', label: 'Proforma' },
];

type Period = (typeof PERIODS)[number]['value'];

type Props = {
  data: InvoiceTotalCardPayload;
  variant?: 'default' | 'split';
};

export default function InvoiceTotalCard({ data, variant = 'default' }: Props) {
  const [period, setPeriod] = useState<Period>('weekly');
  const [status, setStatus] = useState<InvoiceTotalFilter>('paid');
  const [openPeriod, setOpenPeriod] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => {
    setOpenPeriod(false);
    setOpenStatus(false);
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (periodRef.current?.contains(t)) return;
      if (statusRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpenPeriod(false);
      setOpenStatus(false);
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const series = period === 'weekly' ? data.weekly[status] : data.monthly[status];
  const total = series.reduce((s, p) => s + p.value, 0);
  const maxVal = Math.max(1, ...series.map((p) => p.value));

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? 'Weekly';
  const statusLabel = STATUS_OPTIONS.find((s) => s.value === status)?.label ?? 'Paid';

  const chartMod =
    status === 'proforma' ? 'proforma' : status === 'paid' ? 'paid' : status === 'pending' ? 'pending' : 'overdue';

  const subLine =
    period === 'weekly' ? `Last 7 weeks · ${statusLabel}` : `Last 6 months · ${statusLabel}`;

  const hint =
    period === 'weekly' ? 'Latest week vs previous week' : 'Latest month vs previous month';

  const periodListId = useId();
  const statusListId = useId();

  return (
    <section
      className={`invoice-total-card ${variant === 'split' ? 'invoice-total-card--split' : ''}`}
      aria-label="Total invoices trend"
    >
      <div
        className={`invoice-total-card__shell ${variant === 'split' ? 'invoice-total-card__shell--split' : ''}`}
      >
        <div className="invoice-total-card__head">
          <h2 className="invoice-total-card__title">Total Invoices</h2>
          <div className="invoice-total-card__head-actions">
            <div className="invoice-total-card__selects">
              <div className="invoice-total-dd" ref={periodRef}>
                <button
                  type="button"
                  className={`invoice-total-dd__trigger ${openPeriod ? 'is-open' : ''}`}
                  aria-expanded={openPeriod}
                  aria-haspopup="listbox"
                  aria-controls={periodListId}
                  onClick={() => {
                    setOpenStatus(false);
                    setOpenPeriod((o) => !o);
                  }}
                >
                  <span className="invoice-total-dd__value">{periodLabel}</span>
                  <ChevronDown className="invoice-total-dd__chevron" size={14} strokeWidth={2.5} aria-hidden />
                </button>
                {openPeriod ? (
                  <ul id={periodListId} className="invoice-total-dd__list" role="listbox">
                    {PERIODS.map((opt) => (
                      <li key={opt.value} className="invoice-total-dd__item" role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={period === opt.value}
                          className={`invoice-total-dd__option ${period === opt.value ? 'is-selected' : ''}`}
                          onClick={() => {
                            setPeriod(opt.value);
                            setOpenPeriod(false);
                          }}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="invoice-total-dd" ref={statusRef}>
                <button
                  type="button"
                  className={`invoice-total-dd__trigger ${openStatus ? 'is-open' : ''}`}
                  aria-expanded={openStatus}
                  aria-haspopup="listbox"
                  aria-controls={statusListId}
                  onClick={() => {
                    setOpenPeriod(false);
                    setOpenStatus((o) => !o);
                  }}
                >
                  <span className="invoice-total-dd__value">{statusLabel}</span>
                  <ChevronDown className="invoice-total-dd__chevron" size={14} strokeWidth={2.5} aria-hidden />
                </button>
                {openStatus ? (
                  <ul id={statusListId} className="invoice-total-dd__list" role="listbox">
                    {STATUS_OPTIONS.map((opt) => (
                      <li key={opt.value} className="invoice-total-dd__item" role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={status === opt.value}
                          className={`invoice-total-dd__option ${status === opt.value ? 'is-selected' : ''}`}
                          onClick={() => {
                            setStatus(opt.value);
                            setOpenStatus(false);
                          }}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="invoice-total-card__menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="invoice-total-card__menu-btn"
                aria-expanded={menuOpen}
                aria-label="More options"
                onClick={() => {
                  setOpenPeriod(false);
                  setOpenStatus(false);
                  setMenuOpen((m) => !m);
                }}
              >
                <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
              </button>
              {menuOpen ? (
                <div className="invoice-total-card__menu invoice-total-card__menu--solo-link">
                  <Link
                    href="/invoices"
                    className="invoice-total-card__menu-link"
                    onClick={() => closeAll()}
                  >
                    View all invoices
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <p className="invoice-total-card__metric">{total.toLocaleString('en-US')}</p>
        <p className="invoice-total-card__sub">{subLine}</p>

        <div className={`invoice-total-card__chart invoice-total-card__chart--status-${chartMod}`}>
          <div className="invoice-total-card__bars">
            {series.map((pt, i) => {
              const empty = pt.value === 0;
              const h = empty ? 0 : (pt.value / maxVal) * 100;
              return (
                <div key={`${period}-${status}-${i}`} className="invoice-total-card__bar-col">
                  <div className="invoice-total-card__tip-spacer" aria-hidden />
                  <div className="invoice-total-card__bar-track">
                    <div
                      className={`invoice-total-card__bar-fill invoice-total-card__bar-fill--accent${empty ? ' invoice-total-card__bar-fill--empty' : ''}`}
                      style={{ height: empty ? 0 : `${h}%` }}
                      aria-hidden={empty}
                    />
                  </div>
                  <span className="invoice-total-card__bar-label">{pt.label}</span>
                </div>
              );
            })}
          </div>
          <p className="invoice-total-card__chart-hint">{hint}</p>
        </div>
      </div>
    </section>
  );
}
