import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invoice & Financial Tracking System',
  description: 'Professional invoice and receipt generation system for multi-service businesses',
};

import AppShell from '@/components/layout/AppShell';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <div className="app-layout">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
