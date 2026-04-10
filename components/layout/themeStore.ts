'use client';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

const listeners = new Set<() => void>();

export function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getServerThemeSnapshot(): Theme {
  return 'light';
}

export function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  listeners.add(onStoreChange);

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onMql = () => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) onStoreChange();
    } catch {
      onStoreChange();
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onStoreChange();
  };

  mql.addEventListener('change', onMql);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onStoreChange);
    mql.removeEventListener('change', onMql);
    window.removeEventListener('storage', onStorage);
  };
}

export function applyTheme(next: Theme) {
  if (typeof document === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  document.documentElement.classList.toggle('dark', next === 'dark');
  listeners.forEach((l) => l());
}
