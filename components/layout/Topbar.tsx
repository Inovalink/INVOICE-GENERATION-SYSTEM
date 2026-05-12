'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  ChevronDown,
  MoonStar,
  SunMedium,
  MessageCircle,
  PanelLeft,
  FileText,
  User,
  Package,
  CheckSquare,
  Banknote,
  Receipt,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';
import { formatUserDisplayName } from '@/lib/formatUserDisplayName';
import {
  applyTheme,
  getServerThemeSnapshot,
  getThemeSnapshot,
  subscribeTheme,
  type Theme,
} from '@/components/layout/themeStore';
import { useFinancialAlertNotificationsSafe } from '@/components/notifications/FinancialAlertNotifications';
import './Topbar.css';

type MeResponse = {
  authenticated: boolean;
  user?: { email: string; firstName: string; lastName: string };
};

type GlobalSuggestion = {
  id: string;
  kind: 'invoice' | 'payment' | 'receipt' | 'client' | 'service' | 'task' | 'keyword';
  label: string;
  subLabel?: string;
  href: string;
  badge?: string;
};

function KindIcon({ kind }: { kind: GlobalSuggestion['kind'] }) {
  const p = { size: 13, strokeWidth: 2.1, 'aria-hidden': true as const };
  switch (kind) {
    case 'invoice':  return <FileText {...p} />;
    case 'payment':  return <Banknote {...p} />;
    case 'receipt':  return <Receipt {...p} />;
    case 'client':   return <User {...p} />;
    case 'service':  return <Package {...p} />;
    case 'task':     return <CheckSquare {...p} />;
    case 'date':
    case 'period':   return <CalendarDays {...p} />;
    default:         return <Search {...p} />;
  }
}

function initialsForUser(user: { firstName: string; lastName: string; email: string }): string {
  const f = user.firstName.trim();
  const l = user.lastName.trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f.length >= 2) return f.slice(0, 2).toUpperCase();
  if (f) return `${f[0]}${(l[0] ?? user.email[0] ?? '?')}`.toUpperCase();
  if (l.length >= 2) return l.slice(0, 2).toUpperCase();
  if (l) return `${l[0]}${(user.email[0] ?? '?')}`.toUpperCase();
  const e = user.email.trim();
  return e.length >= 2 ? e.slice(0, 2).toUpperCase() : e ? `${e[0]}?`.toUpperCase() : '?';
}

function topbarTitleForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Dashboard';
  if (pathname.startsWith('/finance')) return 'Financial';
  if (pathname.startsWith('/invoices/new')) return 'New invoice';
  if (/^\/invoices\/[^/]+$/.test(pathname)) return 'Invoice';
  if (pathname.startsWith('/invoices')) return 'Invoices';
  if (pathname.startsWith('/clients/new')) return 'New client';
  if (pathname.startsWith('/clients')) return 'Clients';
  if (pathname.startsWith('/services/new')) return 'New service';
  if (pathname.startsWith('/services')) return 'Services';
  if (/^\/receipts\/[^/]+$/.test(pathname)) return 'Receipt';
  if (pathname.startsWith('/receipts')) return 'Receipts';
  if (pathname.startsWith('/search')) return 'Search';
  if (pathname.startsWith('/signup')) return 'Create account';
  if (pathname.startsWith('/login')) return 'Sign in';
  if (pathname.startsWith('/tasks')) return 'Tasks';
  return 'Dashboard';
}

export default function Topbar({
  onToggleSidebar,
  showSidebarToggle = false,
}: {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const title = topbarTitleForPath(pathname);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const [kbdHint, setKbdHint] = useState('⌘K');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<GlobalSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestExpanded, setSuggestExpanded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const financialNotify = useFinancialAlertNotificationsSafe();
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  const refreshMe = useCallback(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then(setMe)
      .catch(() => setMe({ authenticated: false }));
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform ?? navigator.userAgent);
    setKbdHint(mac ? '⌘K' : 'Ctrl+K');
  }, []);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const t = getThemeSnapshot();
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(e.target as Node)
      ) {
        setNotificationPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSearchLoading(false);
      setSuggestOpen(false);
      setSuggestExpanded(false);
      return;
    }
    setSuggestExpanded(false);
    setSearchLoading(true);
    setSuggestOpen(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) throw new Error('Suggestion request failed');
        const body = (await res.json()) as { suggestions?: GlobalSuggestion[] };
        setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []);
        setSuggestOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 110);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const submitSearch = () => {
    const q = searchTerm.trim();
    if (!q) return;
    setSuggestOpen(false);
    router.push(`/search?query=${encodeURIComponent(q)}`);
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    if (typeof window === 'undefined') {
      applyTheme(next);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyTheme(next);
      return;
    }

    const apply = () => {
      flushSync(() => {
        applyTheme(next);
      });
    };

    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(apply);
    } else {
      document.documentElement.classList.add('theme-transitioning');
      apply();
      window.setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 380);
    }
  };

  const user = me?.authenticated ? me.user : undefined;
  const displayName = user
    ? formatUserDisplayName(user.firstName, user.lastName) || user.email
    : me === null
      ? '…'
      : 'Account';
  const displayEmail = user?.email ?? (me === null ? '…' : '');
  const avatarText = user ? initialsForUser(user) : me === null ? '…' : '?';

  return (
    <header className="topbar">
      <div className="topbar-left">
        {showSidebarToggle ? (
          <button
            type="button"
            className="topbar-sidebar-toggle"
            aria-label="Open navigation menu"
            onClick={onToggleSidebar}
          >
            <PanelLeft size={19} />
          </button>
        ) : null}
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-center">
        <div className="search-wrap" ref={searchWrapRef}>
        <div className="search-bar">
          <Search size={16} className="search-icon" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            placeholder='Search anything... e.g. "payment due", "paid", "today", "2026-04-04"'
            className="search-input"
            aria-label="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSuggestOpen(suggestions.length > 0)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitSearch();
              }
              if (e.key === 'Escape') {
                setSuggestOpen(false);
              }
            }}
          />
          <kbd className="search-kbd" title={`Focus search (${kbdHint})`}>
            {kbdHint}
          </kbd>
        </div>
        {suggestOpen && (
          <div className="search-suggest">
            {searchLoading ? (
              <div className="search-suggest__state">Searching...</div>
            ) : suggestions.length === 0 ? (
              <div className="search-suggest__state">No matches yet.</div>
            ) : (() => {
              const VISIBLE = 7;
              const visible = suggestExpanded ? suggestions : suggestions.slice(0, VISIBLE);
              const hiddenCount = Math.max(0, suggestions.length - VISIBLE);
              return (
                <>
                  {visible.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={`search-suggest__item search-suggest__item--${s.kind}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSuggestOpen(false);
                        setSearchTerm(s.label);
                        router.push(s.href);
                      }}
                    >
                      <span className="search-suggest__kind-icon">
                        <KindIcon kind={s.kind} />
                      </span>
                      <span className="search-suggest__body">
                        <span className="search-suggest__label">{s.label}</span>
                        {s.subLabel ? (
                          <span className="search-suggest__sub">{s.subLabel}</span>
                        ) : null}
                      </span>
                      {s.badge ? (
                        <span className={`search-suggest__badge${s.kind !== 'invoice' && s.kind !== 'service' && s.kind !== 'payment' && s.kind !== 'receipt' ? ' search-suggest__badge--entity' : ''}`}>
                          {s.badge}
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {!suggestExpanded && hiddenCount > 0 ? (
                    <button
                      type="button"
                      className="search-suggest__more"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSuggestExpanded(true)}
                    >
                      <ChevronDown size={12} strokeWidth={2.5} aria-hidden />
                      Show {hiddenCount} more result{hiddenCount === 1 ? '' : 's'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="search-suggest__all"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitSearch}
                  >
                    <ArrowRight size={12} strokeWidth={2.5} aria-hidden />
                    View all results for &ldquo;{searchTerm.trim()}&rdquo;
                  </button>
                </>
              );
            })()}
          </div>
        )}
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="action-btn notifications-btn"
          aria-label={
            typeof Notification !== 'undefined' && Notification.permission === 'default'
              ? 'Notifications — click to enable desktop alerts'
              : 'Notifications'
          }
          title="Financial alerts show as toasts automatically. Click to allow desktop notifications (when the browser asks)."
          onClick={async () => {
            setNotificationPanelOpen((open) => !open);
            financialNotify?.markAllNotificationsRead();
            if (
              !me?.authenticated ||
              !financialNotify ||
              typeof Notification === 'undefined' ||
              Notification.permission !== 'default'
            ) {
              return;
            }
            await financialNotify.requestDesktopPermission();
          }}
        >
          {Boolean((financialNotify?.unreadNotificationCount ?? 0) > 0) ? (
            <span className="notification-badge" aria-hidden />
          ) : null}
          <Bell size={20} />
        </button>
        {notificationPanelOpen && (
          <div className="topbar-notifications-panel" ref={notificationPanelRef}>
            <div className="topbar-notifications-panel__header">
              <p className="topbar-notifications-panel__title">Notifications</p>
              <button
                type="button"
                className="topbar-notifications-panel__clear"
                onClick={() => financialNotify?.markAllNotificationsRead()}
              >
                Mark all read
              </button>
            </div>
            <div className="topbar-notifications-panel__list" role="list">
              {(financialNotify?.notificationInbox?.length ?? 0) === 0 ? (
                <p className="topbar-notifications-panel__empty">No notifications yet.</p>
              ) : (
                financialNotify?.notificationInbox.map((item) => (
                  <div
                    key={item.id}
                    className={`topbar-notifications-panel__item ${item.unread ? 'is-unread' : ''}`}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="topbar-notifications-panel__dismiss"
                      onClick={() => financialNotify.dismissNotification(item.id)}
                      aria-label="Dismiss notification"
                    >
                      ×
                    </button>
                    {item.href ? (
                      <button
                        type="button"
                        className="topbar-notifications-panel__body"
                        onClick={() => {
                          setNotificationPanelOpen(false);
                          router.push(item.href!);
                        }}
                      >
                        <span className="topbar-notifications-panel__item-title">{item.title}</span>
                        <span className="topbar-notifications-panel__item-desc">{item.description}</span>
                      </button>
                    ) : (
                      <div className="topbar-notifications-panel__body">
                        <span className="topbar-notifications-panel__item-title">{item.title}</span>
                        <span className="topbar-notifications-panel__item-desc">{item.description}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button type="button" className="action-btn" aria-label="Messages">
          <MessageCircle size={20} />
        </button>

        <button type="button" className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
        </button>

        <div className="user-profile-menu" role="button" tabIndex={0} aria-label="Account menu">
          <div className="avatar-small" aria-hidden>
            {avatarText}
          </div>
          <div className="user-info-small">
            <span className="user-name-small">{displayName}</span>
            {displayEmail ? (
              <span className="user-email-small">{displayEmail}</span>
            ) : null}
          </div>
          <ChevronDown size={14} className="dropdown-icon" aria-hidden />
        </div>
      </div>
    </header>
  );
}
