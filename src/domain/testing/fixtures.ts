// Builders for tests. Not used by the app.
import { CONTAINER_TYPES } from '../constants';
import { halfOfKey, SAMPLE_VESSEL } from '../geometry';
import { createStowContext, type StowContext } from '../plan/context';
import { createStowState, type StowState } from '../plan/state';
import { generateSampleCall, type SampleCall } from '../sample';
import type { Container, ContainerType, Placement, SlotKey } from '../types';

export interface Setup {
  ctx: StowContext;
  state: StowState;
}

let sample: (Setup & { call: SampleCall }) | undefined;

/** The seeded sample call. Built once per test file. */
export function sampleSetup(): Setup & { call: SampleCall } {
  if (!sample) {
    const call = generateSampleCall();
    const ctx = createStowContext({
      vessel: call.vessel,
      containers: [...call.containers, ...call.loadList.map((x) => x.container)],
      placements: call.plan.placements,
    });
    sample = { call, ctx, state: createStowState(call.plan.placements) };
  }
  return sample;
}

let serial = 500000;

export function box(over: Partial<Container> & { type?: ContainerType } = {}): Container {
  const type = over.type ?? '40HC';
  const info = CONTAINER_TYPES[type];
  const c: Container = {
    id: over.id ?? `NSPU ${serial++} 0`,
    type,
    isoCode: info.iso,
    lengthFt: info.lengthFt,
    weightT: 20,
    pol: 'SGSIN',
    pod: 'NLRTM',
    ...over,
  };
  if (type === 'RF' && c.reeferSetPointC === undefined) c.reeferSetPointC = -18;
  return c;
}

export interface Item {
  key: SlotKey;
  c: Container;
  locked?: boolean;
  origin?: Placement['origin'];
}

/** A plan on the sample vessel holding only the given containers, plus spare ones off the ship. */
export function customSetup(items: readonly Item[], spare: readonly Container[] = []): Setup {
  const placements: Placement[] = items.map((x) => ({
    containerId: x.c.id,
    slotKey: x.key,
    half: halfOfKey(x.key),
    locked: x.locked ?? false,
    origin: x.origin ?? 'thisCall',
  }));
  const ctx = createStowContext({
    vessel: SAMPLE_VESSEL,
    containers: [...items.map((x) => x.c), ...spare],
    placements,
  });
  return { ctx, state: createStowState(placements) };
}
