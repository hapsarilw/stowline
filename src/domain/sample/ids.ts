import type { Rng } from './rng';

/** Container IDs use the fictional owner prefix NSPU only. */
export const OWNER_PREFIX = 'NSPU';

const ID_PATTERN = /^NSPU (\d{6}) (\d)$/;

/**
 * Draws four numbers, as the prototype did when it also picked one of nine owner prefixes.
 * The first draw is kept so every later draw, and so the whole seeded plan, stays the same.
 */
export function randomId(r: Rng): string {
  r(); // was the owner prefix
  const serial = 100000 + Math.floor(r() * 899999);
  const check = Math.floor(r() * 10);
  return `${OWNER_PREFIX} ${serial} ${check}`;
}

/** Returns the id, or the next free serial number when the id is already taken. */
export function uniqueId(id: string, used: ReadonlySet<string>): string {
  if (!used.has(id)) return id;
  const m = ID_PATTERN.exec(id);
  if (!m) throw new Error(`Cannot make unique id from ${id}`);
  let serial = Number(m[1]);
  let next = id;
  while (used.has(next)) {
    serial = serial >= 999999 ? 100000 : serial + 1;
    next = `${OWNER_PREFIX} ${serial} ${m[2]}`;
  }
  return next;
}
