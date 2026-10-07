import type { Bay, Hydrostatics, SlotKey, Vessel, VesselLimits } from '../types';
import { slotKey } from './keys';

export const DECK_TIERS: readonly number[] = [82, 84, 86, 88, 90, 92];
export const HOLD_TIERS: readonly number[] = [2, 4, 6, 8, 10, 12, 14, 16];

const BAY_COUNT = 22;

/** Forward bays are narrower and shallower. */
function buildBays(): Bay[] {
  const bays: Bay[] = [];
  let x = 0;
  for (let i = 0; i < BAY_COUNT; i++) {
    const deckRows = [10, 12, 14][i] ?? (i >= 21 ? 14 : 16);
    const holdRows = [8, 10, 12][i] ?? (i >= 21 ? 10 : i >= 20 ? 12 : 14);
    const lowestHoldTier = [8, 6, 4][i] ?? 2;
    bays.push({
      bay: 2 + 4 * i,
      index: i,
      x,
      deckRows,
      holdRows,
      deckTiers: [...DECK_TIERS],
      holdTiers: HOLD_TIERS.filter((t) => t >= lowestHoldTier),
    });
    x -= 13.2;
    if (i === 13) x -= 16; // the deckhouse gap
  }
  const mid = (bays[0]!.x + bays[BAY_COUNT - 1]!.x) / 2;
  return bays.map((b) => ({ ...b, x: b.x - mid }));
}

/** Plug positions of the sample vessel: deck tiers 82 and 84 in bays 3 to 12 (by index), hold tiers 2 and 4 in bays 4 to 6. */
function hasSamplePlug(bay: Bay, tier: number): boolean {
  if (tier >= 82) return bay.index >= 3 && bay.index <= 12 && tier <= 84;
  return bay.index >= 4 && bay.index <= 6 && tier <= 4;
}

function buildPlugs(bays: readonly Bay[]): SlotKey[] {
  const keys: SlotKey[] = [];
  for (const bay of bays) {
    for (let row = 1; row <= bay.deckRows; row++) {
      for (const tier of bay.deckTiers) {
        if (hasSamplePlug(bay, tier)) keys.push(slotKey(bay.bay, row, tier));
      }
    }
    for (let row = 1; row <= bay.holdRows; row++) {
      for (const tier of bay.holdTiers) {
        if (hasSamplePlug(bay, tier)) keys.push(slotKey(bay.bay, row, tier));
      }
    }
  }
  return keys.sort();
}

export const SAMPLE_LIMITS: VesselLimits = {
  stackDeckT: 90.0,
  stackHoldT: 210.0,
  heavyDeltaT: 10.0,
  gmMinM: 1.2,
  gmCheckM: 1.4,
  trimLimitM: 1.5,
  trimCheckM: 1.0,
  listLimitDeg: 2.0,
  listCheckDeg: 0.3,
  strengthLimitPct: 100,
  strengthCheckPct: 85,
  shearLimitT: 15000,
  bendingLimitTm: 550000,
};

export const SAMPLE_HYDROSTATICS: Hydrostatics = {
  referenceDisplacementT: 98420,
  referenceDeadweightT: 71260,
  km: 17.46,
  referenceKg: 15.62,
  mtc: 1150,
  lcf: -4,
  tpc: 125,
  referenceMeanDraftM: 12.41,
  summerDraftM: 14.5,
};

export function createSampleVessel(): Vessel {
  const bays = buildBays();
  return {
    id: 'nusantara-pioneer',
    name: 'MV Nusantara Pioneer',
    // Fictional. The check digit is wrong on purpose, so it cannot match a real ship.
    imo: '9000000',
    teu: 8500,
    bays,
    plugs: buildPlugs(bays),
    deckhouseX: (bays[13]!.x + bays[14]!.x) / 2,
    limits: SAMPLE_LIMITS,
    hydrostatics: SAMPLE_HYDROSTATICS,
  };
}
