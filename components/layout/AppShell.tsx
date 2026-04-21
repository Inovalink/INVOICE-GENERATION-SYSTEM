'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import FinancialActivityFlash from '@/components/notifications/FinancialActivityFlash';
import {
  FinancialAlertNotificationsProvider,
  GlobalFinancialAlertSubscriber,
} from '@/components/notifications/FinancialAlertNotifications';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import type { AuthMeClientState } from '@/lib/auth/authMeClient';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === '/login' || pathname.startsWith('/signup');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [authMe, setAuthMe] = useState<AuthMeClientState>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then(setAuthMe)
      .catch(() => setAuthMe({ authenticated: false }));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (collapsed && !isMobile) {
      root.setAttribute('data-sidebar-collapsed', '');
    } else {
      root.removeAttribute('data-sidebar-collapsed');
    }
    return () => root.removeAttribute('data-sidebar-collapsed');
  }, [collapsed, isMobile]);

  const onToggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);
  const onCloseMobile = useCallback(() => setMobileOpen(false), []);
  const onToggleMobileSidebar = useCallback(() => setMobileOpen((o) => !o), []);

  if (isAuthRoute) {
    return (
      <main className="main-content main-content--auth">
        <div className="page-container page-container--auth">{children}</div>
      </main>
    );
  }

  return (
    <FinancialAlertNotificationsProvider>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onCloseMobile={onCloseMobile}
        authMe={authMe}
        setAuthMe={setAuthMe}
      />
      <main className="main-content">
        <Topbar showSidebarToggle={isMobile} onToggleSidebar={onToggleMobileSidebar} />
        <div className="page-container">{children}</div>
      </main>
      <Suspense fallback={null}>
        <FinancialActivityFlash />
      </Suspense>
      <GlobalFinancialAlertSubscriber enabled={Boolean(authMe?.authenticated)} />
    </FinancialAlertNotificationsProvider>
  );
}
