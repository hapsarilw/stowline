import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fmt1, fmtTenths, plural } from './format';

const reference = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

describe('number formats', () => {
  it('prints one decimal with thousands separators, as the design does', () => {
    expect(fmt1(1240)).toBe('1,240.0');
    expect(fmt1(96.4)).toBe('96.4');
    expect(fmt1(0)).toBe('0.0');
    expect(fmt1(-3.25)).toBe('-3.3');
    expect(fmtTenths(793)).toBe('79.3');
    expect(plural(1, 'violation')).toBe('1 violation');
    expect(plural(7, 'violation')).toBe('7 violations');
  });

  it('gives the same text as toLocaleString for any number', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e9, max: 1e9, noNaN: true }), (n) => {
        expect(fmt1(n)).toBe(reference(n));
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: -1e7, max: 1e7 }), (t) => {
        expect(fmtTenths(t)).toBe(reference(t / 10));
      }),
    );
  });

  it('formats a weight in under 5 microseconds (one formatter, made once; M7)', () => {
    const t0 = Date.now();
    for (let i = 0; i < 20_000; i++) fmt1(i / 7);
    const perCallUs = ((Date.now() - t0) * 1000) / 20_000;
    expect(perCallUs).toBeLessThan(5);
  });
});
