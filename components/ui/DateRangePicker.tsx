'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import DateRangeCalendar from '@/components/ui/DateRangeCalendar';
import './DateRangePicker.css';

type Props = {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
  /** `pill`: single “Due Date” control; opens panel with From / To pickers (dashboard toolbar). */
  variant?: 'inline' | 'pill';
};

function parseYmd(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const x = new Date(y, m - 1, d);
  return Number.isNaN(x.getTime()) ? null : x;
}

function formatRangeSummary(from: string, to: string): string | null {
  if (!from && !to) return null;
  const df = parseYmd(from);
  const dt = parseYmd(to);
  const showYear = Boolean(df && dt && df.getFullYear() !== dt.getFullYear());
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(showYear ? { year: 'numeric' } : {}),
    });
  if (df && dt) return `${fmt(df)} – ${fmt(dt)}`;
  if (df) return `${fmt(df)} – …`;
  if (dt) return `… – ${fmt(dt)}`;
  return null;
}

export default function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
  placeholder = 'Date range',
  className,
  variant = 'inline',
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** Fixed width: matching trigger width stretched the grid and broke layout. */
  const [panelBox, setPanelBox] = useState({ top: 0, left: 0, width: 320 });
  const pillShellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!panelOpen || variant !== 'pill') return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const update = () => {
      const r = trigger.getBoundingClientRect();
      const w = Math.min(320, window.innerWidth - 16);
      const rightAlign = (className ?? '').includes('date-range-picker--align-right');
      let left = rightAlign ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      const top = r.bottom + 8;
      setPanelBox({ top, left, width: w });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [panelOpen, variant, className]);

  useEffect(() => {
    if (!panelOpen || variant !== 'pill') return;
    let removeListener: (() => void) | undefined;
    const t = window.setTimeout(() => {
      const onPointerDown = (e: PointerEvent) => {
        const node = e.target as Node;
        if (pillShellRef.current?.contains(node)) return;
        if (panelPortalRef.current?.contains(node)) return;
        setPanelOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      removeListener = () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      removeListener?.();
    };
  }, [panelOpen, variant]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  if (variant === 'inline') {
    return (
      <div className={`date-range-picker ${className ?? ''}`.trim()} role="group" aria-label={placeholder}>
        <DatePicker
          value={dateFrom}
          onChange={(from) => onChange(from, dateTo)}
          placeholder="From"
          className="date-range-picker__input"
        />
        <span className="date-range-picker__sep" aria-hidden>
          –
        </span>
        <DatePicker
          value={dateTo}
          onChange={(to) => onChange(dateFrom, to)}
          placeholder="To"
          className="date-range-picker__input"
        />
      </div>
    );
  }

  const summary = formatRangeSummary(dateFrom, dateTo);
  const label = summary ?? placeholder;

  const panelContent = (
    <div
      ref={panelPortalRef}
      className="date-range-picker__panel date-range-picker__panel--portal"
      role="dialog"
      aria-label={placeholder}
      style={{
        position: 'fixed',
        top: panelBox.top,
        left: panelBox.left,
        width: panelBox.width,
        zIndex: 10000,
      }}
    >
      <DateRangeCalendar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onChange={onChange}
        onRangeComplete={() => setPanelOpen(false)}
      />
      {(dateFrom || dateTo) && (
        <button
          type="button"
          className="date-range-picker__clear"
          onClick={() => {
            onChange('', '');
            setPanelOpen(false);
          }}
        >
          Clear dates
        </button>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={pillShellRef}
        className={`date-range-picker date-range-picker--pill ${className ?? ''}`.trim()}
      >
        <button
          ref={triggerRef}
          type="button"
          className={`date-range-picker__pill-trigger ${panelOpen ? 'date-range-picker__pill-trigger--open' : ''}`}
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
          aria-label={`${placeholder}. Opens date range picker.`}
        >
          <Calendar size={15} strokeWidth={2} className="date-range-picker__pill-calendar" aria-hidden />
          <span className={summary ? 'date-range-picker__pill-value' : 'date-range-picker__pill-placeholder'}>
            {label}
          </span>
          <ChevronDown
            size={15}
            strokeWidth={2.5}
            className={`date-range-picker__pill-chevron ${panelOpen ? 'date-range-picker__pill-chevron--open' : ''}`}
            aria-hidden
          />
        </button>
      </div>
      {mounted && panelOpen ? createPortal(panelContent, document.body) : null}
    </>
  );
}
