import type { Placement, SlotKey } from '@/domain';

/**
 * Which slot each instance of one InstancedMesh draws. Instances are packed: removing one
 * moves the last instance into its place, so the mesh can draw `count` instances and no gaps.
 */
export class InstanceTable {
  readonly keys: SlotKey[] = [];
  readonly index = new Map<SlotKey, number>();

  get count(): number {
    return this.keys.length;
  }

  add(key: SlotKey): number {
    if (this.index.has(key)) throw new Error(`Slot ${key} is already drawn`);
    const i = this.keys.length;
    this.keys.push(key);
    this.index.set(key, i);
    return i;
  }

  /**
   * Removes a slot. Returns the move the caller must copy in the mesh (matrix and color of
   * instance `from` into instance `to`), or null when the last instance was removed.
   */
  remove(key: SlotKey): { from: number; to: number } | null {
    const i = this.index.get(key);
    if (i === undefined) throw new Error(`Slot ${key} is not drawn`);
    const last = this.keys.length - 1;
    this.index.delete(key);
    if (i === last) {
      this.keys.pop();
      return null;
    }
    const moved = this.keys[last]!;
    this.keys[i] = moved;
    this.index.set(moved, i);
    this.keys.pop();
    return { from: last, to: i };
  }

  clear(): void {
    this.keys.length = 0;
    this.index.clear();
  }
}

/**
 * Slots to remove and to add between two plan states. A placement that is a new object
 * (moved in, swapped, locked) counts as removed and added again. The plan store keeps the
 * same object for every placement a command did not touch, so this is the touched set only.
 */
export function diffPlacements(
  prev: ReadonlyMap<SlotKey, Placement>,
  next: ReadonlyMap<SlotKey, Placement>,
): { removed: SlotKey[]; added: SlotKey[] } {
  const removed: SlotKey[] = [];
  const added: SlotKey[] = [];
  for (const [key, p] of prev) if (next.get(key) !== p) removed.push(key);
  for (const [key, p] of next) if (prev.get(key) !== p) added.push(key);
  return { removed, added };
}
