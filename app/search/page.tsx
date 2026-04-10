import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { searchSuggestions } from '@/lib/search/globalSearch';
import '../dashboard.css';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Promise<{ query?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const query = (sp.query ?? '').trim();
  const suggestions = query.length >= 2 ? await searchSuggestions(prisma, query, 40) : [];

  return (
    <div className="content-card" style={{ maxWidth: 720 }}>
      <div className="content-card-header">
        <h1>Search</h1>
        {query ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Results for &quot;{query}&quot;{suggestions.length === 0 ? ' — no matches.' : ''}
          </p>
        ) : (
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Enter a term in the top bar search (at least 2 characters).
          </p>
        )}
      </div>
      {suggestions.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
          {suggestions.map((s) => (
            <li key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <Link
                href={s.href}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.75rem 0',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span>
                  <strong>{s.label}</strong>
                  {s.subLabel ? (
                    <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {s.subLabel}
                    </span>
                  ) : null}
                </span>
                {s.badge ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.badge}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
