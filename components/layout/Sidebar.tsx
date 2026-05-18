'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Dispatch, SetStateAction } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Package,
  FileText,
  Receipt,
  Settings2,
  HelpCircle,
  LogOut,
  LogIn,
  UserPlus,
  BarChart3,
  PanelLeft,
} from 'lucide-react';
import './Sidebar.css';
import type { AuthMeClientState } from '@/lib/auth/authMeClient';

const menuItems = [
  { label: 'Dashboard', href: '/',         icon: LayoutDashboard },
  { label: 'Tasks',     href: '/tasks',    icon: CheckSquare },
  { label: 'Clients',   href: '/clients',  icon: Users },
  { label: 'Services',  href: '/services', icon: Package },
  { label: 'Invoices',  href: '/invoices', icon: FileText },
  { label: 'Receipts',  href: '/receipts', icon: Receipt },
];

function userInitials(u: { firstName: string; lastName: string; email: string }): string {
  const f = u.firstName.trim();
  const l = u.lastName.trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f.length >= 2) return f.slice(0, 2).toUpperCase();
  const e = u.email.trim();
  return e.length >= 2 ? e.slice(0, 2).toUpperCase() : '??';
}

function userDisplayName(u: { firstName: string; lastName: string }): string {
  return [u.firstName.trim(), u.lastName.trim()].filter(Boolean).join(' ') || 'User';
}

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
  const router   = useRouter();
  const railCollapsed = collapsed && !isMobile;
  const iconSize = 21;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthMe({ authenticated: false });
    router.push('/login');
    router.refresh();
  };

  const user = authMe?.authenticated ? authMe.user : null;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className={[
        'sidebar',
        railCollapsed          ? 'sidebar--collapsed'    : '',
        isMobile               ? 'sidebar--mobile'       : '',
        isMobile && mobileOpen ? 'sidebar--mobile-open'  : '',
      ].filter(Boolean).join(' ')}
      aria-hidden={isMobile && !mobileOpen}
    >

      {/* ── Brand / Header ─────────────────────────────── */}
      <div className="sidebar-header">
        <div className="sidebar-brand">

          {/* Logo mark — rail-toggle overlays on hover when collapsed */}
          <div className="sidebar-brand__mark">
            <div className="sidebar-brand__icon" aria-hidden>
              <BarChart3 size={17} strokeWidth={2.4} className="sidebar-brand__icon-svg" />
            </div>
            {railCollapsed && (
              <button
                type="button"
                className="sidebar-brand__rail-toggle"
                aria-label="Expand sidebar"
                title="Expand sidebar"
                onClick={onToggleCollapsed}
              >
                <PanelLeft size={15} strokeWidth={2.1} aria-hidden />
              </button>
            )}
          </div>

          {/* Name + Pro badge — animates away when collapsing */}
          <div className="sidebar-brand__text" aria-hidden={railCollapsed}>
            <span className="sidebar-brand__name">FinTrack</span>
            <span className="sidebar-brand__badge">Pro</span>
          </div>
        </div>

        {/* Collapse button — only visible when expanded */}
        {!railCollapsed && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            onClick={onToggleCollapsed}
          >
            <PanelLeft size={15} strokeWidth={2.1} aria-hidden />
          </button>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────── */}
      <div className="sidebar-scrollable">

        {/* Main */}
        <nav className="nav-section" aria-label="Main navigation">
          <p className="nav-section-label" aria-hidden="true">Main</p>
          <ul className="sidebar-nav" role="list">
            {menuItems.map((item) => {
              const active = isActive(item.href);
              const Icon   = item.icon;
              return (
                <li
                  key={item.href}
                  className={`sidebar-nav__item${active ? ' sidebar-nav__item--active' : ''}`}
                >
                  <Link
                    href={item.href}
                    className={`nav-link${active ? ' active' : ''}`}
                    title={railCollapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => { if (isMobile) onCloseMobile(); }}
                  >
                    <span className="nav-icon-wrap" aria-hidden>
                      <Icon size={iconSize} strokeWidth={active ? 2.2 : 1.85} />
                    </span>
                    <span className="nav-link__label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Section divider */}
        <div className="nav-divider" role="separator" aria-hidden />

        {/* General */}
        <nav className="nav-section" aria-label="General">
          <p className="nav-section-label" aria-hidden="true">General</p>
          <ul className="sidebar-nav" role="list">

            <li className={`sidebar-nav__item${isActive('/settings') ? ' sidebar-nav__item--active' : ''}`}>
              <Link
                href="/settings"
                className={`nav-link${isActive('/settings') ? ' active' : ''}`}
                title={railCollapsed ? 'Settings' : undefined}
                aria-current={isActive('/settings') ? 'page' : undefined}
                onClick={() => { if (isMobile) onCloseMobile(); }}
              >
                <span className="nav-icon-wrap" aria-hidden>
                  <Settings2 size={iconSize} strokeWidth={1.85} />
                </span>
                <span className="nav-link__label">Settings</span>
              </Link>
            </li>

            <li className={`sidebar-nav__item${isActive('/help') ? ' sidebar-nav__item--active' : ''}`}>
              <Link
                href="/help"
                className={`nav-link${isActive('/help') ? ' active' : ''}`}
                title={railCollapsed ? 'Help & Support' : undefined}
                onClick={() => { if (isMobile) onCloseMobile(); }}
              >
                <span className="nav-icon-wrap" aria-hidden>
                  <HelpCircle size={iconSize} strokeWidth={1.85} />
                </span>
                <span className="nav-link__label">Help &amp; Support</span>
              </Link>
            </li>

            {/* Logout — authenticated users */}
            {authMe?.authenticated && (
              <li className="sidebar-nav__item">
                <button
                  type="button"
                  className="nav-link nav-link--button nav-link--logout"
                  title={railCollapsed ? 'Logout' : undefined}
                  onClick={logout}
                >
                  <span className="nav-icon-wrap" aria-hidden>
                    <LogOut size={iconSize} strokeWidth={1.85} />
                  </span>
                  <span className="nav-link__label">Logout</span>
                </button>
              </li>
            )}

            {/* Auth links for unauthenticated users */}
            {!authMe?.authenticated && (
              <>
                <li className="sidebar-nav__item">
                  <Link
                    href="/login"
                    className="nav-link"
                    title={railCollapsed ? 'Sign in' : undefined}
                    onClick={() => { if (isMobile) onCloseMobile(); }}
                  >
                    <span className="nav-icon-wrap" aria-hidden>
                      <LogIn size={iconSize} strokeWidth={1.85} />
                    </span>
                    <span className="nav-link__label">Sign in</span>
                  </Link>
                </li>
                <li className="sidebar-nav__item">
                  <Link
                    href="/signup"
                    className="nav-link nav-link--cta"
                    title={railCollapsed ? 'Sign up' : undefined}
                    onClick={() => { if (isMobile) onCloseMobile(); }}
                  >
                    <span className="nav-icon-wrap" aria-hidden>
                      <UserPlus size={iconSize} strokeWidth={1.85} />
                    </span>
                    <span className="nav-link__label">Sign up</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>

      {/* ── User Profile Footer ─────────────────────────── */}
      {user && (
        <div className={`sidebar-user${railCollapsed ? ' sidebar-user--rail' : ''}`}>
          <div className="sidebar-user__avatar" title={railCollapsed ? userDisplayName(user) : undefined}>
            {userInitials(user)}
          </div>
          <div className="sidebar-user__info">
            <p className="sidebar-user__name">{userDisplayName(user)}</p>
            <p className="sidebar-user__email">{user.email}</p>
          </div>
          <button
            type="button"
            className="sidebar-user__signout"
            aria-label="Sign out"
            title="Sign out"
            onClick={logout}
          >
            <LogOut size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}

    </aside>
  );
}
