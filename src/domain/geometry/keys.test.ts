import { describe, expect, it } from 'vitest';
import {
  ALL_ROWS,
  bay40Of,
  halfOfBay,
  halfOfKey,
  parseKey,
  rowsFor,
  slot40Key,
  slotKey,
  slotKeyFor,
} from './keys';

describe('slot keys', () => {
  it('formats and parses BBRRTT', () => {
    expect(slotKey(18, 4, 86)).toBe('180486');
    expect(slotKey(2, 1, 2)).toBe('020102');
    expect(parseKey('180486')).toEqual({ bay: 18, row: 4, tier: 86 });
    expect(parseKey('020102')).toEqual({ bay: 2, row: 1, tier: 2 });
  });

  it('orders rows from port to starboard', () => {
    expect(rowsFor(4)).toEqual([4, 2, 1, 3]);
    expect(ALL_ROWS).toHaveLength(16);
    expect(ALL_ROWS.slice(0, 3)).toEqual([16, 14, 12]);
    expect(ALL_ROWS.slice(-3)).toEqual([11, 13, 15]);
    expect([...ALL_ROWS].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });
});

describe('fore and aft halves', () => {
  it('gives each odd bay to exactly one 40ft bay', () => {
    for (let bay40 = 2; bay40 <= 86; bay40 += 4) {
      expect(halfOfBay(bay40)).toBe('both');
      expect(halfOfBay(bay40 - 1)).toBe('fore');
      expect(halfOfBay(bay40 + 1)).toBe('aft');
      expect(bay40Of(bay40 - 1)).toBe(bay40);
      expect(bay40Of(bay40)).toBe(bay40);
      expect(bay40Of(bay40 + 1)).toBe(bay40);
    }
  });

  it('builds the key of a half and maps it back', () => {
    expect(slotKeyFor(30, 2, 84, 'both')).toBe('300284');
    expect(slotKeyFor(30, 2, 84, 'fore')).toBe('290284');
    expect(slotKeyFor(30, 2, 84, 'aft')).toBe('310284');
    expect(halfOfKey('290284')).toBe('fore');
    expect(halfOfKey('310284')).toBe('aft');
    expect(halfOfKey('300284')).toBe('both');
    expect(slot40Key('290284')).toBe('300284');
    expect(slot40Key('310284')).toBe('300284');
    expect(slot40Key('300284')).toBe('300284');
  });
});
