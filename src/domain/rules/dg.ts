import { bay40Of, pad, parseKey } from '../geometry';
import type { StowContext } from '../plan/context';
import { stackIdOf, type StowState } from '../plan/state';
import type { SlotKey, Violation } from '../types';
import { incompatible } from './segregation';

// R3 dangerous goods segregation. Neighbours are left, right, above, below, and the same row
// and tier in the next bay forward and aft (D5). Along the ship, positions are counted in 20ft
// bays: a 40ft container in bay B covers B-1 and B+1, a 20ft container covers its own odd bay.
// Two positions are end to end when their bay numbers differ by 2.

export interface DgItem {
  id: string;
  key: SlotKey;
  cls: string;
}

export interface DgIndex {
  items: DgItem[];
  cells: Map<string, DgItem>;
}

const cell = (seg: number, row: number, tier: number) => `${seg}|${row}|${tier}`;

export function segmentsOf(key: SlotKey): number[] {
  const { bay } = parseKey(key);
  return bay % 2 === 0 ? [bay - 1, bay + 1] : [bay];
}

/** Where each container with dangerous goods sits, optionally leaving one container out. */
export function buildDgIndex(
  s: StowState,
  ctx: StowContext,
  ignoreId: string | null = null,
): DgIndex {
  const items: DgItem[] = [];
  const cells = new Map<string, DgItem>();
  for (const id of ctx.dgIds) {
    if (id === ignoreId) continue;
    const key = s.slotOf.get(id);
    const cls = ctx.containers.get(id)?.imdgClass;
    if (!key || !cls) continue;
    const item = { id, key, cls };
    items.push(item);
    const { row, tier } = parseKey(key);
    for (const seg of segmentsOf(key)) cells.set(cell(seg, row, tier), item);
  }
  return { items, cells };
}

/** Cells next to a slot: left and right, above and below, and end to end. */
export function neighbourCells(key: SlotKey, ctx: StowContext): string[] {
  const { row, tier } = parseKey(key);
  const segs = segmentsOf(key);
  const i = ctx.rowOrder.indexOf(row);
  const side = [ctx.rowOrder[i - 1], ctx.rowOrder[i + 1]].filter((r) => r !== undefined);
  const out: string[] = [];
  for (const seg of segs) {
    for (const r of side) out.push(cell(seg, r, tier));
    out.push(cell(seg, row, tier + 2), cell(seg, row, tier - 2));
  }
  out.push(cell(Math.min(...segs) - 2, row, tier), cell(Math.max(...segs) + 2, row, tier));
  return out;
}

/** Containers with dangerous goods next to a slot, other than the one with ownId. */
export function dgNeighbours(
  index: DgIndex,
  key: SlotKey,
  ctx: StowContext,
  ownId: string,
): DgItem[] {
  const found = new Map<string, DgItem>();
  for (const c of neighbourCells(key, ctx)) {
    const y = index.cells.get(c);
    if (y && y.id !== ownId) found.set(y.id, y);
  }
  return [...found.values()];
}

/** R3 violations. With a scope, only pairs where at least one container is in those stacks. */
export function dgViolations(
  s: StowState,
  ctx: StowContext,
  scope: ReadonlySet<string> | null = null,
): Violation[] {
  const index = buildDgIndex(s, ctx);
  const seen = new Set<string>();
  const out: Violation[] = [];
  for (const x of index.items) {
    if (scope && !scope.has(stackIdOf(x.key))) continue;
    for (const y of dgNeighbours(index, x.key, ctx, x.id)) {
      if (!incompatible(x.cls, y.cls)) continue;
      const [a, b] = x.key < y.key ? [x, y] : [y, x];
      const id = `dg:${a.key}-${b.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const bay = Math.min(parseKey(a.key).bay, parseKey(b.key).bay);
      out.push({
        id,
        rule: 'dg',
        severity: 'error',
        slot: a.key,
        bay: bay40Of(parseKey(a.key).bay),
        slotKeys: [a.key, b.key],
        message: `IMDG ${a.cls} next to IMDG ${b.cls} in bay ${pad(bay)}`,
      });
    }
  }
  return out;
}
