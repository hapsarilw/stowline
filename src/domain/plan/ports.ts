import { PODS, POD_LIST, type PodCode } from '../constants';
import { isDeckTier, parseKey } from '../geometry';
import { CURRENT_PORT, ROTATION } from '../sample/rotation';
import type { SlotKey, Violation } from '../types';
import type { StowContext } from './context';
import type { StowState } from './state';

// The ports ahead of the ship, for the legend and the port timeline (FR-55, FR-56).

/** Containers on board per port of discharge. */
export function podCounts(s: StowState, ctx: StowContext): Record<PodCode, number> {
  const counts = Object.fromEntries(POD_LIST.map((p) => [p, 0])) as Record<PodCode, number>;
  for (const p of s.placements.values()) {
    const pod = ctx.containers.get(p.containerId)?.pod as PodCode | undefined;
    if (pod && pod in counts) counts[pod]++;
  }
  return counts;
}

export interface PortStop {
  code: string;
  name: string;
  /** Containers that leave the ship here. */
  discharge: number;
  /** Restow moves here, from the overstow check (BR-08). */
  restows: number;
}

/** The departure, then one stop per port of discharge in rotation order. */
export function portStops(
  s: StowState,
  ctx: StowContext,
  violations: readonly Violation[],
): PortStop[] {
  const counts = podCounts(s, ctx);
  const restows = new Map<string, number>();
  for (const v of violations) {
    if (v.rule !== 'overstow' || !v.data?.port) continue;
    restows.set(v.data.port, (restows.get(v.data.port) ?? 0) + (v.data.restows ?? 0));
  }
  const departure = ROTATION.find((p) => p.code === CURRENT_PORT);
  return [
    { code: CURRENT_PORT, name: departure?.name ?? CURRENT_PORT, discharge: 0, restows: 0 },
    ...POD_LIST.map((code) => ({
      code,
      name: PODS[code].name,
      discharge: counts[code],
      restows: restows.get(code) ?? 0,
    })),
  ];
}

/**
 * The order the containers for a port lift off in playback: deck before hold, then from the
 * bow aft, then from the top down (design/stow3d.js prepLift).
 */
export function liftOrder(s: StowState, ctx: StowContext, pod: string): SlotKey[] {
  const keys: { key: SlotKey; deck: boolean; x: number; z: number }[] = [];
  for (const [key, p] of s.placements) {
    if (ctx.containers.get(p.containerId)?.pod !== pod) continue;
    const pos = ctx.geometry.slotPos(key);
    keys.push({ key, deck: isDeckTier(parseKey(key).tier), x: pos.x, z: pos.z });
  }
  keys.sort(
    (a, b) => Number(b.deck) - Number(a.deck) || b.x - a.x || b.z - a.z || (a.key < b.key ? -1 : 1),
  );
  return keys.map((k) => k.key);
}
