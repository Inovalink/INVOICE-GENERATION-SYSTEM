'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './DatePicker.css';

type DatePickerProps = {
  value: string; // YYYY-MM-DD or ''
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseLocal(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
  disabled,
}: DatePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = parseLocal(value);
  if (selected) {
    selected.setHours(0, 0, 0, 0);
  }

  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [viewYear, setViewYear] = useState(
    selected?.getFullYear() ?? today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    selected?.getMonth() ?? today.getMonth(),
  );

  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]);

  useLayoutEffect(() => {
    if (!open) {
      setAlignRight(false);
      return;
    }
    if (!popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      setAlignRight(true);
    }
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayClick = (day: number) => {
    const picked = new Date(viewYear, viewMonth, day);
    onChange(toLocalISO(picked));
    setOpen(false);
  };

  const displayValue = selected
    ? selected.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className={`dp-root ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className={`dp-trigger ${open ? 'dp-trigger--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="dp-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect
            x="2"
            y="3"
            width="12"
            height="11"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M2 7h12" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M5 2v2M11 2v2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span className={displayValue ? 'dp-value' : 'dp-placeholder'}>
          {displayValue || placeholder}
        </span>
      </button>

      {open && !disabled && (
        <div ref={popupRef} className={`dp-popup${alignRight ? ' dp-popup--right' : ''}`}>
          <div className="dp-popup-inner">
            <div className="dp-header">
              <button
                type="button"
                className="dp-nav"
                onClick={prevMonth}
                aria-label="Previous month"
              >
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 12L6 8l4-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <span className="dp-month-year">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                className="dp-nav"
                onClick={nextMonth}
                aria-label="Next month"
              >
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="dp-grid">
              {DAYS.map((d) => (
                <span key={d} className="dp-dow">
                  {d}
                </span>
              ))}

              {cells.map((day, i) => {
                if (!day) return <span key={`empty-${i}`} className="dp-empty-cell" />;

                const cellDate = new Date(viewYear, viewMonth, day);
                cellDate.setHours(0, 0, 0, 0);

                const isToday = cellDate.getTime() === today.getTime();
                const isSelected = selected
                  ? cellDate.getTime() === selected.getTime()
                  : false;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={[
                      'dp-day',
                      isToday && !isSelected ? 'dp-day--today' : '',
                      isSelected ? 'dp-day--selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="dp-footer">
              <button
                type="button"
                className="dp-today-btn"
                onClick={() => {
                  onChange(toLocalISO(today));
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

