import {
  applyCommand,
  checkPlacement,
  fmt1,
  fmtTenths,
  isTop,
  nextFreeSlots,
  pad,
  plural,
  PODS,
  toTenths,
  type Command,
  type Container,
  type PlacementCheck,
  type SlotKey,
  type StowContext,
  type StowState,
} from '@/domain';

// The placement controller. Pointer drag, click and keyboard all send it the same events, and
// it answers with the next state and what to do: a command to run, a sentence for the live
// region, or a refusal to show. It is a pure function of its state, the event and the plan.

export type Via = 'pointer' | 'keyboard';

export type Source =
  { kind: 'list'; containerId: string } | { kind: 'slot'; containerId: string; from: SlotKey };

export type PlacementState =
  | { kind: 'idle' }
  | { kind: 'holding'; source: Source; via: Via; queue: readonly string[] }
  | {
      kind: 'over';
      source: Source;
      via: Via;
      queue: readonly string[];
      target: SlotKey;
      check: PlacementCheck;
    }
  | { kind: 'swapping'; from: SlotKey; containerId: string };

export type PlacementEvent =
  | { type: 'pickFromList'; containerId: string; via: Via; queue?: readonly string[] }
  | { type: 'pickFromSlot'; key: SlotKey; via: Via }
  | { type: 'hover'; key: SlotKey | null }
  | { type: 'drop'; key?: SlotKey }
  | { type: 'cancel' }
  | { type: 'startSwap'; key: SlotKey }
  | { type: 'chooseSwap'; key: SlotKey };

export interface Refusal {
  /** The slot that shakes, when there is one. */
  key: SlotKey | null;
  title: string;
  reason: string;
  /** Where the container went, when it left the hand: "Container returned to its slot." */
  returned?: string;
}

export interface Outcome {
  next: PlacementState;
  command?: Command;
  /** For the live region. */
  announce?: string;
  refusal?: Refusal;
}

export interface World {
  state: StowState;
  ctx: StowContext;
  /** The 40ft bay on view. */
  bay: number;
}

export const IDLE: PlacementState = { kind: 'idle' };

export interface Target {
  key: SlotKey;
  check: PlacementCheck;
}

/**
 * The next free slot of each stack in a bay for a container, with its placement check
 * (FR-34). The container's own slot is left out: it is the origin.
 */
export function targetsInBay(
  w: Pick<World, 'state' | 'ctx'>,
  container: Container,
  from: SlotKey | null,
  bay: number,
): Target[] {
  return nextFreeSlots(w.state, w.ctx, container.lengthFt, { bays: [bay], ignoreKey: from })
    .filter((key) => key !== from)
    .map((key) => ({ key, check: checkPlacement(w.state, w.ctx, container, key, from) }));
}

/** How the design counts "valid targets": valid and without a warning. */
export const countValid = (targets: readonly Target[]): number =>
  targets.filter((t) => t.check.valid && t.check.warnings.length === 0).length;

/** What a placement check means, in words, for the live region and the tooltip. */
export function describeCheck(check: PlacementCheck): string {
  if (!check.target) return `Invalid: ${check.reason ?? 'not a valid slot'}`;
  if (!check.valid) return `Invalid: ${check.reason ?? 'breaks a rule'}`;
  if (check.warnings.length) return `Valid with warning: ${check.warnings[0]!.message}`;
  return `Valid target, stack ${fmtTenths(toTenths(check.stackWeightT))} t of ${fmtTenths(toTenths(check.limitT))} t`;
}

const containerOf = (w: World, source: Source): Container | undefined =>
  w.ctx.containers.get(source.containerId);

const sourceOf = (s: PlacementState): Source | null =>
  s.kind === 'holding' || s.kind === 'over' ? s.source : null;

const fromOf = (source: Source): SlotKey | null => (source.kind === 'slot' ? source.from : null);

function picked(w: World, source: Source, via: Via, queue: readonly string[]): Outcome {
  const c = containerOf(w, source)!;
  const n = countValid(targetsInBay(w, c, fromOf(source), w.bay));
  const where = source.kind === 'slot' ? source.from : 'the load list';
  return {
    next: { kind: 'holding', source, via, queue },
    announce: `Picked up ${c.id} from ${where}. ${plural(n, 'valid target')} in bay ${pad(w.bay)}. Arrow keys to move, Enter to place, Esc to cancel.`,
  };
}

function pickFromList(w: World, id: string, via: Via, queue: readonly string[]): Outcome {
  const c = w.ctx.containers.get(id);
  if (!c) return { next: IDLE, announce: `Container ${id} is not on the load list.` };
  const slot = w.state.slotOf.get(id);
  if (slot) return { next: IDLE, announce: `${id} is already planned at ${slot}.` };
  return picked(
    w,
    { kind: 'list', containerId: id },
    via,
    queue.filter((q) => q !== id),
  );
}

function pickFromSlot(w: World, key: SlotKey, via: Via): Outcome {
  const p = w.state.placements.get(key);
  if (!p) return { next: IDLE, announce: `${key} is empty. Nothing to pick up.` };
  if (p.locked) {
    return {
      next: IDLE,
      announce: `${p.containerId} at ${key} is locked. Unlock it in the Inspector first.`,
    };
  }
  if (!isTop(w.state, w.ctx, key)) {
    return {
      next: IDLE,
      announce: `${p.containerId} is under other containers. Only the top of a stack can be picked up.`,
    };
  }
  return picked(w, { kind: 'slot', containerId: p.containerId, from: key }, via, []);
}

/** "180486: NSPU 482913 5, Rotterdam, 26.2 t, locked, reefer plug", or "180688: empty". */
export function slotText(w: Pick<World, 'state' | 'ctx'>, key: SlotKey): string {
  const p = w.state.placements.get(key);
  const c = p && w.ctx.containers.get(p.containerId);
  const pod = c && PODS[c.pod as keyof typeof PODS];
  let t = `${key}: ${c ? `${c.id}, ${pod?.name ?? c.pod}, ${fmt1(c.weightT)} t${p.locked ? ', locked' : ''}` : 'empty'}`;
  if (w.ctx.geometry.hasPlug(key)) t += ', reefer plug';
  return t;
}

function hover(
  w: World,
  s: Extract<PlacementState, { kind: 'holding' | 'over' }>,
  key: SlotKey | null,
): Outcome {
  const base = { source: s.source, via: s.via, queue: s.queue };
  if (key === null) return { next: { kind: 'holding', ...base } };
  const c = containerOf(w, s.source)!;
  const check = checkPlacement(w.state, w.ctx, c, key, fromOf(s.source));
  const next: PlacementState = { kind: 'over', ...base, target: key, check };
  // Pointer moves are not read out; keyboard moves are: the slot, its container and the rule
  // result for a target (FR-37), as cellDesc in the design.
  if (s.via !== 'keyboard') return { next };
  const rule = check.target ? ` ${describeCheck(check)}.` : '';
  return { next, announce: `${slotText(w, key)}.${rule}` };
}

function drop(
  w: World,
  s: Extract<PlacementState, { kind: 'holding' | 'over' }>,
  key: SlotKey | undefined,
): Outcome {
  const target = key ?? (s.kind === 'over' ? s.target : undefined);
  const c = containerOf(w, s.source)!;
  const from = fromOf(s.source);
  const returned =
    s.source.kind === 'slot'
      ? 'Container returned to its slot.'
      : 'Container returned to the load list.';

  if (target === undefined) {
    if (s.via === 'pointer') return { next: IDLE, announce: `Cancelled. ${returned}` };
    return { next: s, announce: `Move to a slot first. Still holding ${c.id}.` };
  }
  if (target === from) return { next: IDLE, announce: `${c.id} put back at ${target}.` };

  const command: Command =
    s.source.kind === 'list'
      ? { kind: 'place', containerId: c.id, to: target }
      : { kind: 'move', from: s.source.from, to: target };
  const check = checkPlacement(w.state, w.ctx, c, target, from);
  const dry = check.valid ? applyCommand(w.state, w.ctx, command) : null;
  const reason = !check.valid
    ? (check.reason ?? 'Not a valid slot')
    : dry && !dry.ok
      ? dry.reason
      : null;

  if (reason !== null) {
    const refusal: Refusal = { key: target, title: `Can't place ${c.id} at ${target}`, reason };
    if (s.via === 'pointer') {
      return {
        next: IDLE,
        refusal: { ...refusal, returned },
        announce: `${refusal.title}. ${reason}. ${returned}`,
      };
    }
    // From the keyboard the container stays in hand, as in the design.
    return {
      next: { kind: 'over', source: s.source, via: s.via, queue: s.queue, target, check },
      refusal,
      announce: `Cannot place at ${target}. ${reason}. Still holding ${c.id}.`,
    };
  }

  const placed = `${s.source.kind === 'list' ? 'Placed' : 'Moved'} ${c.id} ${s.source.kind === 'list' ? 'at' : 'to'} ${target}.`;
  // FR-39: with more rows ticked, the next one is picked up and held for the keyboard or a click.
  const nextId = s.queue.find((id) => id !== c.id && !w.state.slotOf.has(id));
  if (s.source.kind === 'list' && nextId) {
    const rest = s.queue.filter((id) => id !== nextId && id !== c.id);
    return {
      next: {
        kind: 'holding',
        source: { kind: 'list', containerId: nextId },
        via: 'keyboard',
        queue: rest,
      },
      command,
      announce: `${placed} Picked up ${nextId}. ${plural(rest.length, 'more row')} selected.`,
    };
  }
  return { next: IDLE, command, announce: placed };
}

export function step(s: PlacementState, e: PlacementEvent, w: World): Outcome {
  switch (e.type) {
    case 'pickFromList':
      return pickFromList(w, e.containerId, e.via, e.queue ?? []);
    case 'pickFromSlot':
      return pickFromSlot(w, e.key, e.via);
    case 'hover':
      return s.kind === 'holding' || s.kind === 'over' ? hover(w, s, e.key) : { next: s };
    case 'drop':
      return s.kind === 'holding' || s.kind === 'over' ? drop(w, s, e.key) : { next: s };
    case 'cancel': {
      const source = sourceOf(s);
      if (source) {
        const where = source.kind === 'slot' ? 'its slot' : 'the load list';
        return { next: IDLE, announce: `Cancelled. Container returned to ${where}.` };
      }
      if (s.kind === 'swapping') return { next: IDLE, announce: 'Swap cancelled.' };
      return { next: s };
    }
    case 'startSwap': {
      // Not with a container in hand: put it down or back first.
      if (s.kind === 'holding' || s.kind === 'over') return { next: s };
      const p = w.state.placements.get(e.key);
      if (!p) return { next: s, announce: `${e.key} is empty. Nothing to swap.` };
      if (p.locked)
        return { next: s, announce: `${p.containerId} at ${e.key} is locked. Unlock it first.` };
      return {
        next: { kind: 'swapping', from: e.key, containerId: p.containerId },
        announce: `Swap: select the container to swap with ${p.containerId}.`,
      };
    }
    case 'chooseSwap': {
      if (s.kind !== 'swapping') return { next: s };
      if (e.key === s.from) return { next: IDLE, announce: 'Swap cancelled.' };
      if (!w.state.placements.has(e.key))
        return { next: s, announce: `${e.key} is empty. Pick a container to swap with.` };
      const command: Command = { kind: 'swap', a: s.from, b: e.key };
      const dry = applyCommand(w.state, w.ctx, command);
      if (!dry.ok) {
        return {
          next: IDLE,
          refusal: { key: e.key, title: `Can't swap ${s.from} and ${e.key}`, reason: dry.reason },
          announce: `Cannot swap. ${dry.reason}.`,
        };
      }
      return { next: IDLE, command, announce: `Swapped ${s.from} and ${e.key}.` };
    }
  }
}

/** The container in hand, if any. */
export const heldContainer = (s: PlacementState): string | null =>
  s.kind === 'holding' || s.kind === 'over' ? s.source.containerId : null;

/** Where the held container came from, if a slot. */
export const heldFrom = (s: PlacementState): SlotKey | null => {
  const src = sourceOf(s);
  return src ? fromOf(src) : null;
};

export type TargetMark = 'valid' | 'warning' | 'invalid' | 'origin';

export interface MarkInfo {
  mark: TargetMark;
  reason?: string;
  check?: PlacementCheck;
}

/**
 * The marks the bay view and the 3D view draw while a container is held (FR-34): the next free
 * slot of each stack in the bay on view, valid, valid with a warning or invalid, and the slot
 * the container came from.
 */
export function marksFor(s: PlacementState, w: World): Map<SlotKey, MarkInfo> {
  const marks = new Map<SlotKey, MarkInfo>();
  if (s.kind !== 'holding' && s.kind !== 'over') return marks;
  const c = containerOf(w, s.source);
  if (!c) return marks;
  const from = fromOf(s.source);
  for (const t of targetsInBay(w, c, from, w.bay)) {
    const mark: TargetMark = !t.check.valid
      ? 'invalid'
      : t.check.warnings.length
        ? 'warning'
        : 'valid';
    marks.set(t.key, { mark, reason: t.check.reason, check: t.check });
  }
  if (from) marks.set(from, { mark: 'origin' });
  return marks;
}

/** The command a drop on the current target would run, or null. */
export function pendingCommand(s: PlacementState): Command | null {
  if (s.kind !== 'over' || !s.check.target) return null;
  return s.source.kind === 'list'
    ? { kind: 'place', containerId: s.source.containerId, to: s.target }
    : { kind: 'move', from: s.source.from, to: s.target };
}
