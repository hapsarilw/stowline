import type { Bay, Half, Slot, SlotKey, Vessel } from '../types';
import { bay40Of, halfOfBay, isDeckTier, parseKey, slotKey } from './keys';
import { createSampleVessel } from './vessel';

/** Distance of a 20ft half from the centre of its 40ft slot, in metres. */
export const HALF_OFFSET_X = 3.05;

/** z in scene coordinates is measured from this offset above the keel. */
export const KEEL_OFFSET_Z = 24;

const rowY = (row: number): number =>
  row % 2 === 0 ? (row / 2 - 0.5) * 2.5 : -((row + 1) / 2 - 0.5) * 2.5;

export interface SlotPosition {
  x: number;
  y: number;
  z: number;
  bayIndex: number;
}

export interface Geometry {
  vessel: Vessel;
  bayByNum(bay40: number): Bay | undefined;
  /** Accepts a 40ft slot key or a 20ft half key. */
  slotExists(key: SlotKey): boolean;
  hasPlug(key: SlotKey): boolean;
  slot(key: SlotKey): Slot | undefined;
  slotPos(key: SlotKey): SlotPosition;
  /** Number of 40ft slots on the vessel. */
  slotCount40(): number;
  /** Every 40ft slot key, bay by bay, deck then hold. */
  slots40(): SlotKey[];
}

export function createGeometry(vessel: Vessel): Geometry {
  const bays = new Map(vessel.bays.map((b) => [b.bay, b]));
  const plugs = new Set(vessel.plugs);

  const bayByNum = (n: number) => bays.get(n);

  const slotExists = (key: SlotKey): boolean => {
    const { bay, row, tier } = parseKey(key);
    const b = bays.get(bay40Of(bay));
    if (!b || row < 1) return false;
    return isDeckTier(tier)
      ? row <= b.deckRows && b.deckTiers.includes(tier)
      : row <= b.holdRows && b.holdTiers.includes(tier);
  };

  const hasPlug = (key: SlotKey): boolean => {
    const { bay, row, tier } = parseKey(key);
    return plugs.has(slotKey(bay40Of(bay), row, tier));
  };

  const slot = (key: SlotKey): Slot | undefined => {
    if (!slotExists(key)) return undefined;
    const { bay, row, tier } = parseKey(key);
    return { bay, row, tier, half: halfOfBay(bay), hasPlug: hasPlug(key) };
  };

  const slotPos = (key: SlotKey): SlotPosition => {
    const { bay, row, tier } = parseKey(key);
    const b = bays.get(bay40Of(bay));
    if (!b) throw new Error(`Unknown bay in slot ${key}`);
    const half: Half = halfOfBay(bay);
    const z = isDeckTier(tier) ? 1.2 + ((tier - 80) / 2 - 0.5) * 2.6 : -22 + (tier / 2 - 0.5) * 2.6;
    const dx = half === 'both' ? 0 : half === 'fore' ? HALF_OFFSET_X : -HALF_OFFSET_X;
    return { x: b.x + dx, y: rowY(row), z, bayIndex: b.index };
  };

  const slots40 = (): SlotKey[] => {
    const out: SlotKey[] = [];
    for (const b of vessel.bays) {
      for (let row = 1; row <= b.deckRows; row++) {
        for (const t of b.deckTiers) out.push(slotKey(b.bay, row, t));
      }
      for (let row = 1; row <= b.holdRows; row++) {
        for (const t of b.holdTiers) out.push(slotKey(b.bay, row, t));
      }
    }
    return out;
  };

  const slotCount40 = (): number =>
    vessel.bays.reduce(
      (n, b) => n + b.deckRows * b.deckTiers.length + b.holdRows * b.holdTiers.length,
      0,
    );

  return { vessel, bayByNum, slotExists, hasPlug, slot, slotPos, slotCount40, slots40 };
}

export const SAMPLE_VESSEL: Vessel = createSampleVessel();
export const SAMPLE_GEOMETRY: Geometry = createGeometry(SAMPLE_VESSEL);
