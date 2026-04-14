'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Dispatch, SetStateAction } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  Receipt,
  Settings,
  HelpCircle,
  LogOut,
  ClipboardList,
  ListTodo,
  LogIn,
  PanelLeft,
} from 'lucide-react';
import './Sidebar.css';
import type { AuthMeClientState } from '@/lib/auth/authMeClient';

const menuItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'Clients', href: '/clients', icon: Users },
  { label: 'Services', href: '/services', icon: Briefcase },
  { label: 'Invoices', href: '/invoices', icon: ClipboardList },
  { label: 'Receipts', href: '/receipts', icon: Receipt },
];

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
  isMobile,
  mobileOpen,
  onCloseMobile,
  authMe,
  setAuthMe,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  authMe: AuthMeClientState;
  setAuthMe: Dispatch<SetStateAction<AuthMeClientState>>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const railCollapsed = collapsed && !isMobile;
  /** One size for expanded + collapsing rail so icons don’t jump in scale mid-transition */
  const navIconSize = 22;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthMe({ authenticated: false });
    router.push('/login');
    router.refresh();
  };

  return (
    <aside
      className={`sidebar ${railCollapsed ? 'sidebar--collapsed' : ''} ${isMobile ? 'sidebar--mobile' : ''} ${isMobile && mobileOpen ? 'sidebar--mobile-open' : ''}`}
      aria-hidden={isMobile && !mobileOpen}
    >
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div
            className={
              railCollapsed
                ? 'sidebar-brand__mark sidebar-brand__mark--rail'
                : 'sidebar-brand__mark'
            }
          >
            <div className="sidebar-brand__icon" aria-hidden>
              <FileText size={18} strokeWidth={2.35} className="sidebar-brand__icon-svg" />
            </div>
            {railCollapsed && (
              <button
                type="button"
                className="sidebar-brand__rail-toggle"
                aria-label="Expand sidebar"
                title="Expand sidebar"
                onClick={onToggleCollapsed}
              >
                <PanelLeft size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
          <div className="sidebar-brand__title" aria-hidden={railCollapsed}>
            FinTrack Pro
          </div>
        </div>
        {!railCollapsed && (
          <div className="sidebar-header__actions">
            <button
              type="button"
              className="sidebar-header__toggle sidebar-header__toggle--collapse"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={onToggleCollapsed}
            >
              <PanelLeft size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-scrollable">
        <div className="nav-section">
          <h3 className="nav-section-title" aria-hidden={railCollapsed}>
            Menu
          </h3>
          <ul className="sidebar-nav">
            {menuItems.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    title={railCollapsed ? item.label : undefined}
                    onClick={() => {
                      if (isMobile) onCloseMobile();
                    }}
                  >
                    <Icon size={navIconSize} className="nav-icon" />
                    <span className="nav-link__label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="nav-section nav-section--general">
          <h3 className="nav-section-title" aria-hidden={railCollapsed}>
            General
          </h3>
          <ul className="sidebar-nav">
            <li>
              <Link
                href="/settings"
                className="nav-link"
                title={railCollapsed ? 'Settings' : undefined}
                onClick={() => {
                  if (isMobile) onCloseMobile();
                }}
              >
                <Settings size={navIconSize} className="nav-icon" />
                <span className="nav-link__label">Settings</span>
              </Link>
            </li>
            <li>
              <Link
                href="/help"
                className="nav-link"
                title={railCollapsed ? 'Help' : undefined}
                onClick={() => {
                  if (isMobile) onCloseMobile();
                }}
              >
                <HelpCircle size={navIconSize} className="nav-icon" />
                <span className="nav-link__label">Help</span>
              </Link>
            </li>
            {authMe?.authenticated ? (
              <li>
                <button
                  type="button"
                  className="nav-link nav-link--button"
                  onClick={logout}
                  title={railCollapsed ? 'Sign out' : undefined}
                >
                  <LogOut size={navIconSize} className="nav-icon" />
                  <span className="nav-link__label">Sign out</span>
                </button>
              </li>
            ) : (
              <>
                <li>
                  <Link
                    href="/login"
                    className="nav-link"
                    title={railCollapsed ? 'Sign in' : undefined}
                    onClick={() => {
                      if (isMobile) onCloseMobile();
                    }}
                  >
                    <LogIn size={navIconSize} className="nav-icon" />
                    <span className="nav-link__label">Sign in</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup"
                    className="nav-link nav-link--accent"
                    title={railCollapsed ? 'Sign up' : undefined}
                    onClick={() => {
                      if (isMobile) onCloseMobile();
                    }}
                  >
                    <Users size={navIconSize} className="nav-icon" />
                    <span className="nav-link__label">Sign up</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
}
