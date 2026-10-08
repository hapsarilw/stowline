import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// NFR-11: text 4.5:1 or more; controls and the focus ring 3:1 or more. Read from tokens.css, so
// a changed token fails here before it reaches a page. axe checks the rendered pages as well
// (e2e/a11y.spec.ts). Translucent tints are laid over the surface they sit on.

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(start, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!;
  return out;
}

const THEMES = {
  dark: block(":root[data-theme='dark']"),
  light: block(":root[data-theme='light'] {"),
};

type Rgba = [number, number, number, number];

function parse(value: string): Rgba {
  const v = value.trim();
  if (v.startsWith('#'))
    return [
      parseInt(v.slice(1, 3), 16),
      parseInt(v.slice(3, 5), 16),
      parseInt(v.slice(5, 7), 16),
      1,
    ];
  const [r, g, b, a] = (v.match(/[\d.]+/g) ?? []).map(Number);
  return [r!, g!, b!, a ?? 1];
}

const over = (fg: Rgba, bg: Rgba): Rgba => {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a)).concat(1) as Rgba;
};

function luminance([r, g, b]: Rgba): number {
  const ch = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Pairs the components use: [foreground, background]. */
const TEXT: [string, string][] = [
  ...['text', 'text2', 'text3'].flatMap((fg) =>
    ['bg', 'surface', 'raised', 'hover', 'sel'].map((bg): [string, string] => [fg, bg]),
  ),
  ...['accent', 'err', 'warn', 'ok'].flatMap((fg) =>
    ['bg', 'surface', 'raised'].map((bg): [string, string] => [fg, bg]),
  ),
  // Status text on its own tint (badges, banners). Accent text on a hovered ghost button: the
  // hover fill is --hover, as --accentbg gave 4.4998:1 in the light theme (M7 audit).
  ['err', 'errbg'],
  ['warn', 'warnbg'],
  ['ok', 'okbg'],
  ['accent', 'hover'],
  ['text', 'accentbg'],
  ['text', 'errbg'],
  // Text on a filled control.
  ['onaccent', 'accent'],
  ['onerr', 'err'],
];

/** Focus ring, selected outlines and icons: 3:1 against what they sit on. */
const UI: [string, string][] = [
  ...['bg', 'surface', 'raised', 'sel'].map((bg): [string, string] => ['accent', bg]),
  ...['bg', 'surface', 'raised'].map((bg): [string, string] => ['text3', bg]),
  ...['err', 'warn', 'ok'].map((fg): [string, string] => [fg, 'surface']),
];

describe.each(Object.entries(THEMES))('%s theme tokens (NFR-11)', (_name, t) => {
  const surface = parse(t.surface!);
  const color = (name: string) => {
    const c = parse(t[name]!);
    return c[3] < 1 ? over(c, surface) : c;
  };

  it.each(TEXT)('text %s on %s is 4.5:1 or more', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI)('%s on %s is 3:1 or more', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(3);
  });

  it('control borders are the WCAG 1.4.11 exception (D9): every control has a label or icon', () => {
    // Decided in M4 (BUILD_NOTES D9): --border2 stays as designed, under 3:1.
    expect(contrast(color('border2'), color('surface'))).toBeLessThan(3);
  });
});
