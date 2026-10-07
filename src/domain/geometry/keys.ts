import type { Half, SlotKey } from '../types';

export const pad = (n: number): string => String(n).padStart(2, '0');

export const slotKey = (bay: number, row: number, tier: number): SlotKey =>
  pad(bay) + pad(row) + pad(tier);

export function parseKey(key: SlotKey): { bay: number; row: number; tier: number } {
  return { bay: +key.slice(0, 2), row: +key.slice(2, 4), tier: +key.slice(4, 6) };
}

export const isDeckTier = (tier: number): boolean => tier >= 82;

/**
 * Row numbers of a bay with n rows, in display order: even rows to port from the
 * outside in (n..2), then odd rows to starboard from the inside out (1..n-1).
 */
export function rowsFor(n: number): number[] {
  const port: number[] = [];
  const stbd: number[] = [];
  for (let k = n / 2; k >= 1; k--) port.push(2 * k);
  for (let k = 1; k <= n / 2; k++) stbd.push(2 * k - 1);
  return port.concat(stbd);
}

/** The widest bay has 16 rows. */
export const ALL_ROWS: readonly number[] = rowsFor(16);

/**
 * Even bays carry 40ft containers. Odd bays carry the 20ft halves of the 40ft bay between
 * them: bay-1 is the fore half (toward the bow) and bay+1 is the aft half.
 * 40ft bays are 4 apart (02, 06, 10, ...), so each odd bay belongs to exactly one.
 */
export function halfOfBay(bay: number): Half {
  if (bay % 2 === 0) return 'both';
  return bay % 4 === 1 ? 'fore' : 'aft';
}

/** The 40ft bay that holds a slot in the given bay. */
export function bay40Of(bay: number): number {
  const half = halfOfBay(bay);
  return half === 'both' ? bay : half === 'fore' ? bay + 1 : bay - 1;
}

export function slotKeyFor(bay40: number, row: number, tier: number, half: Half): SlotKey {
  const bay = half === 'both' ? bay40 : half === 'fore' ? bay40 - 1 : bay40 + 1;
  return slotKey(bay, row, tier);
}

/** The half of a slot key: both for a 40ft slot, fore or aft for a 20ft half. */
export const halfOfKey = (key: SlotKey): Half => halfOfBay(parseKey(key).bay);

/** The key of the 40ft slot that contains this slot. The same key for a 40ft slot. */
export function slot40Key(key: SlotKey): SlotKey {
  const { bay, row, tier } = parseKey(key);
  return slotKey(bay40Of(bay), row, tier);
}
