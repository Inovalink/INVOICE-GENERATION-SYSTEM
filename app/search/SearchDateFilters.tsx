'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import DatePicker from '@/components/ui/DatePicker';

type Props = {
  query: string;
  from: string;
  to: string;
};

export default function SearchDateFilters({ query, from, to }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  const applyRange = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set('query', query);
    else params.delete('query');
    if (fromValue) params.set('from', fromValue);
    else params.delete('from');
    if (toValue) params.set('to', toValue);
    else params.delete('to');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="search-page__filters" role="group" aria-label="Search date range">
      <label className="search-page__filter-field">
        <span className="search-page__filter-label">From</span>
        <DatePicker
          value={fromValue}
          onChange={setFromValue}
          placeholder="From date"
          className="search-page__date-picker"
        />
      </label>
      <label className="search-page__filter-field">
        <span className="search-page__filter-label">To</span>
        <DatePicker
          value={toValue}
          onChange={setToValue}
          placeholder="To date"
          className="search-page__date-picker"
        />
      </label>
      <button type="button" className="search-page__filter-btn" onClick={applyRange}>
        Apply range
      </button>
    </div>
  );
}
