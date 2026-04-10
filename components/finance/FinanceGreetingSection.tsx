'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import 'react-day-picker/style.css';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date | undefined {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const x = new Date(y, m - 1, d);
  return Number.isNaN(x.getTime()) ? undefined : x;
}

type Props = {
  firstName: string;
};

export default function FinanceGreetingSection({ firstName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawDate = searchParams.get('date');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const selected = useMemo(() => (rawDate ? parseYmd(rawDate) : undefined), [rawDate]);

  const displayDate = selected ?? new Date();
  const weekday = displayDate.toLocaleDateString('en-US', { weekday: 'long' });
  const month = displayDate.toLocaleDateString('en-US', { month: 'long' });
  const dayNum = displayDate.getDate();

  const wall = new Date();
  const greet =
    wall.getHours() < 12
      ? 'Good morning'
      : wall.getHours() < 17
        ? 'Good afternoon'
        : 'Good evening';

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const el = wrapRef.current;
    const r = el.getBoundingClientRect();
    setPopoverStyle({
      position: 'fixed',
      top: Math.min(window.innerHeight - 8, r.bottom + 6),
      left: Math.max(8, Math.min(r.left, window.innerWidth - 408)),
      zIndex: 80,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pickerLabel = rawDate
    ? displayDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'All time';

  const calendar =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={popRef}
        className="finance-greeting-section__calendar-popover"
        style={popoverStyle}
      >
        <DayPicker
          mode="single"
          selected={selected}
          defaultMonth={displayDate}
          onSelect={(d) => {
            if (!d) return;
            router.push(`/?date=${encodeURIComponent(toYmd(d))}`);
            setOpen(false);
          }}
        />
      </div>,
      document.body,
    );

  return (
    <section className="finance-greeting-section" aria-label="Dashboard greeting">
      <div className="finance-greeting-section__text">
        <h1 className="finance-greeting-section__title">
          {greet}, {firstName}
        </h1>
      </div>
      <div className="finance-greeting-section__date-block">
        <div className="finance-greeting-section__date-visual">
          <div className="finance-greeting-section__date-circle" aria-hidden>
            {dayNum}
          </div>
          <div className="finance-greeting-section__date-labels">
            <span className="finance-greeting-section__weekday">{weekday}</span>
            <span className="finance-greeting-section__month">{month}</span>
          </div>
        </div>
        <div className="finance-greeting-section__date-divider" aria-hidden />
        <div className="finance-greeting-section__picker-wrap" ref={wrapRef}>
          <div
            className={`finance-greeting-section__picker${open ? ' finance-greeting-section__picker--open' : ''}`}
          >
            <CalendarDays size={20} strokeWidth={2} className="finance-greeting-section__picker-icon" aria-hidden />
            <span
              className={`finance-greeting-section__picker-input ${!rawDate ? 'finance-greeting-section__picker-input--all' : ''}`}
            >
              {pickerLabel}
            </span>
            {rawDate ? (
              <button
                type="button"
                className="finance-greeting-section__picker-clear"
                aria-label="Clear date filter"
                onClick={() => {
                  router.push('/');
                  setOpen(false);
                }}
              >
                <X size={15} strokeWidth={2.25} />
              </button>
            ) : null}
            <button
              type="button"
              className="finance-greeting-section__picker-chevron"
              aria-expanded={open}
              aria-label="Choose date"
              onClick={() => setOpen((o) => !o)}
            >
              <ChevronDown size={17} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {calendar}
    </section>
  );
}
