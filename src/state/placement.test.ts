import { describe, expect, it } from 'vitest';
import { box, customSetup, sampleSetup } from '@/domain/testing/fixtures';
import {
  countValid,
  describeCheck,
  heldContainer,
  heldFrom,
  IDLE,
  step,
  targetsInBay,
  type PlacementState,
  type World,
} from './placement';

// Every state (idle, holding, over, swapping) and every transition of the controller.

const sample = sampleSetup();
const world = (bay = 18): World => ({ state: sample.state, ctx: sample.ctx, bay });
const unplaced = (id = 'NSPU 551208 4') => {
  expect(sample.state.slotOf.has(id)).toBe(false);
  return id;
};

const holdList = (
  id = unplaced(),
  via: 'pointer' | 'keyboard' = 'keyboard',
  queue: string[] = [],
) => step(IDLE, { type: 'pickFromList', containerId: id, via, queue }, world()).next;

describe('idle', () => {
  it('picks up an unplaced load list row and counts the valid targets in the bay', () => {
    const out = step(
      IDLE,
      { type: 'pickFromList', containerId: unplaced(), via: 'keyboard' },
      world(),
    );
    expect(out.next).toEqual({
      kind: 'holding',
      source: { kind: 'list', containerId: 'NSPU 551208 4' },
      via: 'keyboard',
      queue: [],
    });
    expect(out.announce).toMatch(
      /^Picked up NSPU 551208 4 from the load list\. \d+ valid targets? in bay 18\. Arrow keys to move, Enter to place, Esc to cancel\.$/,
    );
    expect(out.command).toBeUndefined();
  });

  it('does not pick up a row that is already planned, or an unknown one', () => {
    const planned = [...sample.state.placements.values()].find((p) => p.origin === 'thisCall')!;
    expect(
      step(
        IDLE,
        { type: 'pickFromList', containerId: planned.containerId, via: 'keyboard' },
        world(),
      ),
    ).toEqual({
      next: IDLE,
      announce: `${planned.containerId} is already planned at ${planned.slotKey}.`,
    });
    expect(
      step(IDLE, { type: 'pickFromList', containerId: 'X', via: 'pointer' }, world()).next,
    ).toEqual(IDLE);
  });

  it('picks up the top container of a stack', () => {
    const out = step(IDLE, { type: 'pickFromSlot', key: '180488', via: 'pointer' }, world());
    expect(out.next).toEqual({
      kind: 'holding',
      source: { kind: 'slot', containerId: 'NSPU 771032 1', from: '180488' },
      via: 'pointer',
      queue: [],
    });
    expect(out.announce).toMatch(/^Picked up NSPU 771032 1 from 180488\. /);
  });

  it('refuses empty slots, locked containers and containers under others (BR-03, BR-04)', () => {
    const empty = sample.ctx.geometry.slots40().find((k) => !sample.state.placements.has(k))!;
    expect(step(IDLE, { type: 'pickFromSlot', key: empty, via: 'keyboard' }, world())).toEqual({
      next: IDLE,
      announce: `${empty} is empty. Nothing to pick up.`,
    });
    expect(
      step(IDLE, { type: 'pickFromSlot', key: '180204', via: 'keyboard' }, world()).announce,
    ).toMatch(/at 180204 is locked\. Unlock it in the Inspector first\.$/);
    expect(
      step(IDLE, { type: 'pickFromSlot', key: '180486', via: 'keyboard' }, world()).announce,
    ).toBe('NSPU 482913 5 is under other containers. Only the top of a stack can be picked up.');
  });

  it('ignores hover, drop and chooseSwap, and cancel does nothing', () => {
    for (const e of [
      { type: 'hover', key: '180688' },
      { type: 'drop', key: '180688' },
      { type: 'chooseSwap', key: '180688' },
      { type: 'cancel' },
    ] as const) {
      expect(step(IDLE, e, world())).toEqual({ next: IDLE });
    }
  });

  it('starts a swap from a container, not from an empty or locked slot', () => {
    expect(step(IDLE, { type: 'startSwap', key: '460612' }, world())).toEqual({
      next: { kind: 'swapping', from: '460612', containerId: 'NSPU 813350 9' },
      announce: 'Swap: select the container to swap with NSPU 813350 9.',
    });
    expect(step(IDLE, { type: 'startSwap', key: '180204' }, world()).next).toEqual(IDLE);
    const empty = sample.ctx.geometry.slots40().find((k) => !sample.state.placements.has(k))!;
    expect(step(IDLE, { type: 'startSwap', key: empty }, world()).next).toEqual(IDLE);
  });
});

describe('holding', () => {
  it('goes over a target on hover, with the check, and reads it out from the keyboard', () => {
    const out = step(holdList(), { type: 'hover', key: '180688' }, world());
    expect(out.next).toMatchObject({
      kind: 'over',
      target: '180688',
      check: { target: true, valid: false },
    });
    expect(out.announce).toBe('180688: empty. Invalid: Stack limit: 96.4 t of 90.0 t.');
  });

  it('reads a slot that is not a target without a rule result', () => {
    const out = step(holdList(), { type: 'hover', key: '180486' }, world());
    expect(out.announce).toBe('180486: NSPU 482913 5, Rotterdam, 28.4 t.');
  });

  it('does not read out pointer moves', () => {
    const out = step(holdList(unplaced(), 'pointer'), { type: 'hover', key: '180688' }, world());
    expect(out.next.kind).toBe('over');
    expect(out.announce).toBeUndefined();
  });

  it('drop without a target: a pointer drag ends, the keyboard keeps holding', () => {
    expect(step(holdList(unplaced(), 'pointer'), { type: 'drop' }, world()).next).toEqual(IDLE);
    const kb = holdList();
    const out = step(kb, { type: 'drop' }, world());
    expect(out.next).toBe(kb);
    expect(out.announce).toBe('Move to a slot first. Still holding NSPU 551208 4.');
  });

  it('cancels back to idle (Esc)', () => {
    expect(step(holdList(), { type: 'cancel' }, world())).toEqual({
      next: IDLE,
      announce: 'Cancelled. Container returned to the load list.',
    });
    const fromSlot = step(
      IDLE,
      { type: 'pickFromSlot', key: '180488', via: 'keyboard' },
      world(),
    ).next;
    expect(step(fromSlot, { type: 'cancel' }, world()).announce).toBe(
      'Cancelled. Container returned to its slot.',
    );
  });

  it('drops straight on a slot it names', () => {
    const target = targetsInBay(
      world(),
      sample.ctx.containers.get('NSPU 551208 4')!,
      null,
      18,
    ).find((t) => t.check.valid)!.key;
    const out = step(holdList(), { type: 'drop', key: target }, world());
    expect(out.command).toEqual({ kind: 'place', containerId: 'NSPU 551208 4', to: target });
    expect(out.next).toEqual(IDLE);
  });

  it('picking up something else replaces what is held', () => {
    const out = step(holdList(), { type: 'pickFromSlot', key: '180488', via: 'keyboard' }, world());
    expect(heldContainer(out.next)).toBe('NSPU 771032 1');
  });
});

describe('over target', () => {
  const over = (key: string, via: 'pointer' | 'keyboard' = 'keyboard') =>
    step(holdList(unplaced(), via), { type: 'hover', key }, world()).next;
  const valid = () =>
    targetsInBay(world(), sample.ctx.containers.get('NSPU 551208 4')!, null, 18).find(
      (t) => t.check.valid && t.check.warnings.length === 0,
    )!.key;

  it('moves to another target, and back to holding off the grid', () => {
    const s = over('180688');
    expect(step(s, { type: 'hover', key: valid() }, world()).next).toMatchObject({
      kind: 'over',
      target: valid(),
    });
    expect(step(s, { type: 'hover', key: null }, world()).next.kind).toBe('holding');
  });

  it('places on a valid target: one place command (FR-31)', () => {
    const key = valid();
    const out = step(over(key), { type: 'drop' }, world());
    expect(out.command).toEqual({ kind: 'place', containerId: 'NSPU 551208 4', to: key });
    expect(out.next).toEqual(IDLE);
    expect(out.announce).toBe(`Placed NSPU 551208 4 at ${key}.`);
    expect(out.refusal).toBeUndefined();
  });

  it('AT-02: a pointer drop on 180688 is refused, the container returns (FR-35)', () => {
    const out = step(over('180688', 'pointer'), { type: 'drop' }, world());
    expect(out.next).toEqual(IDLE);
    expect(out.command).toBeUndefined();
    expect(out.refusal).toEqual({
      key: '180688',
      title: "Can't place NSPU 551208 4 at 180688",
      reason: 'Stack limit: 96.4 t of 90.0 t',
      returned: 'Container returned to the load list.',
    });
  });

  it('a refused keyboard drop keeps the container in hand', () => {
    const out = step(over('180688'), { type: 'drop' }, world());
    expect(out.next).toMatchObject({ kind: 'over', target: '180688' });
    expect(out.refusal?.reason).toBe('Stack limit: 96.4 t of 90.0 t');
    expect(out.refusal?.returned).toBeUndefined();
    expect(out.announce).toBe(
      'Cannot place at 180688. Stack limit: 96.4 t of 90.0 t. Still holding NSPU 551208 4.',
    );
  });

  it('refuses a slot that is not a target with the structural reason', () => {
    const out = step(over('180486', 'pointer'), { type: 'drop' }, world());
    expect(out.refusal?.reason).toBe('Slot is occupied');
  });

  it('moves a container from a slot: one move command (FR-33)', () => {
    const held = step(IDLE, { type: 'pickFromSlot', key: '180488', via: 'pointer' }, world()).next;
    const to = targetsInBay(
      world(),
      sample.ctx.containers.get('NSPU 771032 1')!,
      '180488',
      18,
    ).find((t) => t.check.valid)!.key;
    const s = step(held, { type: 'hover', key: to }, world()).next;
    const out = step(s, { type: 'drop' }, world());
    expect(out.command).toEqual({ kind: 'move', from: '180488', to });
    expect(out.announce).toBe(`Moved NSPU 771032 1 to ${to}.`);
    expect(heldFrom(s)).toBe('180488');
  });

  it('putting a container back on its own slot ends the hold without a command', () => {
    const held = step(IDLE, { type: 'pickFromSlot', key: '180488', via: 'pointer' }, world()).next;
    const s = step(held, { type: 'hover', key: '180488' }, world()).next;
    expect(step(s, { type: 'drop' }, world())).toEqual({
      next: IDLE,
      announce: 'NSPU 771032 1 put back at 180488.',
    });
  });

  it('refuses a drop that the full rule check refuses, with its reason', () => {
    // A DG container next to an incompatible one in the next bay is refused by the check.
    const { ctx, state } = customSetup(
      [{ key: '180282', c: box({ id: 'NSPU 100000 1', imdgClass: '3' }) }],
      [box({ id: 'NSPU 100000 2', imdgClass: '5.1' })],
    );
    const w: World = { ctx, state, bay: 22 };
    const held = step(
      IDLE,
      { type: 'pickFromList', containerId: 'NSPU 100000 2', via: 'pointer' },
      w,
    ).next;
    const out = step(step(held, { type: 'hover', key: '220282' }, w).next, { type: 'drop' }, w);
    expect(out.refusal?.reason).toBe('IMDG 5.1 next to IMDG 3');
  });

  it('places the next selected row after a drop (FR-39)', () => {
    const ids = sample.call.loadList
      .filter((x) => x.plannedSlotKey === '')
      .map((x) => x.container.id);
    const [first, second, third] = ids as [string, string, string];
    const held = holdList(first, 'pointer', [first, second, third]);
    expect(held).toMatchObject({ queue: [second, third] });
    const target = targetsInBay(world(), sample.ctx.containers.get(first)!, null, 18).find(
      (t) => t.check.valid,
    )!.key;
    const out = step(
      step(held, { type: 'hover', key: target }, world()).next,
      { type: 'drop' },
      world(),
    );
    expect(out.command).toMatchObject({ kind: 'place', containerId: first });
    expect(out.next).toEqual({
      kind: 'holding',
      source: { kind: 'list', containerId: second },
      via: 'keyboard',
      queue: [third],
    });
    expect(out.announce).toMatch(new RegExp(`Picked up ${second}\\. 1 more row selected\\.$`));
  });

  it('cancels from over', () => {
    expect(step(over('180688'), { type: 'cancel' }, world()).next).toEqual(IDLE);
  });
});

describe('swapping', () => {
  const swapping: PlacementState = {
    kind: 'swapping',
    from: '460612',
    containerId: 'NSPU 813350 9',
  };

  it('swaps with the chosen container (FR-48)', () => {
    expect(step(swapping, { type: 'chooseSwap', key: '460610' }, world())).toEqual({
      next: IDLE,
      command: { kind: 'swap', a: '460612', b: '460610' },
      announce: 'Swapped 460612 and 460610.',
    });
  });

  it('refuses a swap that creates an error, and says why', () => {
    // The reefer without a plug moves to another slot without a plug: a new reefer error.
    const out = step(
      { kind: 'swapping', from: '220610', containerId: 'NSPU 220417 3' },
      { type: 'chooseSwap', key: '220608' },
      world(),
    );
    expect(out.next).toEqual(IDLE);
    expect(out.command).toBeUndefined();
    expect(out.refusal).toEqual({
      key: '220608',
      title: "Can't swap 220610 and 220608",
      reason: 'Reefer NSPU 220417 3 at 220608 has no plug',
    });
  });

  it('choosing itself or Esc ends the swap; an empty slot asks again', () => {
    expect(step(swapping, { type: 'chooseSwap', key: '460612' }, world())).toEqual({
      next: IDLE,
      announce: 'Swap cancelled.',
    });
    expect(step(swapping, { type: 'cancel' }, world())).toEqual({
      next: IDLE,
      announce: 'Swap cancelled.',
    });
    const empty = sample.ctx.geometry.slots40().find((k) => !sample.state.placements.has(k))!;
    expect(step(swapping, { type: 'chooseSwap', key: empty }, world()).next).toBe(swapping);
    expect(step(swapping, { type: 'hover', key: '180688' }, world()).next).toBe(swapping);
    expect(step(swapping, { type: 'drop' }, world()).next).toBe(swapping);
  });
});

describe('every state and every event', () => {
  // The kind of state each event leads to, from each state. The tests above check the details.
  const valid = targetsInBay(world(), sample.ctx.containers.get('NSPU 551208 4')!, null, 18).find(
    (t) => t.check.valid && t.check.warnings.length === 0,
  )!.key;
  const states: Record<PlacementState['kind'], PlacementState> = {
    idle: IDLE,
    holding: holdList(),
    over: step(holdList(), { type: 'hover', key: valid }, world()).next,
    swapping: { kind: 'swapping', from: '460612', containerId: 'NSPU 813350 9' },
  };
  const events = {
    pickFromList: { type: 'pickFromList', containerId: 'NSPU 300653 4', via: 'keyboard' },
    pickFromSlot: { type: 'pickFromSlot', key: '180488', via: 'keyboard' },
    hover: { type: 'hover', key: valid },
    drop: { type: 'drop' },
    cancel: { type: 'cancel' },
    startSwap: { type: 'startSwap', key: '180486' },
    chooseSwap: { type: 'chooseSwap', key: '460610' },
  } as const;
  const expected: Record<
    PlacementState['kind'],
    Record<keyof typeof events, PlacementState['kind']>
  > = {
    idle: {
      pickFromList: 'holding',
      pickFromSlot: 'holding',
      hover: 'idle',
      drop: 'idle',
      cancel: 'idle',
      startSwap: 'swapping',
      chooseSwap: 'idle',
    },
    holding: {
      pickFromList: 'holding',
      pickFromSlot: 'holding',
      hover: 'over',
      drop: 'holding',
      cancel: 'idle',
      startSwap: 'holding',
      chooseSwap: 'holding',
    },
    over: {
      pickFromList: 'holding',
      pickFromSlot: 'holding',
      hover: 'over',
      drop: 'idle',
      cancel: 'idle',
      startSwap: 'over',
      chooseSwap: 'over',
    },
    swapping: {
      pickFromList: 'holding',
      pickFromSlot: 'holding',
      hover: 'swapping',
      drop: 'swapping',
      cancel: 'idle',
      startSwap: 'swapping',
      chooseSwap: 'idle',
    },
  };
  for (const [from, s] of Object.entries(states))
    for (const [name, e] of Object.entries(events))
      it(`${from} + ${name} → ${expected[from as PlacementState['kind']][name as keyof typeof events]}`, () => {
        expect(step(s, e, world()).next.kind).toBe(
          expected[from as PlacementState['kind']][name as keyof typeof events],
        );
      });
});

describe('helpers', () => {
  it('describes a check as the live region says it', () => {
    const c = sample.ctx.containers.get('NSPU 551208 4')!;
    const t = targetsInBay(world(), c, null, 18);
    expect(t.length).toBeGreaterThan(10);
    expect(countValid(t)).toBeGreaterThan(0);
    const valid = t.find((x) => x.check.valid && !x.check.warnings.length)!;
    expect(describeCheck(valid.check)).toMatch(/^Valid target, stack \d+\.\d t of 90\.0 t$/);
    expect(
      describeCheck({
        target: false,
        valid: false,
        errors: [],
        warnings: [],
        stackWeightT: 0,
        limitT: 0,
        reason: 'Slot is occupied',
      }),
    ).toBe('Invalid: Slot is occupied');
    expect(
      describeCheck({
        target: true,
        valid: true,
        errors: [],
        warnings: [{ rule: 'heavy', message: 'Heavy' }],
        stackWeightT: 1,
        limitT: 90,
      }),
    ).toBe('Valid with warning: Heavy');
    expect(heldContainer(IDLE)).toBeNull();
    expect(heldFrom(IDLE)).toBeNull();
  });
});
