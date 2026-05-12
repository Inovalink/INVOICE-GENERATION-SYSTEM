import Link from 'next/link';
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckSquare,
  FileText,
  Receipt,
  Search,
  User,
  Wrench,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { searchSuggestions } from '@/lib/search/globalSearch';
import SearchDateFilters from './SearchDateFilters';
import './search.css';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Promise<{ query?: string; from?: string; to?: string }>;
};

const KIND_LABEL: Record<string, string> = {
  invoice: 'Invoice',
  payment: 'Payment',
  receipt: 'Receipt',
  client: 'Client',
  service: 'Service',
  task: 'Task',
  keyword: 'Keyword',
  date: 'Date',
  period: 'Period',
};

const KIND_META_LABEL: Record<string, string> = {
  invoice: 'Amount',
  payment: 'Amount',
  receipt: 'Amount',
  client: 'Type',
  service: 'Rate',
  task: 'Status',
  keyword: 'Category',
  date: 'Date',
  period: 'Period',
};

function KindGlyph({ kind }: { kind: string }) {
  const iconProps = { size: 16, strokeWidth: 2.1, 'aria-hidden': true as const };
  switch (kind) {
    case 'invoice':
      return <FileText {...iconProps} />;
    case 'payment':
      return <Banknote {...iconProps} />;
    case 'receipt':
      return <Receipt {...iconProps} />;
    case 'client':
      return <User {...iconProps} />;
    case 'service':
      return <Wrench {...iconProps} />;
    case 'task':
      return <CheckSquare {...iconProps} />;
    case 'date':
    case 'period':
      return <CalendarDays {...iconProps} />;
    default:
      return <Search {...iconProps} />;
  }
}

function toneForSuggestion(kind: string, subLabel?: string): string {
  const statusText = (subLabel ?? '').toLowerCase();
  if (kind === 'invoice') return 'invoice';
  if (statusText.includes('overdue')) return 'overdue';
  if (statusText.includes('pending') || statusText.includes('upcoming')) return 'upcoming';
  if (statusText.includes('paid')) return 'paid';
  if (kind === 'payment') return 'payment';
  if (kind === 'receipt') return 'receipt';
  if (kind === 'keyword') return 'keyword';
  if (kind === 'task') return 'task';
  return 'neutral';
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const query = (sp.query ?? '').trim();
  const from = (sp.from ?? '').trim();
  const to = (sp.to ?? '').trim();
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined;
  const hasValidFrom = Boolean(fromDate && !Number.isNaN(fromDate.getTime()));
  const hasValidTo = Boolean(toDate && !Number.isNaN(toDate.getTime()));
  const suggestions =
    query.length >= 1
      ? await searchSuggestions(prisma, query, 40, {
          from: hasValidFrom ? fromDate : undefined,
          to: hasValidTo ? toDate : undefined,
        })
      : [];

  return (
    <section className="search-page">
      <header className="search-page__header">
        <div className="search-page__header-left">
          <span className="search-page__header-icon" aria-hidden="true">
            <Search size={18} strokeWidth={2.3} />
          </span>
          <div className="search-page__title-wrap">
            <h1 className="search-page__title">
              {query ? (
                <>
                  Results for{' '}
                  <span className="search-page__query-accent">&ldquo;{query}&rdquo;</span>
                </>
              ) : (
                'Search'
              )}
            </h1>
            <p className="search-page__subtitle">
              {query
                ? suggestions.length > 0
                  ? `${suggestions.length} result${suggestions.length === 1 ? '' : 's'} found across invoices, clients, receipts & more.`
                  : 'No matching records found for your query.'
                : 'Search across invoices, clients, receipts, services, and tasks.'}
            </p>
          </div>
        </div>

        {query ? (
          <div className="search-page__count-chip">
            <strong>{suggestions.length}</strong>
            &nbsp;{suggestions.length === 1 ? 'result' : 'results'}
          </div>
        ) : null}
      </header>

      <SearchDateFilters query={query} from={from} to={to} />

      {query ? (
        suggestions.length > 0 ? (
          <ul className="search-page__list" role="list">
            {suggestions.map((s) => {
              const iconTone = toneForSuggestion(s.kind, s.subLabel);
              return (
                <li key={s.id} className="search-page__list-item">
                  <Link
                    href={s.href}
                    className="search-page__result-link"
                    aria-label={`Open ${KIND_LABEL[s.kind] ?? 'result'} ${s.label}`}
                  >
                    <span className={`search-page__icon search-page__icon--tone-${iconTone}`}>
                      <KindGlyph kind={s.kind} />
                    </span>
                    <span className="search-page__result-main">
                      <span className="search-page__title-row">
                        <strong className="search-page__result-title">{s.label}</strong>
                        <span className={`search-page__kind search-page__kind--${s.kind}`}>
                          {KIND_LABEL[s.kind] ?? 'Result'}
                        </span>
                      </span>
                      {s.subLabel ? <span className="search-page__result-sub">{s.subLabel}</span> : null}
                    </span>
                    <span className="search-page__result-side">
                      {s.badge ? (
                        <span className="search-page__badge-wrap">
                          <span className="search-page__badge-label">{KIND_META_LABEL[s.kind] ?? 'Info'}</span>
                          <span className="search-page__badge">{s.badge}</span>
                        </span>
                      ) : null}
                      <span className="search-page__open-hint">
                        Open record
                        <ArrowUpRight size={13} strokeWidth={2.3} aria-hidden />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="search-page__empty">
            <p className="search-page__empty-title">No results yet</p>
            <p className="search-page__empty-text">
              Try another keyword, invoice number, client name, date, or status.
            </p>
          </div>
        )
      ) : (
        <div className="search-page__empty">
          <p className="search-page__empty-title">Start searching</p>
          <p className="search-page__empty-text">
            Type in the top search bar and press Enter, or choose a suggestion to open it directly.
          </p>
        </div>
      )}
    </section>
  );
}
