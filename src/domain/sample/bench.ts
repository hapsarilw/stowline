import { CONTAINER_TYPES, POD_LIST, PODS, type PodCode } from '../constants';
import { halfOfKey, rowsFor, slotKey, slotKeyFor } from '../geometry';
import { SAMPLE_HYDROSTATICS, SAMPLE_LIMITS } from '../geometry/vessel';
import type { Bay, Container, ContainerType, Placement, SlotKey, Vessel } from '../types';
import { createRng } from './rng';

// A larger test vessel for the performance targets (NFR-01 to NFR-05): 25 bays of 24 rows,
// 9 deck tiers and 8 hold tiers, 10,200 forty-foot slots, filled to 10,000 containers.
// Stacks are full and ordered (later ports and heavier boxes lower), with reefers in plug
// slots, pairs of 20ft containers at the bottom of some hold stacks, and a few DG boxes.

const BAYS = 25;
const ROWS = 24;
const DECK_TIERS = [82, 84, 86, 88, 90, 92, 94, 96, 98];
const HOLD_TIERS = [2, 4, 6, 8, 10, 12, 14, 16];
/** The deckhouse sits in a 16 m gap after this bay index, as on the sample vessel. */
const HOUSE_AFTER = 13;

export function createBenchVessel(): Vessel {
  const bays: Bay[] = [];
  let x = 0;
  for (let i = 0; i < BAYS; i++) {
    bays.push({
      bay: 2 + 4 * i,
      index: i,
      x,
      deckRows: ROWS,
      holdRows: ROWS,
      deckTiers: DECK_TIERS,
      holdTiers: HOLD_TIERS,
    });
    x -= 13.2;
    if (i === HOUSE_AFTER) x -= 16;
  }
  const mid = (bays[0]!.x + bays[BAYS - 1]!.x) / 2;
  for (const b of bays) b.x -= mid;
  const plugs: SlotKey[] = [];
  for (const b of bays) {
    if (b.index < 4 || b.index > 15) continue;
    for (let row = 1; row <= ROWS; row++)
      for (const t of [82, 84]) plugs.push(slotKey(b.bay, row, t));
  }
  return {
    id: 'bench-vessel',
    name: 'Benchmark vessel',
    imo: '9000000',
    teu: 21000,
    bays,
    plugs: plugs.sort(),
    deckhouseX: (bays[HOUSE_AFTER]!.x + bays[HOUSE_AFTER + 1]!.x) / 2,
    limits: SAMPLE_LIMITS,
    hydrostatics: SAMPLE_HYDROSTATICS,
  };
}

export interface BenchCall {
  vessel: Vessel;
  containers: Container[];
  placements: Placement[];
}

export function generateBenchCall(target = 10000): BenchCall {
  const vessel = createBenchVessel();
  const plugs = new Set(vessel.plugs);
  const r = createRng(10000);
  const containers: Container[] = [];
  const placements: Placement[] = [];
  const DG = ['3', '5.1', '2.1', '1.4', '9', '8'];

  const add = (type: ContainerType, w: number, pod: PodCode, key: SlotKey) => {
    const n = containers.length;
    const info = CONTAINER_TYPES[type];
    const c: Container = {
      id: `NSPU ${200000 + n} ${n % 10}`,
      type,
      isoCode: info.iso,
      lengthFt: info.lengthFt,
      weightT: w,
      pol: 'IDJKT',
      pod,
    };
    if (type === 'RF') c.reeferSetPointC = -18;
    if (r() < 0.02) c.imdgClass = DG[Math.floor(r() * DG.length)]!;
    containers.push(c);
    placements.push({
      containerId: c.id,
      slotKey: key,
      half: halfOfKey(key),
      locked: false,
      origin: 'onboard',
    });
  };

  outer: for (const b of vessel.bays) {
    for (const deck of [false, true]) {
      const tiers = deck ? DECK_TIERS : HOLD_TIERS;
      for (const row of rowsFor(ROWS)) {
        const n = tiers.length;
        const pods = Array.from({ length: n }, () => POD_LIST[Math.floor(r() * 4)]!).sort(
          (a, c) => PODS[c].order - PODS[a].order,
        );
        const ws = Array.from(
          { length: n },
          () => Math.round((deck ? 4 + r() * 5.5 : 8 + r() * 9) * 10) / 10,
        ).sort((a, c) => c - a);
        const pairBottom = !deck && row % 5 === 0;
        for (let k = 0; k < n; k++) {
          if (containers.length >= target) break outer;
          const t = tiers[k]!;
          if (k === 0 && pairBottom && containers.length + 2 <= target) {
            const w = Math.round((ws[0]! / 2) * 10) / 10;
            add('20GP', w, pods[0]!, slotKeyFor(b.bay, row, t, 'fore'));
            add('20GP', w, pods[0]!, slotKeyFor(b.bay, row, t, 'aft'));
            continue;
          }
          const key = slotKey(b.bay, row, t);
          const type: ContainerType =
            plugs.has(key) && r() < 0.3 ? 'RF' : r() < 0.66 ? '40HC' : '40GP';
          add(type, ws[k]!, pods[k]!, key);
        }
      }
    }
  }
  return { vessel, containers, placements };
}
