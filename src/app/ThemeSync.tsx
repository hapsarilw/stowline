import { useEffect } from 'react';
import { useViewStore } from '@/state/view-store';

/** Puts the chosen theme on <html>, where the token variables read it (FR-11). */
export function ThemeSync() {
  const theme = useViewStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return null;
}
