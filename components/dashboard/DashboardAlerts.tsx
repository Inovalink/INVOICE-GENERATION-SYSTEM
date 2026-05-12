'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  FileText,
  Receipt,
  Send,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import type { DashboardAlertRow } from '@/lib/dashboardAlerts';
import { overdueRiskDisplayLabel } from '@/lib/invoiceDue';
import { useFinancialAlertNotifications } from '@/components/notifications/FinancialAlertNotifications';
import { playFailedSound } from '@/lib/notificationSound';
import './DashboardAlerts.css';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

type ParsedMeta = {
  client: string | null;
  amount: string | null;
  invoiceId: string | null;
};

function parseMeta(a: DashboardAlertRow): ParsedMeta {
  const description = a.description;
  /* Revenue copy is one self-contained sentence; chips would duplicate the body (client fallback used whole string). */
  if (a.kind === 'revenue') {
    return { client: null, amount: null, invoiceId: null };
  }

  const invoiceId = description.match(/Invoice\s+#([A-Za-z0-9-]+)/i)?.[1] ?? null;
  const amount =
    description.match(/(GHS|USD|EUR|GBP|NGN)\s?[\d,]+(?:\.\d+)?/i)?.[0] ?? null;

  let client: string | null = null;
  if (a.kind === 'payment') {
    const from = description.match(/from\s+(.+?)\s*\(Invoice\s+#/i);
    client = from?.[1]?.trim() ?? null;
  } else if (a.kind === 'system' && description.includes(' for ')) {
    const m = description.match(/for\s+([^(\d]+?)\s*\(/);
    client = m?.[1]?.trim() ?? null;
  } else if (a.kind === 'overdue' || a.kind === 'upcoming') {
    const beforeOwed = description.split(/(?:\s+owes\s+|\s+—\s+)/i)[0]?.trim();
    client = beforeOwed && beforeOwed.length < 120 ? beforeOwed : null;
  }

  return { client, amount, invoiceId };
}

function alertHeadline(a: DashboardAlertRow): string {
  if (a.kind === 'overdue') return 'Today - Payment due';
  if (a.kind === 'upcoming') return 'Upcoming - Payment due';
  return a.title;
}

function AlertGlyph({
  kind,
  revenueTrend,
}: {
  kind: DashboardAlertRow['kind'];
  revenueTrend?: DashboardAlertRow['revenueTrend'];
}) {
  const common = { size: 15 as const, strokeWidth: 2.25 as const, 'aria-hidden': true as const };
  switch (kind) {
    case 'payment':
      return <Banknote {...common} />;
    case 'system':
      return <FileText {...common} />;
    case 'receipt':
      return <Receipt {...common} />;
    case 'revenue':
      return revenueTrend === 'up' ? (
        <TrendingUp {...common} className="dashboard-alerts__trend-icon dashboard-alerts__trend-icon--up" />
      ) : (
        <TrendingDown
          {...common}
          className="dashboard-alerts__trend-icon dashboard-alerts__trend-icon--down"
        />
      );
    case 'error':
      return <TriangleAlert {...common} />;
    default:
      return <TriangleAlert {...common} />;
  }
}

const DEFAULT_POLL_MS = 18_000;

/** Buffer for fallback timer (CSS animation duration is set in DashboardAlerts.css). */
const ALERT_EXIT_FALLBACK_MS = 520;

type Props = {
  alerts: DashboardAlertRow[];
  /** When set (?date= on home), polling uses the same day scope as the server. */
  financeDate?: string | null;
  /** Client poll interval; set 0 to disable background refresh. */
  pollIntervalMs?: number;
};

export default function DashboardAlerts({
  alerts: initialAlerts,
  financeDate = null,
  pollIntervalMs = DEFAULT_POLL_MS,
}: Props) {
  const { processSnapshot, resetBaseline } = useFinancialAlertNotifications();
  const scopeKey = financeDate?.trim() ? `day:${financeDate.trim()}` : 'default';

  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [exiting, setExiting] = useState<Record<string, boolean>>({});
  const [exitHeights, setExitHeights] = useState<Record<string, number>>({});
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const dismissFallbackTimers = useRef<Record<string, number>>({});
  const dismissStartedRef = useRef<Set<string>>(new Set());

  const [remoteAlerts, setRemoteAlerts] = useState<DashboardAlertRow[] | null>(null);
  const [liveError, setLiveError] = useState(false);
  const pollErrorEpisodeRef = useRef(false);

  const finishDismiss = useCallback((id: string) => {
    dismissStartedRef.current.delete(id);
    const t = dismissFallbackTimers.current[id];
    if (t) {
      clearTimeout(t);
      delete dismissFallbackTimers.current[id];
    }
    setDismissed((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    setExiting((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExitHeights((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(
    () => () => {
      Object.values(dismissFallbackTimers.current).forEach(clearTimeout);
      dismissFallbackTimers.current = {};
    },
    [],
  );

  const startDismiss = useCallback(
    (id: string) => {
      if (dismissStartedRef.current.has(id)) return;
      dismissStartedRef.current.add(id);

      void fetch('/api/dashboard/alerts/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: id }),
      });

      const measuredHeight = rowRefs.current[id]?.getBoundingClientRect().height ?? 0;
      setExitHeights((prev) => ({ ...prev, [id]: measuredHeight }));
      setExiting((prev) => ({ ...prev, [id]: true }));
      dismissFallbackTimers.current[id] = window.setTimeout(() => {
        delete dismissFallbackTimers.current[id];
        finishDismiss(id);
      }, ALERT_EXIT_FALLBACK_MS);
    },
    [finishDismiss],
  );

  const onExitAnimationEnd = useCallback(
    (id: string, e: AnimationEvent<HTMLLIElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!e.animationName.includes('dashboard-alerts-item-dismiss')) return;
      finishDismiss(id);
    },
    [finishDismiss],
  );

  useEffect(() => {
    resetBaseline(scopeKey);
  }, [financeDate, scopeKey, resetBaseline]);

  useEffect(() => {
    processSnapshot(scopeKey, initialAlerts, { syncOnly: true });
  }, [initialAlerts, scopeKey, processSnapshot]);

  useEffect(() => {
    setRemoteAlerts(null);
    setLiveError(false);
    pollErrorEpisodeRef.current = false;
  }, [financeDate, initialAlerts]);

  const alerts = remoteAlerts ?? initialAlerts;

  const buildPollUrl = useCallback(() => {
    const u = new URL('/api/dashboard/alerts', window.location.origin);
    if (financeDate?.trim()) {
      u.searchParams.set('date', financeDate.trim());
    }
    return u.toString();
  }, [financeDate]);

  useEffect(() => {
    if (pollIntervalMs <= 0) return undefined;

    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(buildPollUrl(), { cache: 'no-store' });
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as { alerts?: unknown };
        if (
          !cancelled &&
          Array.isArray(data.alerts) &&
          data.alerts.every(
            (row) =>
              row &&
              typeof row === 'object' &&
              typeof (row as DashboardAlertRow).id === 'string' &&
              typeof (row as DashboardAlertRow).at === 'string',
          )
        ) {
          const rows = data.alerts as DashboardAlertRow[];
          pollErrorEpisodeRef.current = false;
          processSnapshot(scopeKey, rows);
          setRemoteAlerts(rows);
          setLiveError(false);
        }
      } catch {
        if (!cancelled) {
          setLiveError(true);
          if (!pollErrorEpisodeRef.current) {
            pollErrorEpisodeRef.current = true;
            playFailedSound();
          }
        }
      }
    };

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const intervalMs = reducedMotion ? Math.max(pollIntervalMs, 60_000) : pollIntervalMs;

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);

    const onVis = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [buildPollUrl, pollIntervalMs, processSnapshot, scopeKey]);

  const timeline = useMemo(
    () => [...alerts].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [alerts],
  );

  const visibleTimeline = useMemo(
    () => timeline.filter((a) => !dismissed[a.id]),
    [timeline, dismissed],
  );

  return (
    <section className="dashboard-alerts" aria-label="Financial timeline">
      <div className="dashboard-alerts__header">
        <div className="dashboard-alerts__title-row">
          <h2 className="dashboard-alerts__title">Financial Timeline</h2>
          {pollIntervalMs > 0 ? (
            <span
              className={`dashboard-alerts__live ${liveError ? 'dashboard-alerts__live--error' : ''}`}
              title={
                liveError
                  ? 'Could not refresh timeline; will retry automatically.'
                  : 'Timeline refreshes automatically every few seconds.'
              }
            >
              <span className="dashboard-alerts__live-dot" aria-hidden />
              Live
            </span>
          ) : null}
        </div>
        <Link href="/invoices" className="dashboard-alerts__planner-link">
          Planner view
        </Link>
      </div>

      <div className="dashboard-alerts__today-strip">
        <span className="dashboard-alerts__section-label">Today</span>
        <span className="dashboard-alerts__section-count" aria-label={`${visibleTimeline.length} items`}>
          {visibleTimeline.length}
        </span>
      </div>

      <ul className="dashboard-alerts__list" role="list">
          {visibleTimeline.length === 0 ? (
            <li className="dashboard-alerts__empty">No timeline items right now.</li>
          ) : (
            visibleTimeline.map((a) => {
              const meta = parseMeta(a);
              const isExiting = Boolean(exiting[a.id]);
              return (
                <li
                  key={a.id}
                  className={`dashboard-alerts__item dashboard-alerts__item--${a.kind}${
                    a.kind === 'revenue' && a.revenueTrend
                      ? ` dashboard-alerts__item--revenue-trend-${a.revenueTrend}`
                      : ''
                  }${isExiting ? ' dashboard-alerts__item--exiting' : ''}`}
                  ref={(node) => {
                    rowRefs.current[a.id] = node;
                  }}
                  onAnimationEnd={(e) => onExitAnimationEnd(a.id, e)}
                  style={
                    isExiting
                      ? ({
                          ['--dashboard-alert-exit-height' as string]: `${Math.max(46, exitHeights[a.id] ?? 0)}px`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <div className="dashboard-alerts__accent-bar" aria-hidden />
                  <div className="dashboard-alerts__item-body">
                    <div className="dashboard-alerts__row-head">
                      <span className="dashboard-alerts__status-icon" aria-hidden>
                        <AlertGlyph kind={a.kind} revenueTrend={a.revenueTrend} />
                      </span>
                      <p className="dashboard-alerts__headline">{alertHeadline(a)}</p>
                      <p className="dashboard-alerts__time">{formatTime(a.at)}</p>
                    </div>
                    <p className="dashboard-alerts__desc">{a.description}</p>
                    <div className="dashboard-alerts__meta-chips">
                      {a.kind === 'overdue' && a.overdueRisk ? (
                        <span
                          className={`dashboard-alerts__chip dashboard-alerts__chip--risk dashboard-alerts__chip--risk-${a.overdueRisk}`}
                        >
                          {overdueRiskDisplayLabel(a.overdueRisk)}
                        </span>
                      ) : null}
                      {meta.client ? (
                        <span className="dashboard-alerts__chip">Client: {meta.client}</span>
                      ) : null}
                      {meta.amount ? (
                        <span className="dashboard-alerts__chip">Amount: {meta.amount}</span>
                      ) : null}
                      {meta.invoiceId ? (
                        <span className="dashboard-alerts__chip">Invoice ID: {meta.invoiceId}</span>
                      ) : null}
                    </div>
                    <div className="dashboard-alerts__actions">
                      <div className="dashboard-alerts__actions-secondary">
                        {a.href ? (
                          <Link href={a.href} className="dashboard-alerts__action-btn">
                            <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
                            Open invoice
                          </Link>
                        ) : (
                          <button type="button" className="dashboard-alerts__action-btn" disabled>
                            <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
                            Open invoice
                          </button>
                        )}
                        <button type="button" className="dashboard-alerts__action-btn" disabled>
                          <Send size={14} strokeWidth={2.25} aria-hidden />
                          Send reminder
                        </button>
                      </div>
                      <button
                        type="button"
                        className="dashboard-alerts__complete-btn"
                        disabled={isExiting}
                        onClick={() => startDismiss(a.id)}
                      >
                        <CheckCircle2 size={12} strokeWidth={2} aria-hidden />
                        Mark completed
                      </button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
      </ul>
    </section>
  );
}
