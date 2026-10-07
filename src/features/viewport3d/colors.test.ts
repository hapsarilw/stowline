import { describe, expect, it } from 'vitest';
import {
  containerColor,
  dimmedColor,
  legendFor,
  TYPE_COLORS,
  weightColor,
  type Palette,
} from './colors';

const palette: Palette = {
  pods: { LKCMB: '#e69f00', AEJEA: '#56b4e9', NLRTM: '#009e73', DEHAM: '#cc79a7' },
  err: '#ff5d5d',
  warn: '#ffb020',
  neutral: '#43506a',
  dim: '#2a3650',
  bg: '#0b1220',
};
const box = { pod: 'NLRTM', type: '40HC' as const, weightT: 28.4 };

describe('color modes (FR-20)', () => {
  it('colors by POD with the Okabe-Ito colors', () => {
    expect(containerColor('pod', box, null, palette)).toBe('#009e73');
    expect(containerColor('pod', { ...box, pod: 'XXXXX' }, null, palette)).toBe('#43506a');
  });

  it('colors by weight in five bands, as in the design', () => {
    expect(weightColor(7.9)).toBe('#22406e');
    expect(weightColor(8)).toBe('#38699a');
    expect(weightColor(19.9)).toBe('#5b97c0');
    expect(weightColor(25.9)).toBe('#a9cbdd');
    expect(weightColor(26)).toBe('#f2d35b');
    expect(containerColor('weight', box, null, palette)).toBe('#f2d35b');
  });

  it('colors by type', () => {
    expect(containerColor('type', { ...box, type: 'RF' }, null, palette)).toBe(TYPE_COLORS.RF);
    expect(Object.keys(TYPE_COLORS)).toHaveLength(6);
  });

  it('colors by violation: error, warning, clear', () => {
    expect(containerColor('viol', box, 'error', palette)).toBe('#ff5d5d');
    expect(containerColor('viol', box, 'warning', palette)).toBe('#ffb020');
    expect(containerColor('viol', box, null, palette)).toBe('#43506a');
  });

  it('dims to the dim color at 55% over the background', () => {
    // 0x2a * 0.55 + 0x0b * 0.45 = 28 (0x1c), 0x36 * 0.55 + 0x12 * 0.45 = 38 (0x26), 0x50 * 0.55 + 0x20 * 0.45 = 58 (0x3a).
    expect(dimmedColor(palette)).toBe('#1c263a');
  });
});

describe('legends (FR-20)', () => {
  const counts = {
    pods: { LKCMB: 562, AEJEA: 674, NLRTM: 837, DEHAM: 667 },
    errors: 6,
    warnings: 1,
  };

  it('names the active mode and counts PODs and violations', () => {
    const pod = legendFor('pod', counts, palette);
    expect(pod.title).toBe('Port of discharge');
    expect(pod.items.map((i) => `${i.label} ${i.count}`)).toEqual([
      'CMB 562',
      'JEA 674',
      'RTM 837',
      'HAM 667',
    ]);
    const viol = legendFor('viol', counts, palette);
    expect(viol.items.map((i) => [i.label, i.count])).toEqual([
      ['Error', '6'],
      ['Warning', '1'],
      ['Clear', ''],
    ]);
    expect(legendFor('weight', counts, palette).items.map((i) => i.label)).toEqual([
      '<8',
      '8–14',
      '14–20',
      '20–26',
      '≥26',
    ]);
    expect(legendFor('type', counts, palette).title).toBe('Container type');
    expect(legendFor('pod', { ...counts, pods: {} }, palette).items[0]!.count).toBe('0');
  });
});
