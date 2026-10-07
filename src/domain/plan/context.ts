import { PODS } from '../constants';
import { createGeometry, rowsFor, type Geometry } from '../geometry';
import type { Container, Placement, SlotKey, Vessel } from '../types';

export interface PortInfo {
  code: string;
  name: string;
  short: string;
  /** Discharge order. Lower leaves the ship first. */
  order: number;
}

/** Everything the rules need that does not change while the planner works. */
export interface StowContext {
  vessel: Vessel;
  geometry: Geometry;
  /** Every container the plan can hold: on board and on the load list. */
  containers: ReadonlyMap<string, Container>;
  ports: ReadonlyMap<string, PortInfo>;
  /** Arrival slot of each container loaded at an earlier port. Moving one is a shift (BR-17). */
  arrival: ReadonlyMap<string, SlotKey>;
  /** IDs of containers with dangerous goods, so the DG rule does not scan the whole plan. */
  dgIds: readonly string[];
  /** Row numbers from port to starboard across the widest bay. Neighbours in this list are side by side. */
  rowOrder: readonly number[];
}

export const DEFAULT_PORTS: readonly PortInfo[] = Object.values(PODS);

export interface StowContextInput {
  vessel: Vessel;
  containers: Iterable<Container>;
  /** The placements of the arrival condition. Those with origin onboard set the arrival slots. */
  placements: Iterable<Placement>;
  ports?: Iterable<PortInfo>;
}

export function createStowContext(input: StowContextInput): StowContext {
  const containers = new Map<string, Container>();
  for (const c of input.containers) containers.set(c.id, c);
  const arrival = new Map<string, SlotKey>();
  for (const p of input.placements)
    if (p.origin === 'onboard') arrival.set(p.containerId, p.slotKey);
  const ports = new Map<string, PortInfo>();
  for (const p of input.ports ?? DEFAULT_PORTS) ports.set(p.code, p);
  const maxRows = Math.max(...input.vessel.bays.flatMap((b) => [b.deckRows, b.holdRows]));
  return {
    vessel: input.vessel,
    geometry: createGeometry(input.vessel),
    containers,
    ports,
    arrival,
    dgIds: [...containers.values()].filter((c) => c.imdgClass !== undefined).map((c) => c.id),
    rowOrder: rowsFor(maxRows % 2 === 0 ? maxRows : maxRows + 1),
  };
}

export const portOrder = (ctx: StowContext, code: string): number =>
  ctx.ports.get(code)?.order ?? Number.POSITIVE_INFINITY;

export const portName = (ctx: StowContext, code: string): string =>
  ctx.ports.get(code)?.name ?? code;

export const portShort = (ctx: StowContext, code: string): string =>
  ctx.ports.get(code)?.short ?? code;
