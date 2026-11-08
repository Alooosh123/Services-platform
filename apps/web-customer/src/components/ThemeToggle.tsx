'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = window.localStorage.getItem('asaas-theme');
    const current = document.documentElement.dataset.theme;
    const next: Theme = saved === 'dark' || saved === 'light'
      ? saved
      : current === 'dark' ? 'dark' : 'light';

    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    setTheme(next);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;

    try {
      window.localStorage.setItem('asaas-theme', next);
    } catch {
      // The current page theme still changes when storage is unavailable.
    }

    setTheme(next);
  }

  const label = theme === 'dark' ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن';

  return (
    <button
      type="button"
      className={'asaas-theme-toggle ' + className}
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
    >
      {theme === 'dark'
        ? <Sun aria-hidden="true" size={18} />
        : <Moon aria-hidden="true" size={18} />}
    </button>
  );
}
