import { PODS, POD_LIST, type Container, type ContainerType } from '@/domain';

// Color modes of the 3D view (FR-20) and their legends, from design/stow3d.js and buildVM.
// No three.js here, so the toolbar and the legend can use it outside the 3D chunk.

export type ColorMode = 'pod' | 'weight' | 'type' | 'viol';

export const COLOR_MODES: readonly { id: ColorMode; label: string }[] = [
  { id: 'pod', label: 'POD' },
  { id: 'weight', label: 'Weight' },
  { id: 'type', label: 'Type' },
  { id: 'viol', label: 'Violations' },
];

/** Upper bound (exclusive) of each weight band, in tonnes, and its color. */
export const WEIGHT_SCALE: readonly { below: number; color: string; label: string }[] = [
  { below: 8, color: '#22406e', label: '<8' },
  { below: 14, color: '#38699a', label: '8–14' },
  { below: 20, color: '#5b97c0', label: '14–20' },
  { below: 26, color: '#a9cbdd', label: '20–26' },
  { below: Infinity, color: '#f2d35b', label: '≥26' },
];

export const TYPE_COLORS: Readonly<Record<ContainerType, string>> = {
  '40HC': '#7d8ca8',
  '40GP': '#56647d',
  '20GP': '#9aa9bf',
  RF: '#cfeaf6',
  TK: '#e3b25a',
  OT: '#b7997a',
};

const TYPE_LEGEND: readonly ContainerType[] = ['40HC', '40GP', '20GP', 'RF', 'TK', 'OT'];

/** Colors that depend on the theme, read from the CSS variables. */
export interface Palette {
  pods: Readonly<Record<string, string>>;
  err: string;
  warn: string;
  neutral: string;
  dim: string;
  bg: string;
}

export const weightColor = (t: number): string => WEIGHT_SCALE.find((b) => t < b.below)!.color;

export function containerColor(
  mode: ColorMode,
  c: Pick<Container, 'pod' | 'type' | 'weightT'>,
  severity: 'error' | 'warning' | null,
  palette: Palette,
): string {
  switch (mode) {
    case 'pod':
      return palette.pods[c.pod] ?? palette.neutral;
    case 'weight':
      return weightColor(c.weightT);
    case 'type':
      return TYPE_COLORS[c.type] ?? palette.dim;
    case 'viol':
      return severity === 'error'
        ? palette.err
        : severity === 'warning'
          ? palette.warn
          : palette.neutral;
  }
}

const hex = (h: string): [number, number, number] => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
};

/**
 * A dimmed container: the dim color at 55% over the background, as the design draws it with
 * transparency. The 3D view draws it opaque, which keeps the scene free of sorting problems.
 */
export function dimmedColor(palette: Palette): string {
  const d = hex(palette.dim);
  const b = hex(palette.bg);
  return `#${d
    .map((v, i) =>
      Math.round(v * 0.55 + b[i]! * 0.45)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export interface LegendItem {
  color: string;
  label: string;
  count: string;
}

export interface Legend {
  title: string;
  items: LegendItem[];
}

export function legendFor(
  mode: ColorMode,
  counts: { pods: Readonly<Record<string, number>>; errors: number; warnings: number },
  palette: Palette,
): Legend {
  switch (mode) {
    case 'pod':
      return {
        title: 'Port of discharge',
        items: POD_LIST.map((p) => ({
          color: palette.pods[p] ?? palette.neutral,
          label: PODS[p].short,
          count: (counts.pods[p] ?? 0).toLocaleString('en-US'),
        })),
      };
    case 'weight':
      return {
        title: 'VGM, tonnes',
        items: WEIGHT_SCALE.map((w) => ({ color: w.color, label: w.label, count: '' })),
      };
    case 'type':
      return {
        title: 'Container type',
        items: TYPE_LEGEND.map((t) => ({ color: TYPE_COLORS[t], label: t, count: '' })),
      };
    case 'viol':
      return {
        title: 'Rule status',
        items: [
          { color: palette.err, label: 'Error', count: String(counts.errors) },
          { color: palette.warn, label: 'Warning', count: String(counts.warnings) },
          { color: palette.neutral, label: 'Clear', count: '' },
        ],
      };
  }
}

const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The palette of the current theme, from the CSS variables in src/styles/tokens.css. */
export function readPalette(): Palette {
  const pods: Record<string, string> = {};
  for (const p of POD_LIST) pods[p] = cssVar(`--pod-${p.toLowerCase()}`) || '#888888';
  return {
    pods,
    err: cssVar('--g-err') || '#ff5d5d',
    warn: cssVar('--g-warn') || '#ffb020',
    neutral: cssVar('--g-neutral') || '#43506a',
    dim: cssVar('--g-dim') || '#2a3650',
    bg: cssVar('--g-bg') || '#0b1220',
  };
}
