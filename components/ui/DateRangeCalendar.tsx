'use client';

import { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';

import 'react-day-picker/style.css';
import './DateRangeCalendar.css';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, mo, d] = s.split('-').map(Number);
  if (!y || !mo || !d) return undefined;
  const x = new Date(y, mo - 1, d);
  x.setHours(0, 0, 0, 0);
  return Number.isNaN(x.getTime()) ? undefined : x;
}

type Props = {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  /** Called after state updates when both ends of the range are set. */
  onRangeComplete?: () => void;
  className?: string;
};

export default function DateRangeCalendar({
  dateFrom,
  dateTo,
  onChange,
  onRangeComplete,
  className,
}: Props) {
  const selected: DateRange | undefined = useMemo(() => {
    const from = parseYmd(dateFrom);
    const to = parseYmd(dateTo);
    if (!from && !to) return undefined;
    return { from, to };
  }, [dateFrom, dateTo]);

  const defaultMonth = selected?.from ?? selected?.to ?? new Date();

  const formatters = useMemo(
    () => ({
      formatWeekdayName: (date: Date) =>
        date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2),
    }),
    [],
  );

  return (
    <div className={`date-range-calendar ${className ?? ''}`.trim()}>
      <DayPicker
        mode="range"
        weekStartsOn={1}
        showOutsideDays
        numberOfMonths={1}
        captionLayout="label"
        navLayout="around"
        animate={false}
        selected={selected}
        defaultMonth={defaultMonth}
        formatters={formatters}
        onSelect={(range) => {
          if (!range) {
            onChange('', '');
            return;
          }
          if (!range.from) {
            onChange('', '');
            return;
          }
          const fromStr = toYmd(range.from);
          const toStr = range.to ? toYmd(range.to) : '';
          onChange(fromStr, toStr);
          if (range.to) {
            onRangeComplete?.();
          }
        }}
      />
    </div>
  );
}
