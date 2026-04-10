'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Soft-refresh server data on an interval so dashboard metrics stay current. */
export default function DashboardLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
