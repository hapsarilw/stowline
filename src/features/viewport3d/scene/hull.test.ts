import { describe, expect, it } from 'vitest';
import { createBenchVessel, SAMPLE_VESSEL } from '@/domain';
import { parseCssColor } from './boxMaterial';
import { DECK_Z, hullFor, hullTriangles, KEEL_Z, shipBounds, waterline } from './hull';

describe('hull', () => {
  it('uses the design section table for the sample vessel', () => {
    const s = hullFor(SAMPLE_VESSEL);
    const near = (a: { x: number; deck: number; bottom: number; z: number }, b: number[]) =>
      [a.x, a.deck, a.bottom, a.z].forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
    near(s[0]!, [-162, 17, 8, -12]);
    near(s[s.length - 1]!, [172, 0.5, 0.5, -8]);
    const b = shipBounds(s);
    expect(b.minX).toBeCloseTo(-162, 6);
    expect(b.maxX).toBeCloseTo(172, 6);
    expect(b.minZ).toBe(KEEL_Z);
  });

  it('stretches the hull to a bigger vessel so its containers fit', () => {
    const v = createBenchVessel();
    const s = hullFor(v);
    const xs = v.bays.map((b) => b.x);
    expect(Math.min(...s.map((x) => x.x))).toBeLessThan(Math.min(...xs) - 6);
    expect(Math.max(...s.map((x) => x.x))).toBeGreaterThan(Math.max(...xs) + 6);
    expect(Math.max(...s.map((x) => x.deck))).toBeGreaterThan(12 * 2.5);
  });

  it('winds the deck upward and the sides outward', () => {
    const { shell, deck } = hullTriangles(hullFor(SAMPLE_VESSEL));
    expect(shell.length % 3).toBe(0);
    expect(deck.length).toBe(8 * 6);
    const normal = (a: number[], b: number[], c: number[]) => {
      const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      return [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ];
    };
    for (let i = 0; i < deck.length; i += 3)
      expect(normal(deck[i]!, deck[i + 1]!, deck[i + 2]!)[2]!).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < shell.length; i += 3) {
      const [a, b, c] = [shell[i]!, shell[i + 1]!, shell[i + 2]!];
      const n = normal(a, b, c);
      const cy = (a[1] + b[1] + c[1]) / 3;
      // Side faces point to their side. The bottom points down.
      if (Math.abs(n[1]!) > Math.abs(n[2]!) && Math.abs(cy) > 1)
        expect(Math.sign(n[1]!)).toBe(Math.sign(cy));
      else if (Math.abs(n[2]!) > Math.abs(n[1]!) && Math.abs(n[2]!) > Math.abs(n[0]!))
        expect(n[2]!).toBeLessThan(0);
    }
    expect(deck.every((p) => p[2] === DECK_Z)).toBe(true);
  });

  it('draws the waterline at the drafts, deeper aft when trimmed by the stern', () => {
    const s = hullFor(SAMPLE_VESSEL);
    const w = waterline(s, 12.1, 12.72);
    expect(w).toHaveLength((s.length - 1) * 2 * 2);
    const fwd = w.find((p) => p[0] === s[s.length - 2]!.x)!;
    const aft = w.find((p) => p[0] === s[1]!.x)!;
    expect(fwd[2]).toBeCloseTo(KEEL_Z + 12.1, 6);
    expect(aft[2]).toBeCloseTo(KEEL_Z + 12.72, 6);
  });
});

describe('CSS colors for the scene', () => {
  it('reads hex and rgba', () => {
    expect(parseCssColor('#ff0000')).toEqual({ rgb: [1, 0, 0], alpha: 1 });
    const e = parseCssColor('rgba(8, 13, 24, 0.6)');
    expect(e.alpha).toBe(0.6);
    expect(e.rgb[0]).toBeCloseTo(8 / 255, 9);
    expect(parseCssColor('rgb(255, 255, 255)')).toEqual({ rgb: [1, 1, 1], alpha: 1 });
    expect(parseCssColor('bogus')).toEqual({ rgb: [0, 0, 0], alpha: 1 });
  });

  it('reads the hex forms the production CSS minifier writes, alpha included (M7)', () => {
    // tokens.css says rgba(14, 23, 38, 0.45); the built CSS says #0e172673.
    const e = parseCssColor('#0e172673');
    expect(e.rgb.map((v) => Math.round(v * 255))).toEqual([14, 23, 38]);
    expect(e.alpha).toBeCloseTo(0x73 / 255, 9);
    expect(parseCssColor('#080d1899').alpha).toBeCloseTo(0.6, 2);
    expect(parseCssColor('#f00')).toEqual({ rgb: [1, 0, 0], alpha: 1 });
    const short = parseCssColor('#f008');
    expect(short.rgb).toEqual([1, 0, 0]);
    expect(short.alpha).toBeCloseTo(0x88 / 255, 9);
  });

  it('reads the space-separated rgb() form too', () => {
    const e = parseCssColor('rgb(14 23 38 / 0.45)');
    expect(e.rgb.map((v) => Math.round(v * 255))).toEqual([14, 23, 38]);
    expect(e.alpha).toBe(0.45);
  });
});
