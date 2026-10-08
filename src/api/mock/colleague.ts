import {
  applyCommand,
  isTop,
  validateStacks,
  type Command,
  type Container,
  type SlotKey,
  type StowContext,
  type StowState,
} from '@/domain';

// The colleague behind the forced 409 (decision 6, SRS "Mock behavior"): Dimas Hartono saves
// first. His changes mirror the design's examples (place, move, lock) but are made from the
// plan on the server, each checked with the normal command path, so they are always valid. They
// keep clear of bay 18, where the AT-13 change goes.

/** The slot the colleague locks on the seeded plan: the top deck container of bay 30, row 01. */
export const COLLEAGUE_LOCK: SlotKey = '300188';

const bayOf = (k: SlotKey) => +k.slice(0, 2);
const tierOf = (k: SlotKey) => +k.slice(4, 6);

export function colleagueChanges(
  start: StowState,
  ctx: StowContext,
  loadList: readonly Container[],
): Command[] {
  const out: Command[] = [];
  let s = start;
  // A change is kept only when it is valid and adds no violation, not even a warning: the
  // colleague's save leaves the plan's checks as they were (7 violations on the seeded plan).
  const tryApply = (c: Command): boolean => {
    const r = applyCommand(s, ctx, c);
    if (!r.ok) return false;
    if (validateStacks(r.state, ctx, r.touched).length > validateStacks(s, ctx, r.touched).length)
      return false;
    s = r.state;
    out.push(c);
    return true;
  };
  const slots = ctx.geometry.slots40();
  const inBay = (bay: number, deck: boolean) =>
    slots.filter((k) => bayOf(k) === bay && tierOf(k) >= 82 === deck);

  // 1. Place the first 40ft container of the load list that fits in bay 22 hold.
  const hold22 = inBay(22, false);
  place: for (const c of loadList.filter((x) => x.lengthFt === 40).slice(0, 40)) {
    if (s.slotOf.has(c.id)) continue;
    for (const k of hold22)
      if (!s.placements.has(k) && tryApply({ kind: 'place', containerId: c.id, to: k }))
        break place;
  }

  // 2. Move a top container on bay 26 deck to another stack of the same bay.
  const deck26 = inBay(26, true);
  move: for (const from of deck26) {
    if (!s.placements.has(from) || !isTop(s, ctx, from)) continue;
    for (const to of deck26)
      if (bayOf(to) === 26 && to.slice(2, 4) !== from.slice(2, 4) && !s.placements.has(to))
        if (tryApply({ kind: 'move', from, to })) break move;
  }

  // 3. Lock the top deck container of bay 30, row 01, as the design locks a slot.
  if (s.placements.has(COLLEAGUE_LOCK)) tryApply({ kind: 'lock', at: COLLEAGUE_LOCK });
  return out;
}
