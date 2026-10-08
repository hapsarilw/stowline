import { readPalette, type Palette } from '../colors';

// Scene colors of the current theme (THEMES.*.g in the design), from the --g-* variables.

export interface SceneTheme extends Palette {
  hull: string;
  hullIn: string;
  hullLine: string;
  deck: string;
  house: string;
  edge: string;
  water: string;
  accent: string;
  text: string;
  ok: string;
}

const cssVar = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function readSceneTheme(): SceneTheme {
  return {
    ...readPalette(),
    hull: cssVar('--g-hull', '#1a2640'),
    hullIn: cssVar('--g-hull-in', '#0e1626'),
    hullLine: cssVar('--g-hull-line', '#3a4b6b'),
    deck: cssVar('--g-deck', '#1c2943'),
    house: cssVar('--g-house', '#c3ccda'),
    edge: cssVar('--g-edge', 'rgba(8, 13, 24, 0.6)'),
    water: cssVar('--g-water', 'rgba(59, 158, 255, 0.75)'),
    accent: cssVar('--g-accent', '#3b9eff'),
    text: cssVar('--g-text', '#e6edf7'),
    ok: cssVar('--g-ok', '#2fd08a'),
  };
}

/** Calls back after the theme attribute on <html> changes and the new variables apply. */
export function onThemeChange(callback: () => void): () => void {
  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
