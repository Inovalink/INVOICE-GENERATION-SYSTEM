'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Banknote, FileText, Receipt, TrendingDown, TrendingUp, TriangleAlert, X } from 'lucide-react';
import type { DashboardAlertRow } from '@/lib/dashboardAlerts';
import {
  flushPendingDashboardAlertPushes,
  setDashboardAlertPushListener,
} from '@/lib/dashboardAlertNotifications';
import '@/components/dashboard/AlertPushDock.css';

const DEDUPE_MS = 50_000;
const TOAST_MS = 5_200;
const MAX_STACK = 5;

function toastTitle(a: DashboardAlertRow): string {
  if (a.kind === 'overdue') return 'Payment due';
  if (a.kind === 'upcoming') return 'Upcoming payment';
  return a.title;
}

function clipBody(s: string, max = 160): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function relativeTimeLabel(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Just now';
  const diff = Date.now() - t;
  if (diff < 45_000) return 'Just now';
  if (diff < 3600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function ctaLabel(alert: DashboardAlertRow): string {
  if (alert.kind === 'receipt') return 'View receipt';
  if (alert.kind === 'payment') return 'View details';
  return 'Open';
}

function PushIcon({
  kind,
  revenueTrend,
}: {
  kind: DashboardAlertRow['kind'];
  revenueTrend?: DashboardAlertRow['revenueTrend'];
}) {
  const c = { size: 22 as const, strokeWidth: 2.25 as const, 'aria-hidden': true as const };
  switch (kind) {
    case 'payment':
      return <Banknote {...c} />;
    case 'system':
      return <FileText {...c} />;
    case 'receipt':
      return <Receipt {...c} />;
    case 'revenue':
      return revenueTrend === 'up' ? <TrendingUp {...c} /> : <TrendingDown {...c} />;
    default:
      return <TriangleAlert {...c} />;
  }
}

type ToastEntry = { reactKey: string; alert: DashboardAlertRow };

type ActivityToastInput = {
  title: string;
  description?: string;
  href?: string | null;
  kind?: DashboardAlertRow['kind'];
};

type Ctx = {
  processSnapshot: (
    scopeKey: string,
    alerts: DashboardAlertRow[],
    opts?: { syncOnly?: boolean },
  ) => void;
  resetBaseline: (scopeKey: string) => void;
  requestDesktopPermission: () => Promise<NotificationPermission | null>;
  desktopPermission: NotificationPermission | 'unsupported';
  pushActivityNotification: (input: ActivityToastInput) => void;
  notificationInbox: DashboardAlertRow[];
  unreadNotificationCount: number;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
};

const FinancialAlertNotificationsContext = createContext<Ctx | null>(null);

function FinancialAlertToast({
  entry,
  dismiss,
}: {
  entry: ToastEntry;
  dismiss: (reactKey: string) => void;
}) {
  const { alert } = entry;
  const reactKey = entry.reactKey;

  useEffect(() => {
    const t = window.setTimeout(() => dismiss(reactKey), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [dismiss, reactKey]);

  const iconClass = [
    'financial-push-card__icon',
    `financial-push-card__icon--kind-${alert.kind}`,
    alert.kind === 'revenue' && alert.revenueTrend
      ? `financial-push-card__icon--revenue-${alert.revenueTrend}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="financial-push-card financial-push-card--enter" role="status">
      <div className="financial-push-card__top">
        <div className="financial-push-card__main">
          <div className={iconClass} aria-hidden>
            <PushIcon kind={alert.kind} revenueTrend={alert.revenueTrend} />
          </div>
          <div className="financial-push-card__topline">
            <p className="financial-push-card__title">{toastTitle(alert)}</p>
            <button
              type="button"
              className="financial-push-card__close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(reactKey)}
            >
              <X size={16} strokeWidth={2.25} />
            </button>
          </div>
          <p className="financial-push-card__desc">{clipBody(alert.description)}</p>
          <p className="financial-push-card__time">{relativeTimeLabel(alert.at)}</p>
          {alert.href ? (
            <Link href={alert.href} className="financial-push-card__cta">
              {ctaLabel(alert)} <span aria-hidden>&gt;</span>
            </Link>
          ) : null}
        </div>
      </div>
      <div className="financial-push-card__progress" aria-hidden>
        <div
          className="financial-push-card__progress-bar"
          style={{ ['--push-duration' as string]: `${TOAST_MS}ms` }}
        />
      </div>
    </div>
  );
}

export function FinancialAlertNotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [notificationInbox, setNotificationInbox] = useState<DashboardAlertRow[]>([]);
  const baselinesRef = useRef<Record<string, Set<string>>>({});
  const dedupeRef = useRef<Map<string, number>>(new Map());
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission | 'unsupported'>(
    'unsupported',
  );

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setDesktopPermission('unsupported');
      return;
    }
    setDesktopPermission(Notification.permission);
  }, []);

  const emitToast = useCallback((row: DashboardAlertRow) => {
    const now = Date.now();
    const last = dedupeRef.current.get(row.id) ?? 0;
    if (now - last < DEDUPE_MS) return;
    dedupeRef.current.set(row.id, now);
    if (dedupeRef.current.size > 400) {
      const cutoff = now - DEDUPE_MS * 4;
      for (const [k, t] of dedupeRef.current) {
        if (t < cutoff) dedupeRef.current.delete(k);
      }
    }

    const reactKey = `${row.id}-${now}`;
    setToasts((prev) => [...prev.slice(-(MAX_STACK - 1)), { reactKey, alert: row }]);
    setNotificationInbox((prev) => {
      const nextRow: DashboardAlertRow = { ...row, unread: true };
      const existingIdx = prev.findIndex((item) => item.id === row.id);
      if (existingIdx === -1) {
        return [nextRow, ...prev].slice(0, 50);
      }
      const next = [...prev];
      next[existingIdx] = nextRow;
      next.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      return next;
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(toastTitle(row), {
          body: clipBody(row.description, 200),
          tag: row.id,
        });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const pushActivityNotification = useCallback(
    (input: ActivityToastInput) => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const row: DashboardAlertRow = {
        id: `ft-activity-${suffix}`,
        kind: input.kind ?? 'system',
        title: input.title,
        description: input.description ?? '',
        at: new Date().toISOString(),
        unread: true,
        iconVariant: 'bill',
        href: input.href ?? undefined,
      };
      emitToast(row);
    },
    [emitToast],
  );

  useLayoutEffect(() => {
    setDashboardAlertPushListener((rows) => {
      rows.forEach((r) => emitToast(r));
    });
    flushPendingDashboardAlertPushes(emitToast);
    return () => setDashboardAlertPushListener(null);
  }, [emitToast]);

  const processSnapshot = useCallback(
    (scopeKey: string, alerts: DashboardAlertRow[], opts?: { syncOnly?: boolean }) => {
      const key = scopeKey || 'default';
      const nextIds = new Set(alerts.map((a) => a.id));
      if (opts?.syncOnly) {
        baselinesRef.current[key] = nextIds;
        return;
      }
      const prev = baselinesRef.current[key];
      if (!prev) {
        baselinesRef.current[key] = nextIds;
        return;
      }
      for (const row of alerts) {
        if (!prev.has(row.id)) emitToast(row);
      }
      baselinesRef.current[key] = nextIds;
    },
    [emitToast],
  );

  const resetBaseline = useCallback((scopeKey: string) => {
    delete baselinesRef.current[scopeKey || 'default'];
  }, []);

  const requestDesktopPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return null;
    try {
      const p = await Notification.requestPermission();
      setDesktopPermission(p);
      return p;
    } catch {
      return null;
    }
  }, []);

  const dismiss = useCallback((reactKey: string) => {
    setToasts((prev) => prev.filter((t) => t.reactKey !== reactKey));
  }, []);

  const unreadNotificationCount = useMemo(
    () => notificationInbox.reduce((count, item) => (item.unread ? count + 1 : count), 0),
    [notificationInbox],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotificationInbox((prev) =>
      prev.map((item) => (item.unread ? { ...item, unread: false } : item)),
    );
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotificationInbox((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const ctx = useMemo(
    () => ({
      processSnapshot,
      resetBaseline,
      requestDesktopPermission,
      desktopPermission,
      pushActivityNotification,
      notificationInbox,
      unreadNotificationCount,
      markAllNotificationsRead,
      dismissNotification,
    }),
    [
      processSnapshot,
      resetBaseline,
      requestDesktopPermission,
      desktopPermission,
      pushActivityNotification,
      notificationInbox,
      unreadNotificationCount,
      markAllNotificationsRead,
      dismissNotification,
    ],
  );

  return (
    <FinancialAlertNotificationsContext.Provider value={ctx}>
      {children}
      <div
        className="alert-push-dock financial-alert-push-dock"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Financial alert notifications"
      >
        {toasts.map((t) => (
          <FinancialAlertToast key={t.reactKey} entry={t} dismiss={dismiss} />
        ))}
      </div>
    </FinancialAlertNotificationsContext.Provider>
  );
}

export function useFinancialAlertNotifications(): Ctx {
  const v = useContext(FinancialAlertNotificationsContext);
  if (!v) {
    throw new Error('useFinancialAlertNotifications must be used within FinancialAlertNotificationsProvider');
  }
  return v;
}

/** Optional: use when provider is not mounted (e.g. tests). */
export function useFinancialAlertNotificationsSafe(): Ctx | null {
  return useContext(FinancialAlertNotificationsContext);
}

export function GlobalFinancialAlertSubscriber({ enabled }: { enabled: boolean }) {
  const ctx = useFinancialAlertNotificationsSafe();
  const processSnapshot = ctx?.processSnapshot;

  useEffect(() => {
    if (!enabled || !processSnapshot) return undefined;

    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/dashboard/alerts', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { alerts?: unknown };
        if (
          cancelled ||
          !Array.isArray(data.alerts) ||
          !data.alerts.every(
            (row) =>
              row &&
              typeof row === 'object' &&
              typeof (row as DashboardAlertRow).id === 'string',
          )
        ) {
          return;
        }
        processSnapshot('default', data.alerts as DashboardAlertRow[]);
      } catch {
        /* ignore */
      }
    };

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const intervalMs = reducedMotion ? 45_000 : 8_000;

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
  }, [enabled, processSnapshot]);

  return null;
}
