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
  PanelLeftClose,
  PanelLeftOpen,
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

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthMe({ authenticated: false });
    router.push('/login');
    router.refresh();
  };

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${isMobile ? 'sidebar--mobile' : ''} ${isMobile && mobileOpen ? 'sidebar--mobile-open' : ''}`}
      aria-hidden={isMobile && !mobileOpen}
    >
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="brand-logo__logo-wrap">
            <div className="logo-icon-brand">
              <FileText size={20} color="white" strokeWidth={3} />
            </div>
            {collapsed && (
              <button
                type="button"
                className="sidebar-collapse-btn sidebar-collapse-btn--floating"
                aria-label="Expand sidebar"
                title="Expand sidebar"
                onClick={onToggleCollapsed}
              >
                <PanelLeftOpen size={26} />
              </button>
            )}
          </div>
          <h2>FinTrack Pro</h2>
        </div>
        {!collapsed && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            onClick={onToggleCollapsed}
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      <div className="sidebar-scrollable">
        <div className="nav-section">
          <h3 className="nav-section-title">Menu</h3>
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
                    title={collapsed ? item.label : undefined}
                    onClick={() => {
                      if (isMobile) onCloseMobile();
                    }}
                  >
                    <Icon size={18} className="nav-icon" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="nav-section nav-section--general">
          <h3 className="nav-section-title">General</h3>
          <ul className="sidebar-nav">
            <li>
              <Link
                href="/settings"
                className="nav-link"
                title={collapsed ? 'Settings' : undefined}
                onClick={() => {
                  if (isMobile) onCloseMobile();
                }}
              >
                <Settings size={18} className="nav-icon" />
                <span>Settings</span>
              </Link>
            </li>
            <li>
              <Link
                href="/help"
                className="nav-link"
                title={collapsed ? 'Help' : undefined}
                onClick={() => {
                  if (isMobile) onCloseMobile();
                }}
              >
                <HelpCircle size={18} className="nav-icon" />
                <span>Help</span>
              </Link>
            </li>
            {authMe?.authenticated ? (
              <li>
                <button
                  type="button"
                  className="nav-link nav-link--button"
                  onClick={logout}
                  title={collapsed ? 'Sign out' : undefined}
                >
                  <LogOut size={18} className="nav-icon" />
                  <span>Sign out</span>
                </button>
              </li>
            ) : (
              <>
                <li>
                  <Link
                    href="/login"
                    className="nav-link"
                    title={collapsed ? 'Sign in' : undefined}
                    onClick={() => {
                      if (isMobile) onCloseMobile();
                    }}
                  >
                    <LogIn size={18} className="nav-icon" />
                    <span>Sign in</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup"
                    className="nav-link nav-link--accent"
                    title={collapsed ? 'Sign up' : undefined}
                    onClick={() => {
                      if (isMobile) onCloseMobile();
                    }}
                  >
                    <Users size={18} className="nav-icon" />
                    <span>Sign up</span>
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
