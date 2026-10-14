import { useEffect, useState } from 'react';
import { useStore } from '../state/store';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Whether the page is currently dark, for components that draw their own colors. */
export function useIsDark(): boolean {
  const theme = useStore((s) => s.theme);
  const [sysDark, setSysDark] = useState(() => query().matches);
  useEffect(() => {
    const q = query();
    const h = () => setSysDark(q.matches);
    q.addEventListener('change', h);
    return () => q.removeEventListener('change', h);
  }, []);
  return theme === 'system' ? sysDark : theme === 'dark';
}

/** Applies the chosen theme to <html>; `system` leaves it to the media query in the CSS. */
export function useApplyTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
}
